from fastapi.security import HTTPBearer
from fastapi import Request, status, Depends, HTTPException
from typing import Callable, Iterable, Optional, Any, Dict, Sequence, Set, List
from database.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, union_all
from utils.utils import decode_token
from database.redis import token_in_blocklist
import json
import logging
from database.redis import _redis_client
from models.models import (
    Users,
    RoleMaster,
    RolePermission,
    PermissionMaster,
    HospitalUserRoles,
    HospitalRolePermission,
    UserPermissions,
    HospitalMaster,
    Specialties,
    HospitalRole
)
import asyncio
from redis.exceptions import ConnectionError, TimeoutError

CACHE_TTL = 60  # Reduced from 120 to 60 seconds for better performance 

logger = logging.getLogger(__name__)

def _normalize_perm(p: str) -> str:
    return p.strip().lower()


def _get_hospital_id_from_request(request: Request, hospital_id_param: str) -> Optional[int]:
    hospital_id: Optional[int] = None
    if hospital_id_param:
        if hospital_id_param in request.path_params:
            try:
                hid = int(request.path_params[hospital_id_param])
                if hid > 0:
                    hospital_id = hid
            except (TypeError, ValueError):
                hospital_id = None
        elif hospital_id_param in request.query_params:
            try:
                hid = int(request.query_params[hospital_id_param])
                if hid > 0:
                    hospital_id = hid
            except (TypeError, ValueError):
                hospital_id = None
    return hospital_id

def is_super_admin(user: Dict[str, Any]) -> bool:
    if not user or not isinstance(user, dict):
        return False
    global_role = user.get("global_role")
    if not isinstance(global_role, dict):
        return False
    rname = global_role.get("role_name")
    return isinstance(rname, str) and rname.strip().lower() == "superadmin"

class TokenBearer(HTTPBearer):
    async def __call__(self, request: Request) -> Dict[str, Any] | None:
        creds = await super().__call__(request)
        token = creds.credentials if creds else None
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication token")
        if not isinstance(token, str) or not token.strip():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
        token_data = decode_token(token)
        if token_data is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Invalid or expired token", "resolution": "Please authenticate again"})
        jti = token_data.get("jti")
        if jti and await token_in_blocklist(jti):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Token has been revoked", "resolution": "Please authenticate again"})
        self.verify_token_data(token_data)
        user_data = token_data.get("user")
        user_id = user_data.get("user_id") if isinstance(user_data, dict) else None
        if not isinstance(user_id, int) or user_id <= 0:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identifier in token")
        return token_data

    def token_valid(self, token: str) -> bool:
        token_data = decode_token(token)
        return token_data is not None

    def verify_token_data(self, token_data):
        raise NotImplementedError

