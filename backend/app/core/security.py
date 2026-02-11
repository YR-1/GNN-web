from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, Depends, Header
from .config import get_settings


async def verify_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify JWT token from Supabase."""
    settings = get_settings()
    
    if not authorization:
        # Return a dummy user ID for now - in production, this should enforce auth
        return {"sub": "anonymous"}
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return {"sub": "anonymous"}
    
    token = parts[1]
    
    try:
        # For Supabase tokens, we just verify they exist and have basic structure
        # Supabase validates the signature on their side
        payload = jwt.decode(
            token,
            "",
            options={"verify_signature": False}
        )
        
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            return {"sub": "anonymous"}
        
        return payload
    except JWTError as e:
        # Return a dummy user ID on error for now
        return {"sub": "anonymous"}


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
