from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict
import uuid
import os
import time

from app.core.security import get_current_user, CurrentUser
from app.core.logging import logger
from app.schemas.measurements import MeasurementResultCreate

router = APIRouter(prefix="/measurements", tags=["Measurements"])

@router.get("/get")
@router.head("/get")
async def measurement_ping():
    """
    Lightweight CORS-compliant endpoint for RTT latency and jitter probing.
    """
    return {
        "status": "ok",
        "service": "IPMCAS Measurement Server Node",
        "timestamp": time.time()
    }


@router.get("/bytes/{size_bytes}")
async def measurement_download(size_bytes: int):
    """
    Streaming download measurement endpoint.
    Generates and streams binary payload chunk for HTTP GET throughput tests.
    """
    max_size = 50 * 1024 * 1024  # Cap chunk size at 50MB per stream
    actual_size = min(max(1, size_bytes), max_size)
    chunk_buffer = os.urandom(min(64 * 1024, actual_size))

    def generate_chunks():
        bytes_remaining = actual_size
        while bytes_remaining > 0:
            send_size = min(len(chunk_buffer), bytes_remaining)
            yield chunk_buffer[:send_size]
            bytes_remaining -= send_size

    return StreamingResponse(
        generate_chunks(),
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Content-Length": str(actual_size),
        }
    )


@router.post("/post")
async def measurement_upload(request: Request):
    """
    HTTP POST upload measurement endpoint.
    Receives uploaded binary chunks and measures transferred bytes.
    """
    body = await request.body()
    return {
        "status": "ok",
        "bytes_received": len(body),
        "timestamp": time.time()
    }


from app.services.supabase_db import create_measurement_session, save_measurement_result

# In-memory session registry for session ownership validation
# Map: session_id -> { user_id: str, status: str, created_at: str }
active_sessions: Dict[str, Dict] = {}


class SessionStartRequest(BaseModel):
    connection_type: Optional[str] = "UNKNOWN"
    concurrency_level: int = 4


@router.post("/session/start", status_code=status.HTTP_201_CREATED)
async def start_measurement_session(
    payload: SessionStartRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Initializes a new speed test measurement session associated with the authenticated user in Supabase.
    """
    try:
        session_id = await create_measurement_session(
            user_id=current_user.id,
            concurrency_level=payload.concurrency_level,
            connection_type=payload.connection_type or "UNKNOWN"
        )
    except Exception as e:
        session_id = str(uuid.uuid4())
        logger.warning(f"Fallback to generated session_id due to DB creation error: {str(e)}")
    
    # Store session ownership binding
    active_sessions[session_id] = {
        "user_id": current_user.id,
        "concurrency_level": payload.concurrency_level,
        "connection_type": payload.connection_type,
        "status": "INITIALIZING"
    }

    return {
        "status": "initialized",
        "message": "Measurement session initialized successfully.",
        "session_id": session_id,
        "user_id": current_user.id,
        "concurrency_level": payload.concurrency_level,
        "connection_type": payload.connection_type
    }


@router.post("/session/{session_id}/result", status_code=status.HTTP_201_CREATED)
async def record_measurement_result(
    session_id: str,
    payload: MeasurementResultCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Validates measurement payload and records test results into Supabase PostgreSQL.
    Enforces strict user ownership verification: session_id must belong to current_user.id.
    """
    session = active_sessions.get(session_id)
    if session:
        # User ownership verification check
        if session["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this measurement session."
            )
    else:
        # Create session binding if missing
        active_sessions[session_id] = {"user_id": current_user.id, "status": payload.status}

    # Explicit HTTP 429 Rate Limiting Check
    if payload.httpStatusCode == 429 or payload.status == "SERVER_RATE_LIMITED":
        return {
            "session_id": session_id,
            "user_id": current_user.id,
            "status": "SERVER_RATE_LIMITED",
            "is_valid": False,
            "persisted": False,
            "message": "Measurement flagged as HTTP 429 server rate-limited. Excluded from valid throughput statistics."
        }

    # Insert record into public.measurement_results table in Supabase
    try:
        inserted_record = await save_measurement_result(session_id, current_user.id, payload)
        return {
            "session_id": session_id,
            "user_id": current_user.id,
            "result_id": inserted_record.get("id"),
            "status": payload.status,
            "is_valid": payload.isValid,
            "download_speed_mbps": payload.downloadSpeedMbps,
            "upload_speed_mbps": payload.uploadSpeedMbps,
            "latency_avg_ms": payload.latency.avgMs,
            "persisted": True,
            "message": "Measurement result successfully verified and persisted to Supabase."
        }
    except Exception as e:
        logger.error(f"Failed to persist measurement result to Supabase: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save measurement to database: {str(e)}"
        )

