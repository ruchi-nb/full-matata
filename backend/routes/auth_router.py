# routers/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from database.database import get_db
from dependencies.dependencies import AccessTokenBearer, RefreshTokenBearer, get_current_user
from service.auth_service import revoke_jti, refresh_token_pair, authenticate_user, authenticate_google_user
from utils.utils import decode_token
from centralisedErrorHandling.ErrorHandling import AuthenticationError, DatabaseError
from schema.schema import LoginIn, TokenOut
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


class GoogleAuthIn(BaseModel):
    credential: str


@router.post("/auth/login", response_model=TokenOut, status_code=status.HTTP_200_OK)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user with email and password, return access and refresh tokens.
    """
    try:
        access_token, refresh_token, expires_in = await authenticate_user(
            db=db, email=payload.email, password=payload.password
        )
        return TokenOut(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in
        )
    except AuthenticationError as ae:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ae))
    except DatabaseError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")


@router.post("/auth/logout", status_code=status.HTTP_200_OK)
async def logout(token_data: dict = Depends(AccessTokenBearer()), db: AsyncSession = Depends(get_db)):
    """
    Revoke current access token's JTI. All authenticated users can call this.
    Access token must be presented in Authorization header (bearer).
    """
    try:
        jti = token_data.get("jti")
        if not jti:
            raise AuthenticationError("Token missing jti")
        await revoke_jti(jti)
        return {"status": "ok", "message": "Logged out (access token revoked)"}
    except AuthenticationError as ae:
        logger.info("Logout failed auth: %s", ae)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ae))
    except DatabaseError as de:
        logger.exception("Logout blocklist failed")
        # still return success? we return 500 so client knows something went wrong
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to revoke token")


@router.post("/auth/refresh-token", status_code=status.HTTP_200_OK)
async def refresh_token(token_data: dict = Depends(RefreshTokenBearer()), db: AsyncSession = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    The incoming token must be a refresh token (RefreshTokenBearer enforces that).
    """
    try:
        # token_data is the decoded refresh token payload (validated by RefreshTokenBearer)
        new_access, new_refresh, expires_in = await refresh_token_pair(db=db, refresh_token_data=token_data)
        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": expires_in,
        }
    except AuthenticationError as ae:
        logger.info("Refresh failed auth: %s", ae)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ae))
    except DatabaseError as de:
        logger.exception("Refresh failed DB error")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to refresh token")


@router.get("/auth/me", status_code=status.HTTP_200_OK)
async def get_current_user_info(token_data: dict = Depends(AccessTokenBearer()), db: AsyncSession = Depends(get_db)):
    """
    Get current user information from the access token.
    This endpoint validates the token and returns user details.
    """
    try:
        # token_data is already validated by AccessTokenBearer
        user_id = token_data.get("sub")
        if not user_id:
            raise AuthenticationError("Token missing user ID")
        
        # Get user details from database
        user = await get_current_user(token_data, db)
        return {
            "user_id": user_id,
            "email": user.get("email"),
            "role": user.get("role"),
            "permissions": user.get("permissions", []),
            "token_valid": True
        }
    except AuthenticationError as ae:
        logger.info("Get user info failed auth: %s", ae)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ae))
    except Exception as e:
        logger.exception("Get user info failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get user info")


@router.post("/auth/google", response_model=TokenOut, status_code=status.HTTP_200_OK)
async def google_auth(payload: GoogleAuthIn, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user with Google OAuth credential, return access and refresh tokens.
    """
    try:
        access_token, refresh_token, expires_in = await authenticate_google_user(
            db=db, google_token=payload.credential
        )
        return TokenOut(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in
        )
    except AuthenticationError as ae:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ae))
    except DatabaseError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google authentication failed")