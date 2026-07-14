import logging
import uuid
from datetime import datetime, timezone

from core.auth import hash_password, verify_password
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from models.auth import User
from schemas.auth import (
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
)
from services.auth import AuthService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=UserResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if email is already registered
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash the password and save
    hashed = hash_password(data.password)
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        email=data.email,
        name=data.name,
        hashed_password=hashed,
        role="user",
        last_login=datetime.now(timezone.utc)
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and issue token."""
    logger.info(f"[auth/login] Received login request for email: {data.email}")
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        logger.info(f"[auth/login] User not found for email: {data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    logger.info(f"[auth/login] User found with ID: {user.id}")
    
    pw_matches = verify_password(data.password, user.hashed_password)
    logger.info(f"[auth/login] Password verification matches: {pw_matches}")
    
    if not pw_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Update last login time
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    auth_service = AuthService(db)
    token, expires_at, claims = await auth_service.issue_app_token(user=user)

    return LoginResponse(
        token=token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/logout")
async def logout():
    """Logout user."""
    return {"success": True}
