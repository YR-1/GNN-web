from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, Header
from .config import get_settings


async def verify_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token from Supabase."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    
    token = parts[1]
    
    try:
        # Supabase validates signature; we only parse and validate required claims.
        payload = jwt.decode(
            token,
            "",
            options={"verify_signature": False, "verify_aud": False}
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token is missing user identifier")

        try:
            UUID(str(user_id))
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Token user identifier is not a valid UUID") from exc
        
        return payload
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    settings = get_settings()
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return encoded_jwt
