
from typing import Tuple, Dict, Any
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import (
    OperationalError,
    DisconnectionError
)
from database.redis import add_jti_to_blocklist
from utils.utils import create_access_token, verify_password
from centralisedErrorHandling.ErrorHandling import (
    AuthenticationError,
    DatabaseError,
    UserNotFoundError,
    ConnectionError
)
from models.models import Users, RoleMaster
from config import settings
import logging
from google.oauth2 import id_token
from google.auth.transport import requests

logger = logging.getLogger(__name__)

ACCESS_EXPIRE = getattr(settings, "ACCESS_TOKEN_EXPIRY_SECONDS", 4000)
REFRESH_EXPIRE = getattr(settings, "JTI_EXPIRY_SECONDS", 3600)


async def revoke_jti(jti: str) -> None:
    if not jti:
        return
    try:
        await add_jti_to_blocklist(jti)
    except Exception as e:
        # bubble up as domain error so central handler can decide
        logger.error(f"Failed to revoke JTI: {e}")
        raise DatabaseError(
            "Failed to revoke token",
            operation="redis.set",
            table="jti_blocklist",
            original_error=e,
            context={"jti": jti[:10] + "..." if len(jti) > 10 else jti}  # Truncate for security
        )


async def refresh_token_pair(db: AsyncSession, refresh_token_data: Dict[str, Any]) -> Tuple[str, str, int]:
    """
    Refresh token pair using comprehensive user payload with hospital roles and permissions.
    """
    if not refresh_token_data or not isinstance(refresh_token_data, dict):
        raise AuthenticationError("Invalid refresh token payload")

    jti_old = refresh_token_data.get("jti")
    user_payload = refresh_token_data.get("user")
    if not user_payload or not isinstance(user_payload, dict):
        raise AuthenticationError("Invalid refresh token (no user payload)")

    user_id = user_payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        raise AuthenticationError("Invalid user id in refresh token")

    # Verify user exists and rebuild comprehensive payload
    try:
        user = await db.get(Users, int(user_id))
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection error during token refresh: {e}")
        raise ConnectionError(
            "Database connection failed during token refresh",
            operation="refresh_token_user_lookup",
            original_error=e,
            context={"table": "users", "user_id": user_id}
        )
    except Exception as e:
        logger.error(f"Unexpected error verifying user during token refresh: {e}")
        raise DatabaseError(
            "DB error while verifying user during token refresh",
            operation="select",
            table="users",
            original_error=e,
            context={"user_id": user_id}
        )
    if not user:
        logger.warning(f"User not found for refresh: user_id={user_id}")
        raise UserNotFoundError(
            "User not found for refresh",
            user_id=user_id,
            context={"operation": "refresh_token"}
        )

    # Revoke old refresh token jti (best-effort)
    if jti_old:
        try:
            await revoke_jti(jti_old)
        except DatabaseError:
            pass

    # Build fresh comprehensive user payload
    new_user_payload = await build_token_user_payload(db, user)

    access_exp = int(getattr(settings, "ACCESS_TOKEN_EXPIRY_SECONDS", ACCESS_EXPIRE))
    refresh_exp = int(getattr(settings, "JTI_EXPIRY_SECONDS", REFRESH_EXPIRE))

    new_access = create_access_token(new_user_payload, expiry=timedelta(seconds=access_exp), refresh=False)
    new_refresh = create_access_token(new_user_payload, expiry=timedelta(seconds=refresh_exp), refresh=True)

    return new_access, new_refresh, access_exp


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Tuple[str, str, int]:
    try:
        q = select(Users).where(Users.email == email)
        result = await db.execute(q)
        user = result.scalar_one_or_none()
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection error during authentication: {e}")
        raise ConnectionError(
            "Database connection failed during authentication",
            operation="authenticate_user_lookup",
            original_error=e,
            context={"table": "users", "email": email}
        )
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {e}")
        raise DatabaseError(
            "Database error during authentication",
            operation="select",
            table="users",
            original_error=e,
            context={"email": email}
        )
    
    if not user or not verify_password(password, user.password_hash):
        logger.warning(f"Authentication failed for email: {email}")
        raise AuthenticationError(
            "Invalid email or password",
            username=email,
            auth_method="email_password",
            context={"email": email}
        )

    user_payload = {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email
    }
    

    if user.global_role_id:
        role_q = select(RoleMaster).where(RoleMaster.role_id == user.global_role_id)
        role_result = await db.execute(role_q)
        role = role_result.scalar_one_or_none()
        if role:
            user_payload["global_role"] = {
                "role_id": role.role_id,
                "role_name": role.role_name
            }
    
    # Add hospital roles to JWT payload
    try:
        from models.models import HospitalUserRoles, HospitalRole, HospitalMaster
        hospital_roles_query = (
            select(HospitalUserRoles, HospitalRole, HospitalMaster)
            .join(HospitalRole, HospitalRole.hospital_role_id == HospitalUserRoles.hospital_role_id)
            .join(HospitalMaster, HospitalMaster.hospital_id == HospitalUserRoles.hospital_id)
            .where(
                and_(
                    HospitalUserRoles.user_id == user.user_id,
                    HospitalUserRoles.is_active == 1
                )
            )
        )
        hospital_roles_result = await db.execute(hospital_roles_query)
        hospital_roles = hospital_roles_result.all()
        
        if hospital_roles:
            user_payload["hospital_roles"] = [
                {
                    "hospital_id": hur.HospitalUserRoles.hospital_id,
                    "hospital_name": hur.HospitalMaster.hospital_name,
                    "role_id": hur.HospitalUserRoles.hospital_role_id,
                    "role_name": hur.HospitalRole.role_name
                }
                for hur in hospital_roles
            ]
            # For convenience, add the first hospital_id to the root level
            if hospital_roles:
                user_payload["hospital_id"] = hospital_roles[0].HospitalUserRoles.hospital_id
    except Exception as e:
        logger.warning(f"Failed to fetch hospital roles for user {user.user_id}: {e}")
        # Continue without hospital roles
    

    access_exp = int(getattr(settings, "ACCESS_TOKEN_EXPIRY_SECONDS", ACCESS_EXPIRE))
    refresh_exp = int(getattr(settings, "JTI_EXPIRY_SECONDS", REFRESH_EXPIRE))
    
    access_token = create_access_token(user_payload, expiry=timedelta(seconds=access_exp), refresh=False)
    refresh_token = create_access_token(user_payload, expiry=timedelta(seconds=refresh_exp), refresh=True)
    
    return access_token, refresh_token, access_exp


