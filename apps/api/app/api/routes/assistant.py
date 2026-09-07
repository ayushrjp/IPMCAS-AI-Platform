import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Header, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from jose import jwt
from app.core.config import settings
from app.core.logging import logger
from app.services.llm_service import (
    generate_chat_response,
    generate_chat_response_stream,
    generate_insights,
    get_openai_client,
    get_model_name,
)
from app.services.supabase_db import (
    get_measurement_by_id,
    get_user_historical_summary,
    save_ai_conversation,
    get_ai_conversations
)

import asyncio
import os

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


@router.get("/config")
async def assistant_config():
    """
    Safe diagnostic endpoint: reports AI provider configuration state.
    Does NOT expose API keys — only reports YES/NO and model name.
    """
    gemini_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
    openai_key = os.getenv("OPENAI_API_KEY") or getattr(settings, "OPENAI_API_KEY", None)
    invalid = {"placeholder-key", "your_openai_api_key_here", "sk-placeholder",
               "your-llm-api-key-here", "placeholder-service-role-key", ""}
    gemini_configured = bool(gemini_key and gemini_key.strip() not in invalid)
    openai_configured = bool(openai_key and openai_key.strip() not in invalid)
    client = get_openai_client()
    model = get_model_name()
    return {
        "gemini_api_key_configured": gemini_configured,
        "openai_api_key_configured": openai_configured,
        "llm_client_ready": client is not None,
        "active_model": model,
        "provider": "gemini" if gemini_configured else ("openai" if openai_configured else "none"),
        "base_url": str(client.base_url) if client else None,
    }


class ChatMessage(BaseModel):
    role: str
    content: str


class AssistantChatRequest(BaseModel):
    message: str
    measurement_id: Optional[str] = None
    context_override: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[ChatMessage]] = None
    session_id: Optional[str] = None


async def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, key="", options={"verify_signature": False})
        return payload.get("sub")
    except Exception:
        return None


def get_suggested_questions(current_measurement: Optional[Dict[str, Any]]) -> List[str]:
    """Generates contextual suggested questions based on primary measurement state."""
    if not current_measurement:
        return [
            "Is my network performing well?",
            "What should I check first?",
            "How do I run a speed test?",
            "What does latency mean?"
        ]
    
    dl = float(current_measurement.get("download_mbps") or 0.0)
    ul = float(current_measurement.get("upload_mbps") or 0.0)
    lat = float(current_measurement.get("latency_ms") or 0.0)
    jit = float(current_measurement.get("jitter_ms") or 0.0)

    if dl < 10.0:
        return [
            "Why is my download speed low?",
            "Is my Wi-Fi causing this?",
            "How can I improve my connection?",
            "Compare my current test with my previous tests."
        ]
    elif lat > 100.0 or jit > 30.0:
        return [
            "Why is my latency so high?",
            "Is this good for gaming?",
            "Why is my jitter high?",
            "How can I reduce latency?"
        ]
    elif ul <= 0.1:
        return [
            "Why is my upload speed 0 Mbps?",
            "Why did my speed change?",
            "Is my network stable?",
            "What should I check first?"
        ]
    else:
        return [
            "Is my network stable?",
            "Is this good for gaming?",
            "Compare my current test with my previous tests.",
            "Explain my test results in simple terms."
        ]


async def resolve_measurement_and_history(
    payload: AssistantChatRequest,
    user_id: Optional[str]
) -> tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    """Helper to retrieve primary measurement context and historical baseline securely and concurrently."""
    target_id = payload.measurement_id

    if not target_id and payload.context_override and isinstance(payload.context_override, dict):
        target_id = (
            payload.context_override.get("id") or
            payload.context_override.get("measurementId") or
            payload.context_override.get("measurement_id") or
            payload.context_override.get("session_id")
        )

    async def fetch_target():
        if target_id and user_id:
            m = await get_measurement_by_id(str(target_id), user_id)
            if m:
                return m
            logger.info(f"Target measurement {target_id} not found for user {user_id}")
        return None

    async def fetch_history():
        if user_id:
            return await get_user_historical_summary(user_id)
        return {"total_tests": 0}

    target_measurement, historical_summary = await asyncio.gather(fetch_target(), fetch_history())

    if not target_measurement and payload.context_override and isinstance(payload.context_override, dict):
        lat_dict = payload.context_override.get("latency") if isinstance(payload.context_override.get("latency"), dict) else {}
        server_info = payload.context_override.get("server_info") if isinstance(payload.context_override.get("server_info"), dict) else {}

        target_measurement = {
            "id": payload.context_override.get("id") or payload.context_override.get("measurementId") or payload.context_override.get("measurement_id") or "current",
            "download_mbps": float(
                payload.context_override.get("downloadSpeedMbps") if payload.context_override.get("downloadSpeedMbps") is not None
                else payload.context_override.get("download_mbps") if payload.context_override.get("download_mbps") is not None
                else payload.context_override.get("throughput_mbps") or 0.0
            ),
            "upload_mbps": float(
                payload.context_override.get("uploadSpeedMbps") if payload.context_override.get("uploadSpeedMbps") is not None
                else payload.context_override.get("upload_mbps") if payload.context_override.get("upload_mbps") is not None
                else payload.context_override.get("upload_speed_mbps") or 0.0
            ),
            "latency_ms": float(
                lat_dict.get("avgMs") if lat_dict.get("avgMs") is not None
                else payload.context_override.get("latency_ms") if payload.context_override.get("latency_ms") is not None
                else payload.context_override.get("latency_avg_ms") or 0.0
            ),
            "jitter_ms": float(
                lat_dict.get("jitterMs") if lat_dict.get("jitterMs") is not None
                else payload.context_override.get("jitter_ms") if payload.context_override.get("jitter_ms") is not None
                else 0.0
            ),
            "status": payload.context_override.get("status", "COMPLETED"),
            "concurrency": payload.context_override.get("concurrency") or "default",
            "server_node": server_info.get("name") or payload.context_override.get("server_node") or "IPMCAS Primary Server",
            "timestamp": payload.context_override.get("timestamp") or payload.context_override.get("created_at") or "N/A",
            "client_info": payload.context_override.get("client_info") or {}
        }

    return target_measurement, historical_summary


