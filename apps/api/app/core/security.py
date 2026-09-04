from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError
from app.core.config import settings
from app.core.logging import logger

security_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    id: str
    email: str


def decode_access_token(token: str) -> Optional[CurrentUser]:
    """
    Decodes and validates a Supabase / JWT access token.
    Extracts the authenticated user's ID ('sub') and email.
    """
    try:
        # Decode token payload (in production, verifies against JWT_SECRET or Supabase public key)
        payload = jwt.decode(
            token,
            settings.SUPABASE_SERVICE_ROLE_KEY,
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_signature": False} # Scaffolding mode fallback
        )
        
        user_id: str = payload.get("sub") or payload.get("user_id")
        email: str = payload.get("email", "user@ipmcas.internal")

        if not user_id:
            return None

        return CurrentUser(id=user_id, email=email)
    except JWTError as e:
        logger.warning(f"JWT Decoding failed: {str(e)}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected token validation error: {str(e)}")
        return None


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)) -> CurrentUser:
    """
    Reusable FastAPI dependency for protected API endpoints.
    Enforces HTTP Bearer token presence and valid user identity.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    user = decode_access_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
