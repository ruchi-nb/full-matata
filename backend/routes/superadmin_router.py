# file: backend/routes/superadmin_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from typing import Dict, Any
from database.database import get_db
from schema.schema import (
    OnboardHospitalAdminIn, OnboardHospitalAdminOut, 
    SuperAdminCreateUserIn, SuperAdminCreateUserOut,
    UserRead  # ✅ Using UserRead instead of UserProfileOut
)
from fastapi import Path, Body
from dependencies.dependencies import require_global_roles
from service.superadmin_service import (
    create_hospital_with_admin,
    create_user_for_hospital_by_superadmin,
    assign_permissions_to_all_doctors,
    get_doctor_permissions_status
)
from models.models import Users  # ✅ Only need Users model now

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/superadmin",
    tags=["Super Admin"],
)


@router.post(
    "/onboard/hospital_admin",
    response_model=OnboardHospitalAdminOut,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a hospital and its hospital_admin user",
    description="""
    **Super Admin Only**

    This endpoint:
    - Creates a new hospital.
    - Automatically generates default tenant roles (`hospital_admin`, `doctor`, `patient`).
    - Copies permissions from global roles to these tenant roles.
    - Creates a hospital_admin user and assigns them to the hospital.

     *No tokens are returned; this is an admin-only onboarding flow.*
    """,
)
async def onboard_hospital_admin(
    payload: OnboardHospitalAdminIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_global_roles(role_names=["superadmin"], allow_super_admin=True)),
):
    """
    Create a hospital and its admin.
    Only accessible to super_admins.
    """
    try:
        logger.info(
            "SuperAdmin %s onboarding new hospital: %s",
            current_user.get("user_id", "unknown"),
            payload.hospital_name,
        )

        result = await create_hospital_with_admin(db=db, payload=payload, actor_user=current_user)

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "message": "Hospital and admin created successfully.",
                "data": result.model_dump() if hasattr(result, "model_dump") else result.dict(),
            },
        )

    except HTTPException as http_ex:
        # Raise as-is to preserve HTTP status
        raise http_ex
    except Exception as e:
        logger.exception("Unexpected error during hospital onboarding: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during hospital onboarding.",
        )


@router.post(
    "/hospitals/{hospital_id}/users",
    response_model=SuperAdminCreateUserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a doctor/patient for a specific hospital",
    description="""
    **Super Admin Only**
    - Creates a user of type `doctor` or `patient`.
    - Automatically associates the user with a hospital.
    - Assigns the correct global_role and tenant_role.
    """
)
async def create_user_for_hospital(
    hospital_id: int = Path(..., description="Target hospital ID"),
    payload: SuperAdminCreateUserIn = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_global_roles(role_names=["superadmin"], allow_super_admin=True)),
):
    """
    Create doctor/patient and associate with hospital.
    """
    try:
        result = await create_user_for_hospital_by_superadmin(
            db=db,
            hospital_id=hospital_id,
            user_type=payload.user_type,
            payload=payload.model_dump(),
            actor_user=current_user
        )

        return SuperAdminCreateUserOut(**result)

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error creating user for hospital: %s", e)
        raise HTTPException(status_code=500, detail="Unexpected server error")
    

@router.get("/profile", response_model=UserRead)
async def get_superadmin_profile(
    current_user: dict = Depends(require_global_roles(role_names=["superadmin"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get superadmin profile
    """
    try:
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        user = await db.get(Users, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserRead(
            user_id=user.user_id,
            username=user.username,
            email=user.email,
            global_role_id=user.global_role_id,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch superadmin profile: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch profile")


@router.post("/assign-doctor-permissions")
async def assign_permissions_to_all_doctors_endpoint(
    current_user: dict = Depends(require_global_roles(role_names=["superadmin"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign required permissions to all doctors in the system.
    This endpoint can be called by superadmins to fix permission issues.
    """
    try:
        logger.info(
            "SuperAdmin %s assigning permissions to all doctors",
            current_user.get("user_id", "unknown"),
        )

        results = await assign_permissions_to_all_doctors(db)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Doctor permissions assignment completed",
                "results": results,
                "success": results['failed'] == 0
            },
        )

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.exception("Unexpected error during permission assignment: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during permission assignment.",
        )


@router.get("/doctor-permissions-status")
async def get_doctor_permissions_status_endpoint(
    current_user: dict = Depends(require_global_roles(role_names=["superadmin"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the current status of doctor permissions across the system.
    """
    try:
        status_data = await get_doctor_permissions_status(db)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Doctor permissions status retrieved successfully",
                "data": status_data
            },
        )

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.exception("Unexpected error getting permissions status: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while getting permissions status.",
        )