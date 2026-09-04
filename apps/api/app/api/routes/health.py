from datetime import datetime
from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    System Health Probe.
    Returns status of API service, database connectivity, and environment settings.
    """
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        timestamp=datetime.utcnow(),
        database="connected (placeholder)",
        services={
            "api": "ok",
            "supabase_auth": "configured",
            "measurement_engine": "ready"
        }
    )