async def authenticate_google_user(db: AsyncSession, google_token: str) -> Tuple[str, str, int]:
    """
    Authenticate user with Google OAuth token and return JWT tokens.
    Includes clock skew tolerance to handle minor time synchronization issues.
    """
    try:
        # Verify the Google token with clock skew tolerance (10 seconds)
        # This handles minor time synchronization differences between client and server
        idinfo = id_token.verify_oauth2_token(
            google_token, 
            requests.Request(), 
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10
        )
        
        # Extract user information from Google token
        google_email = idinfo.get('email')
        google_name = idinfo.get('name', '')
        google_picture = idinfo.get('picture', '')
        
        if not google_email:
            raise AuthenticationError("No email found in Google token")
        
        # Check if user exists in database
        q = select(Users).where(Users.email == google_email)
        result = await db.execute(q)
        user = result.scalar_one_or_none()
        
        if not user:
            # Create new user if doesn't exist
            user = Users(
                email=google_email,
                username=google_name or google_email.split('@')[0],
                password_hash="",  # No password for OAuth users
                global_role_id=1,  # Default to patient role
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
        # Build user payload
        user_payload = await build_token_user_payload(db, user)
        
        access_exp = int(getattr(settings, "ACCESS_TOKEN_EXPIRY_SECONDS", ACCESS_EXPIRE))
        refresh_exp = int(getattr(settings, "JTI_EXPIRY_SECONDS", REFRESH_EXPIRE))
        
        access_token = create_access_token(user_payload, expiry=timedelta(seconds=access_exp), refresh=False)
        refresh_token = create_access_token(user_payload, expiry=timedelta(seconds=refresh_exp), refresh=True)
        
        return access_token, refresh_token, access_exp
        
    except ValueError as e:
        logger.error(f"Invalid Google token: {e}")
        raise AuthenticationError("Invalid Google token")
    except Exception as e:
        logger.error(f"Google authentication error: {e}")
        raise AuthenticationError("Google authentication failed")


async def build_token_user_payload(db: AsyncSession, user: Users) -> Dict[str, Any]:
    """
    Build comprehensive user payload for JWT tokens with hospital roles and permissions.
    """
    user_payload = {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email
    }
    
    # Add global role information
    if user.global_role_id:
        role_q = select(RoleMaster).where(RoleMaster.role_id == user.global_role_id)
        role_result = await db.execute(role_q)
        role = role_result.scalar_one_or_none()
        if role:
            user_payload["global_role"] = {
                "role_id": role.role_id,
                "role_name": role.role_name
            }
    
    return user_payload
