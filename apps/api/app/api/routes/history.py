from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any
from app.core.security import get_current_user, CurrentUser
from app.services.supabase_db import get_user_measurement_history

router = APIRouter(prefix="/history", tags=["History"])

@router.get("/")
async def get_measurement_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Retrieves paginated historical measurement records for the authenticated user directly from Supabase PostgreSQL.
    Strictly isolated: users cannot access records belonging to another user.
    """
    return await get_user_measurement_history(user_id=current_user.id, limit=limit, page=page)
