import os
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("ipmcas.llm_service")

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT
# The LLM is instructed to answer the user's exact question using the
# structured measurement context as evidence only.  It MUST NOT generate a
# fixed measurement-summary template.
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are IPMCAS AI, a network performance assistant.

Your primary task is to answer the user's exact question.

Rules:
1. Read the user's question carefully and answer THAT specific question.
2. Use the STRUCTURED MEASUREMENT CONTEXT below as evidence to support your answer.
3. Do NOT begin every response with "Your test measured..." unless the user explicitly asked for a summary.
4. Do NOT produce the same answer regardless of what the user asked.
5. Clearly label what is a measured fact, what is your interpretation, and what is an unknown.
6. Never claim a confirmed technical cause (TCP window scaling, ISP throttling, Wi-Fi interference, server saturation, routing issues, congestion, packet loss) unless that metric is actually present in the measurement data.
7. If a cause cannot be determined from the available data, say so explicitly.
8. For improvement questions: give practical, actionable steps (Ethernet test, rerun at different times, try alternate server node, pause background traffic) without claiming a confirmed fault.
9. For definition questions ("What is jitter?"): define the term first, then reference the measured value.
10. For download-speed questions: report the measured download value and interpret it; do not pivot to latency or upload unless asked.
"""

# ─────────────────────────────────────────────────────────────────────────────
# CLIENT / MODEL RESOLUTION
# ─────────────────────────────────────────────────────────────────────────────
def get_openai_client() -> Optional[AsyncOpenAI]:
    """Returns an AsyncOpenAI-compatible client if a valid API key is configured, else None.

    Priority: GEMINI_API_KEY > OPENAI_API_KEY > LLM_API_KEY.
    When GEMINI_API_KEY is set, automatically routes to the Gemini OpenAI-compatible endpoint.
    """
    gemini_key = (
        os.getenv("GEMINI_API_KEY") or
        getattr(settings, "GEMINI_API_KEY", None)
    )
    openai_key = (
        os.getenv("OPENAI_API_KEY") or
        getattr(settings, "OPENAI_API_KEY", None) or
        os.getenv("LLM_API_KEY") or
        getattr(settings, "LLM_API_KEY", None)
    )

    invalid = {"placeholder-key", "your_openai_api_key_here", "sk-placeholder",
               "your-llm-api-key-here", "placeholder-service-role-key", ""}

    if gemini_key and gemini_key.strip() not in invalid:
        key_clean = gemini_key.strip()
        base_url = (
            os.getenv("GEMINI_BASE_URL") or
            os.getenv("OPENAI_BASE_URL") or
            os.getenv("LLM_BASE_URL") or
            "https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        logger.info("[LLM SERVICE] Using Gemini API via OpenAI-compatible endpoint: %s", base_url)
        return AsyncOpenAI(api_key=key_clean, base_url=base_url)

    if openai_key and openai_key.strip() not in invalid:
        key_clean = openai_key.strip()
        base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("LLM_BASE_URL")
        logger.info("[LLM SERVICE] Using OpenAI API%s", f" with custom base_url={base_url}" if base_url else "")
        if base_url:
            return AsyncOpenAI(api_key=key_clean, base_url=base_url)
        return AsyncOpenAI(api_key=key_clean)

    logger.warning(
        "[LLM SERVICE] No valid LLM API key found in environment. "
        "Set GEMINI_API_KEY (for Gemini) or OPENAI_API_KEY (for OpenAI) "
        "in the Render environment variables."
    )
    return None


def get_model_name() -> str:
    """Returns the configured LLM model name.

    Resolution order:
      1. GEMINI_MODEL env var (when using Gemini)
      2. OPENAI_MODEL / LLM_MODEL env var (generic override)
      3. Automatic default based on which key is active:
         - GEMINI_API_KEY set  ->  gemini-2.0-flash  (stable, widely available Gemini model)
         - OPENAI_API_KEY set  ->  gpt-4o
    """
    configured = (
        os.getenv("GEMINI_MODEL") or
        getattr(settings, "GEMINI_MODEL", None) or
        os.getenv("OPENAI_MODEL") or
        getattr(settings, "OPENAI_MODEL", None) or
        os.getenv("LLM_MODEL") or
        getattr(settings, "LLM_MODEL", None)
    )
    # Only use a configured value if it is not a placeholder default
    if configured and configured not in ("gpt-4o", "placeholder-key"):
        return configured

    gemini_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
    if gemini_key:
        return "gemini-2.0-flash"
    return "gpt-4o"


# ─────────────────────────────────────────────────────────────────────────────
# NETWORK CONTEXT BUILDER
# Formats measurement data as structured text for the LLM system message.
# This is CONTEXT only — the Python layer never reads these values to
# construct the final answer.
# ─────────────────────────────────────────────────────────────────────────────
def build_network_context(
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None,
) -> str:
    """Formats current measurement and historical summary into a structured block for the LLM."""
    sections: List[str] = []

    if current_measurement:
        dl  = current_measurement.get("download_mbps")
        ul  = current_measurement.get("upload_mbps")
        lat = current_measurement.get("latency_ms")
        jit = current_measurement.get("jitter_ms")
        status   = current_measurement.get("status", "unknown")
        server   = current_measurement.get("server_node") or current_measurement.get("server_name") or "IPMCAS Primary Server"
        ts       = current_measurement.get("created_at") or current_measurement.get("timestamp") or "N/A"
        meas_id  = current_measurement.get("id") or current_measurement.get("measurement_id") or "current"

        client_info = current_measurement.get("client_info") or {}
        conn_type   = client_info.get("connection_type") or "unknown"
        browser     = client_info.get("browser") or "unknown"
        os_name     = client_info.get("os") or "unknown"

        dl_str  = f"{dl:.2f} Mbps"  if isinstance(dl,  (int, float)) else "not measured"
        ul_str  = f"{ul:.2f} Mbps"  if isinstance(ul,  (int, float)) else "not measured"
        lat_str = f"{lat:.2f} ms"   if isinstance(lat, (int, float)) else "not measured"
        jit_str = f"{jit:.2f} ms"   if isinstance(jit, (int, float)) else "not measured"

        sections.append(
            f"CURRENT MEASUREMENT (measurement id: {meas_id}):\n"
            f"  Download Speed : {dl_str}\n"
            f"  Upload Speed   : {ul_str}\n"
            f"  Latency (avg)  : {lat_str}\n"
            f"  Jitter         : {jit_str}\n"
            f"  Status         : {status}\n"
            f"  Server         : {server}\n"
            f"  Timestamp      : {ts}\n"
            f"  Connection Type: {conn_type}\n"
            f"  Client         : {browser} on {os_name}"
        )
    else:
        sections.append("CURRENT MEASUREMENT: None selected. Ask the user to run or select a speed test.")

    if historical_summary and historical_summary.get("total_tests", 0) > 0:
        n       = historical_summary.get("total_tests", 0)
        avg_dl  = historical_summary.get("avg_download_mbps")
        avg_ul  = historical_summary.get("avg_upload_mbps")
        avg_lat = historical_summary.get("avg_latency_ms")
        avg_jit = historical_summary.get("avg_jitter_ms")

        avg_dl_s  = f"{avg_dl:.2f} Mbps" if isinstance(avg_dl,  (int, float)) else "unavailable"
        avg_ul_s  = f"{avg_ul:.2f} Mbps" if isinstance(avg_ul,  (int, float)) else "unavailable"
        avg_lat_s = f"{avg_lat:.2f} ms"  if isinstance(avg_lat, (int, float)) else "unavailable"
        avg_jit_s = f"{avg_jit:.2f} ms"  if isinstance(avg_jit, (int, float)) else "unavailable"

        sections.append(
            f"HISTORICAL BASELINE ({n} previous tests):\n"
            f"  Avg Download: {avg_dl_s}\n"
            f"  Avg Upload  : {avg_ul_s}\n"
            f"  Avg Latency : {avg_lat_s}\n"
            f"  Avg Jitter  : {avg_jit_s}"
        )
    else:
        sections.append("HISTORICAL BASELINE: No prior test history available.")

    return "\n\n".join(sections)


# ─────────────────────────────────────────────────────────────────────────────
# CHAT RESPONSE — NON-STREAMING
# The user's message is the last entry in `messages` with role="user".
# The measurement data is in the system message only.
# There is NO Python-level fallback that generates a template answer.
# ─────────────────────────────────────────────────────────────────────────────
async def generate_chat_response(
    messages: List[Dict[str, str]],
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Calls the OpenAI chat completions API and returns the LLM response.

    Raises HTTPException(503) if no API key is configured.
    Raises HTTPException(502) if the OpenAI call fails.

    IMPORTANT: This function does NOT fall back to any Python-generated
    template string.  All answers come from the LLM.
    """
    from fastapi import HTTPException

    client = get_openai_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI Service is unavailable: no valid LLM API key is configured on this server. "
                "Set GEMINI_API_KEY (for Gemini) or OPENAI_API_KEY (for OpenAI) "
                "in the Render environment variables."
            ),
        )

    network_context = build_network_context(current_measurement, historical_summary)
    system_content  = f"{SYSTEM_PROMPT}\n\nSTRUCTURED MEASUREMENT CONTEXT:\n{network_context}"

    # Build the full message list: system first, then the conversation history
    formatted: List[Dict[str, str]] = [{"role": "system", "content": system_content}]
    for m in messages[-10:]:
        formatted.append({"role": m["role"], "content": m["content"]})

    # Log what we are about to send (no secrets)
    last_user_q = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
    )
    logger.info(
        "[LLM FLOW] -> OpenAI | user_question=%r | model=%s | context_len=%d chars",
        last_user_q, get_model_name(), len(system_content),
    )

    try:
        response = await client.chat.completions.create(
            model=get_model_name(),
            messages=formatted,
            temperature=0.4,
            max_tokens=600,
        )
        answer = response.choices[0].message.content or "I could not generate a response."
        logger.info("[LLM FLOW] <- OpenAI | answer_len=%d chars", len(answer))
        return answer

    except Exception as exc:
        logger.error(
            "[LLM FLOW] OpenAI call failed: %s: %s", type(exc).__name__, exc, exc_info=True
        )
        raise HTTPException(
            status_code=502,
            detail=f"AI Service error: LLM provider call failed ({type(exc).__name__}).",
        )