@router.post("/chat")
async def assistant_chat(
    payload: AssistantChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Standard non-streaming conversational AI Endpoint.
    Uses real LLM backend service, supports multi-turn chat history,
    primary measurement context, and historical baseline.
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="User message cannot be empty.")

    logger.info(f"[ASSISTANT ROUTE] Received request | message: '{payload.message}' | user_id: {user_id}")

    target_measurement, historical_summary = await resolve_measurement_and_history(payload, user_id)

    # Reconstruct message thread for multi-turn LLM context
    messages = []
    if payload.conversation_history:
        for m in payload.conversation_history:
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": payload.message})

    logger.info(f"[ASSISTANT ROUTE] Calling generate_chat_response with {len(messages)} messages")

    # Call LLM Service directly
    answer_text = await generate_chat_response(messages, target_measurement, historical_summary)

    logger.info(f"[ASSISTANT ROUTE] generate_chat_response returned answer ({len(answer_text)} chars)")

    # Persist in Supabase if authenticated
    if user_id:
        await asyncio.gather(
            save_ai_conversation(user_id, payload.session_id, "user", payload.message),
            save_ai_conversation(user_id, payload.session_id, "assistant", answer_text)
        )

    suggested = get_suggested_questions(target_measurement)

    return {
        "answer": answer_text,
        "observation": answer_text,
        "analysis_type": "LLM_CONVERSATIONAL",
        "target_measurement": target_measurement,
        "historical_context": historical_summary,
        "suggested_questions": suggested
    }


@router.post("/chat/stream")
async def assistant_chat_stream(
    payload: AssistantChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Server-Sent Events (SSE) streaming endpoint for real-time progressive answer display.
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="User message cannot be empty.")

    logger.info(f"[ASSISTANT STREAM ROUTE] Received streaming request | message: '{payload.message}' | user_id: {user_id}")

    target_measurement, historical_summary = await resolve_measurement_and_history(payload, user_id)

    messages = []
    if payload.conversation_history:
        for m in payload.conversation_history:
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": payload.message})

    if user_id:
        await save_ai_conversation(user_id, payload.session_id, "user", payload.message)

    async def event_generator():
        collected_chunks = []
        async for sse_chunk in generate_chat_response_stream(messages, target_measurement, historical_summary):
            if "data: {" in sse_chunk:
                try:
                    data_json = json.loads(sse_chunk.replace("data: ", "").strip())
                    if "content" in data_json:
                        collected_chunks.append(data_json["content"])
                except Exception:
                    pass
            yield sse_chunk
        
        # Save complete assistant response after stream finishes
        if user_id and collected_chunks:
            full_msg = "".join(collected_chunks)
            await save_ai_conversation(user_id, payload.session_id, "assistant", full_msg)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/insights")
async def assistant_insights(
    measurement_id: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Returns structured performance, latency, stability, and comparison insights.
    """
    target_measurement = None
    if measurement_id and user_id:
        target_measurement = await get_measurement_by_id(measurement_id, user_id)

    historical_summary = await get_user_historical_summary(user_id) if user_id else {"total_tests": 0}
    insights_data = await generate_insights(target_measurement, historical_summary)
    return insights_data


@router.get("/history")
async def assistant_history(
    limit: int = Query(30, ge=1, le=100),
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Returns previous AI conversations for the authenticated user (RWS & RLS compliant).
    """
    if not user_id:
        return {"conversations": []}

    conversations = await get_ai_conversations(user_id, limit=limit)
    return {"conversations": conversations}
