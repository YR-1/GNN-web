from fastapi import APIRouter, HTTPException, Depends
from ..models.schemas import SignupRequest, LoginRequest, AuthResponse
from ..core.security import create_access_token, verify_token
from ..core.config import get_settings
from supabase import create_client
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Initialize Supabase client
settings = get_settings()
supabase = create_client(settings.supabase_url, settings.supabase_key)


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest) -> AuthResponse:
    """
    User signup with email/password using Supabase Auth.
    """
    if "@" not in request.email:
        raise HTTPException(status_code=400, detail="Invalid email")
    
    try:
        # Sign up with Supabase Auth
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })
        
        user = response.user
        if not user:
            raise HTTPException(status_code=400, detail="Signup failed")
        
        # Create user profile record
        try:
            supabase.table("user_profiles").insert({
                "id": user.id,
                "email": request.email,
            }).execute()
        except Exception as e:
            # Profile might already exist, continue
            pass
        
        # Get session for access token
        session = response.session
        access_token = session.access_token if session else create_access_token({"sub": user.id, "email": request.email})
        
        return AuthResponse(
            access_token=access_token,
            user_id=user.id,
            email=request.email,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest) -> AuthResponse:
    """
    User login with email/password using Supabase Auth.
    """
    try:
        # Sign in with Supabase Auth
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        
        user = response.user
        session = response.session
        
        if not user or not session:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        return AuthResponse(
            access_token=session.access_token,
            user_id=user.id,
            email=request.email,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/logout")
async def logout():
    """Logout endpoint."""
    return {"message": "Logged out successfully"}


@router.post("/refresh")
async def refresh_token(token_data: dict = Depends(verify_token)):
    """Refresh access token."""
    new_token = create_access_token({"sub": token_data.get("sub")})
    return {"access_token": new_token}