# ─────────────────────────────────────────────────────────────────────────────
# CHAT RESPONSE — STREAMING (SSE)
# Same design: user question goes to the LLM, no Python template fallback.
# ─────────────────────────────────────────────────────────────────────────────
async def generate_chat_response_stream(
    messages: List[Dict[str, str]],
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """
    Streams the OpenAI response as SSE chunks.

    If no API key is configured, emits a single error SSE event instead of
    a Python-generated template answer.
    """
    client = get_openai_client()
    if not client:
        err_msg = (
            "AI Service is unavailable: no valid LLM API key is configured on this server. "
            "Set OPENAI_API_KEY in the Render environment variables."
        )
        yield f"data: {json.dumps({'error': err_msg})}\n\n"
        yield "data: [DONE]\n\n"
        return

    network_context = build_network_context(current_measurement, historical_summary)
    system_content  = f"{SYSTEM_PROMPT}\n\nSTRUCTURED MEASUREMENT CONTEXT:\n{network_context}"

    formatted: List[Dict[str, str]] = [{"role": "system", "content": system_content}]
    for m in messages[-10:]:
        formatted.append({"role": m["role"], "content": m["content"]})

    last_user_q = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
    )
    logger.info(
        "[LLM STREAM] -> OpenAI | user_question=%r | model=%s",
        last_user_q, get_model_name(),
    )

    try:
        stream = await client.chat.completions.create(
            model=get_model_name(),
            messages=formatted,
            temperature=0.4,
            max_tokens=600,
            stream=True,
        )
        chunk_count = 0
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                piece = chunk.choices[0].delta.content
                chunk_count += 1
                yield f"data: {json.dumps({'content': piece})}\n\n"
        logger.info("[LLM STREAM] <- OpenAI | chunks=%d", chunk_count)
        yield "data: [DONE]\n\n"

    except Exception as exc:
        logger.error(
            "[LLM STREAM] OpenAI streaming failed: %s: %s", type(exc).__name__, exc, exc_info=True
        )
        err_msg = f"AI Service error: LLM provider streaming failed ({type(exc).__name__})."
        yield f"data: {json.dumps({'error': err_msg})}\n\n"
        yield "data: [DONE]\n\n"