class AccessTokenBearer(TokenBearer):
    def verify_token_data(self, token_data: dict) -> None:
        if token_data and token_data.get("refresh"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required, refresh provided")

class RefreshTokenBearer(TokenBearer):
    def verify_token_data(self, token_data: dict) -> None:
        if token_data and not token_data.get("refresh"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required, access token provided")


async def get_current_user(token_details: dict = Depends(AccessTokenBearer())) -> Dict[str, Any]:
    if not token_details:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No valid token provided")
    user_payload = token_details.get("user")
    if not user_payload or not isinstance(user_payload, dict):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user data in token")
    user_id = user_payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identifier")
    return user_payload


def require_global_roles(role_names: Optional[Iterable[str]] = None, role_ids: Optional[Iterable[int]] = None, allow_super_admin: bool = True) -> Callable:
    role_names_set: Set[str] = set(n.strip().lower() for n in (role_names or []) if isinstance(n, str) and n.strip())
    role_ids_set: Set[int] = set(r for r in (role_ids or []) if isinstance(r, int) and r > 0)

    async def dependency(user: Dict[str, Any] = Depends(get_current_user)):
        if allow_super_admin and is_super_admin(user):
            logger.info(f"Superadmin bypass (role check) for user {user.get('user_id')}")
            return user
        if not role_names_set and not role_ids_set:
            return user
        user_role = user.get("global_role")
        if not isinstance(user_role, dict):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no global role assigned")
        if role_ids_set:
            rid = user_role.get("role_id")
            if isinstance(rid, int) and rid in role_ids_set:
                return user
        if role_names_set:
            rname = user_role.get("role_name")
            if isinstance(rname, str) and rname.strip().lower() in role_names_set:
                return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role privileges")
    return dependency


def require_role(role_names: Iterable[str], *, allow_super_admin: bool = True) -> Callable:
    role_names_set: Set[str] = set(n.strip().lower() for n in (role_names or []) if isinstance(n, str) and n.strip())

    async def dependency(user: Dict[str, Any] = Depends(get_current_user)):
        if allow_super_admin and is_super_admin(user):
            return user
        if not role_names_set:
            return user
        user_role = user.get("global_role")
        if not isinstance(user_role, dict):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no global role assigned")
        rname = user_role.get("role_name")
        if isinstance(rname, str) and rname.strip().lower() in role_names_set:
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role privileges")
    return dependency


def require_patient(allow_super_admin: bool = False) -> Callable:
    return require_role(["patient"], allow_super_admin=allow_super_admin)


def require_doctor(allow_super_admin: bool = False) -> Callable:
    return require_role(["doctor"], allow_super_admin=allow_super_admin)


def require_hospital_roles(*, role_names: Iterable[str], hospital_id_param: str = "hospitalId", allow_super_admin: bool = True) -> Callable:
    want: Set[str] = set(n.strip().lower() for n in (role_names or []) if isinstance(n, str) and n.strip())

    async def dependency(request: Request, user: Dict[str, Any] = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        if allow_super_admin and is_super_admin(user):
            return user
        user_id = user.get("user_id")
        if not isinstance(user_id, int) or user_id <= 0:
            raise HTTPException(status_code=401, detail="Invalid user")

        hospital_id = _get_hospital_id_from_request(request, hospital_id_param)
        if hospital_id is None:
            raise HTTPException(status_code=422, detail="Missing or invalid hospital id")

        try:
            q = (
                select(HospitalRole.role_name)
                .join(HospitalUserRoles, HospitalUserRoles.hospital_role_id == HospitalRole.hospital_role_id)
                .where(
                    HospitalUserRoles.user_id == user_id,
                    HospitalUserRoles.hospital_id == hospital_id,
                    HospitalUserRoles.is_active == True,
                    HospitalRole.is_active == True,
                )
            )
            res = await db.execute(q)
            names = set((r or "").strip().lower() for r in res.scalars().all() if r)
        except Exception:
            logger.exception("Failed to fetch hospital roles for user %s hospital %s", user_id, hospital_id)
            raise HTTPException(status_code=500, detail="Permission check failed")

        if not want or names.intersection(want):
            return user
        raise HTTPException(status_code=403, detail="Insufficient hospital role privileges")
    return dependency



async def get_user_permissions(
        user_id: int, 
        db: AsyncSession, 
        hospital_id: Optional[int] = None) -> Set[str]:
    cache_chabbhi = f"user:{user_id}:hospital:{hospital_id or 'global'}:perms"  

    # Try to get from Redis cache, but don't fail if Redis is unavailable
    try:
        cached = await _redis_client.get(cache_chabbhi)
        if cached:
            return set(json.loads(cached))
    except Exception as e:
        logger.debug(f"Redis cache read failed for user {user_id}: {e}")
    
    direct_q = (
        select(UserPermissions.permission_name).where(UserPermissions.user_id == user_id)
    )
    global_q = (select(PermissionMaster.permission_name).join(RolePermission, RolePermission.permission_id == PermissionMaster.permission_id)
        .join(RoleMaster, RoleMaster.role_id == RolePermission.role_id)
        .where(RoleMaster.role_id == Users.global_role_id))
    
    hospital_q = (select(PermissionMaster.permission_name).join(HospitalRolePermission, HospitalRolePermission.permission_id == PermissionMaster.permission_id)
     .join(HospitalUserRoles, HospitalUserRoles.hospital_role_id == HospitalRolePermission.hospital_role_id)
     .where(HospitalUserRoles.user_id == user_id))
    
    if hospital_id:
        hospital_q = hospital_q.where(HospitalUserRoles.hospital_id == hospital_id)
    final_q = union_all(direct_q, global_q, hospital_q)

    execution = await db.execute(final_q)
    perms = set(p.strip().lower() for p in execution.scalars().all() if p)

    # Try to cache in Redis, but don't fail if Redis is unavailable
    try:
        await _redis_client.set(cache_chabbhi, json.dumps(list(perms)), ex=CACHE_TTL)
    except Exception as e:
        logger.debug(f"Redis cache write failed for user {user_id}: {e}")
    
    return perms

def require_permissions(permissions: Sequence[str], scope: Optional[str] = None, hospital_id_param: str = "hospital_id", allow_super_admin: bool = True) -> Callable:
    required = {_normalize_perm(p) for p in permissions}

    async def dependency(request: Request, user: Dict[str, Any] = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        if allow_super_admin and is_super_admin(user):
            return user
        
        user_id = user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")

        hospital_id = _get_hospital_id_from_request(request, hospital_id_param)

        cache_key = f"permcheck:user:{user_id}:hospital:{hospital_id or 'global'}:{','.join(sorted(required))}"
        
        # Try to get from Redis cache, but don't fail if Redis is unavailable
        try:
            cached = await _redis_client.get(cache_key)
            if cached:
                result = json.loads(cached)
                if result["allowed"]:
                    return user
                raise HTTPException(status_code=403, detail=f"Missing permissions: {sorted(result['missing'])}")
        except Exception as e:
            logger.debug(f"Redis permission cache read failed for user {user_id}: {e}")

        
        found = await get_user_permissions(user_id, db, hospital_id=hospital_id)

        
        missing = required - found
        if missing:
            # Try to cache the failure, but don't fail if Redis is unavailable
            try:
                await _redis_client.set(cache_key, json.dumps({"allowed": False, "missing": list(missing)}), ex=CACHE_TTL)
            except Exception as e:
                logger.debug(f"Redis permission cache write failed for user {user_id}: {e}")
            raise HTTPException(status_code=403, detail=f"Missing permissions: {sorted(missing)}")
        
        # Try to cache the success, but don't fail if Redis is unavailable
        try:
            await _redis_client.set(cache_key, json.dumps({"allowed": True}), ex=CACHE_TTL)
        except Exception as e:
            logger.debug(f"Redis permission cache write failed for user {user_id}: {e}")
        
        logger.info(f"Permission check passed for user {user_id}")
        return user
    return dependency

"""
STALE PERMISSION INVALIDATION
"""
async def invalidate_user_permission_from_cache(user_id: int, hospital_id: Optional[int]= None):
    hospital_key = hospital_id or "global"
    perms_key = f"user:{user_id}:hospital:{hospital_key}:perms"
    await _redis_client.delete(perms_key)
    logger.info(f"Permission cache invalidated for user {user_id} and hospital {hospital_id}")
    pattern_for_permcheck = f"permcheck:user:{user_id}:hospital:{hospital_key}:*"
    async for key in _redis_client.scan_iter(match=pattern_for_permcheck):
        await _redis_client.delete(key)

"""
bulk wala invalidation agar saarey invalidate hojaye toh 
"""
async def invalidate_hospital_role_cache(hospital_role_id: int, hospital_id: int, db: AsyncSession):
    q = select(HospitalUserRoles.user_id).where(HospitalUserRoles.hospital_role_id == hospital_role_id)
    res = await db.execute(q)
    for (user_id,) in res.all():
        await invalidate_user_permission_from_cache(user_id, hospital_id=hospital_id)

"""

ye helper function use karna hai consistency match.

"""
async def ensure_hospital_exists(hospital_id: int, db: AsyncSession = Depends(get_db))-> int:
    if not hospital_id or int(hospital_id) <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid hai id")
    try:
        row = await db.get(HospitalMaster, hospital_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Hospital {hospital_id} not found")
        return int(hospital_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching hospital {hospital_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

async def ensure_specialties_exist(specialty_ids: Iterable[int], db: AsyncSession = Depends(get_db)) -> List[int]:
    ids = [int(x) for x in specialty_ids if x is not None]
    if not ids:
        return []
    try:
        q = select(Specialties.specialty_id).where(Specialties.specialty_id.in_(ids))
        res = await db.execute(q)
        found = set(res.scalars().all() or [])
        missing = sorted([i for i in ids if i not in found])
        if missing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "Missing specialties", "missing_ids": missing}
            )
        return list(found)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking specialties: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


async def ensure_user_exists(user_id: int, db: AsyncSession = Depends(get_db)) -> int:
    if not user_id or int(user_id) <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid user id")
    try:
        row = await db.get(Users, user_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")
        return int(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

async def ensure_hospital_role_belongs_to_hospital(
        hospital_id: int,
        role_id:int,
        db: AsyncSession = Depends(get_db)
):
    q = await db.execute(select(HospitalRole).where(HospitalRole.hospital_role_id == role_id,
                                                     HospitalRole.hospital_id == hospital_id,
                                                     HospitalRole.is_active == True)) 
    hr = q.scalar_one_or_none()
    if not hr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Hospital role {role_id} not found in hospital {hospital_id}")
    return hr

async def ensure_user_belongs_to_hospital(user_id: int, hospital_id:int, db: AsyncSession = Depends(get_db)):
    q = await db.execute(select(HospitalUserRoles).where(HospitalUserRoles.user_id == user_id,
                                                         HospitalUserRoles.hospital_id == hospital_id,
                                                         HospitalUserRoles.is_active == True))
           
    hru = q.scalar_one_or_none()
    if not hru:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found in hospital {hospital_id}")
    return hru