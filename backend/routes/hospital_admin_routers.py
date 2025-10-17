from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from schema.schema import HospitalAdminCreateUserIn, HospitalAdminCreateUserOut, CreateHospitalRoleIn, CreateHospitalRoleOut, AssignPermissionsIn, HospitalRoleOut
from database.database import get_db
from dependencies.dependencies import require_hospital_roles, get_current_user
from service.hospital_admin_service import hospital_admin_create_user, create_custom_hospital_role, assign_permissions_to_hospital_role, list_hospital_roles

router = APIRouter(
    prefix="/hospital-admin",
    tags=["Hospital Admin"],
)

@router.post(
    "/hospitals/{hospital_id}/users",
    response_model=HospitalAdminCreateUserOut,
    summary="Hospital Admin creates doctor/nurse/patient",
)
async def create_hospital_user(
    payload: HospitalAdminCreateUserIn,
    hospital_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await hospital_admin_create_user(db, actor_user=current_user, hospital_id=hospital_id, payload=payload.model_dump())
    return HospitalAdminCreateUserOut(**result)

@router.post(
    "/hospitals/{hospital_id}/roles",
    response_model=CreateHospitalRoleOut,
    summary="Hospital Admin creates a custom role"
)
async def create_custom_role(
    hospital_id: int,
    payload: CreateHospitalRoleIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id", allow_super_admin= True))
):
    result = await create_custom_hospital_role(db, hospital_id, payload.model_dump(), current_user)
    return CreateHospitalRoleOut(**result)

@router.get(
    "/hospitals/{hospital_id}/roles",
    response_model=List[HospitalRoleOut],
    summary="List all roles for a hospital"
)
async def list_hospital_roles_endpoint(
    hospital_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id", allow_super_admin=True))
):
    roles = await list_hospital_roles(db, hospital_id)
    return [HospitalRoleOut(**role) for role in roles]


@router.put(
    "/hospitals/{hospital_id}/roles/{role_id}/permissions",
    summary="Hospital Admin assigns permissions to a role"
)
async def assign_permissions(
    hospital_id: int,
    role_id: int,
    payload: AssignPermissionsIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id", allow_super_admin= True))
):
    result = await assign_permissions_to_hospital_role(db, hospital_id, role_id, payload.permission_names)
    return result