# ─────────────────────────────────────────────────────────────────────────────
# STRUCTURED INSIGHTS (non-conversational endpoint)
# This endpoint generates structured JSON insights — NOT a chat answer.
# It uses Python logic deliberately because it returns structured fields,
# not a free-text LLM response.
# ─────────────────────────────────────────────────────────────────────────────
async def generate_insights(
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Returns structured performance insight fields based on measurement data."""
    if not current_measurement:
        return {
            "summary": "No active measurement selected.",
            "throughput_status": "Unknown",
            "latency_status": "Unknown",
            "jitter_status": "Unknown",
            "overall_rating": "N/A",
            "historical_comparison": "No active test to compare.",
            "recommended_action": "Run a speed test to generate network insights.",
        }

    dl  = float(current_measurement.get("download_mbps", 0.0) or 0.0)
    ul  = float(current_measurement.get("upload_mbps",   0.0) or 0.0)
    lat = float(current_measurement.get("latency_ms",    0.0) or 0.0)
    jit = float(current_measurement.get("jitter_ms",     0.0) or 0.0)

    dl_status  = "Good" if dl  >= 50 else ("Fair" if dl  >= 15 else "Low")
    lat_status = "Excellent" if lat < 30 else ("Fair" if lat < 100 else "Very High")
    jit_status = "Low"  if jit < 15 else ("Moderate" if jit < 40 else "Very High")

    hist_cmp = "No prior history available for baseline comparison."
    if historical_summary and historical_summary.get("avg_download_mbps"):
        avg_dl = historical_summary["avg_download_mbps"]
        if dl < avg_dl * 0.7:
            hist_cmp = (
                f"Current download ({dl:.2f} Mbps) is significantly below "
                f"your average ({avg_dl:.2f} Mbps)."
            )
        elif dl > avg_dl * 1.2:
            hist_cmp = (
                f"Current download ({dl:.2f} Mbps) is above "
                f"your average ({avg_dl:.2f} Mbps)."
            )
        else:
            hist_cmp = (
                f"Current download ({dl:.2f} Mbps) aligns with "
                f"your historical average ({avg_dl:.2f} Mbps)."
            )

    overall = (
        "Optimal"  if (dl_status == "Good" and lat_status == "Excellent") else
        "Degraded" if (dl_status == "Low"  or  lat_status == "Very High") else
        "Moderate"
    )
    action = (
        "Your connection is performing well."
        if overall == "Optimal"
        else "Rerun the speed test under stable conditions and check local device activity."
    )

    return {
        "summary": (
            f"Test shows {dl:.2f} Mbps download, {ul:.2f} Mbps upload, "
            f"{lat:.2f} ms latency, and {jit:.2f} ms jitter."
        ),
        "throughput_status": dl_status,
        "latency_status":    lat_status,
        "jitter_status":     jit_status,
        "overall_rating":    overall,
        "historical_comparison": hist_cmp,
        "recommended_action":    action,
    }
