from fastapi import APIRouter, Depends, Path, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from schema.schema import HospitalAdminCreateUserIn, HospitalAdminCreateUserOut, CreateHospitalRoleIn, CreateHospitalRoleOut, AssignPermissionsIn, UserRead
from database.database import get_db
from dependencies.dependencies import require_hospital_roles, get_current_user
from service.hospital_admin_service import hospital_admin_create_user, create_custom_hospital_role, assign_permissions_to_hospital_role
from models.models import Users, Consultation, HospitalUserRoles, HospitalRole
from typing import Dict, Any
import logging

router = APIRouter(
    prefix="/hospital-admin",
    tags=["Hospital Admin"],
)

@router.get("/profile", response_model=UserRead)
async def get_hospital_admin_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get hospital admin profile information
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
            is_active=user.is_active,
            created_at=user.created_at.isoformat() if user.created_at else None,
            updated_at=user.updated_at.isoformat() if user.updated_at else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")

@router.post(
    "/hospitals/{hospital_id}/users",
    response_model=HospitalAdminCreateUserOut,
    summary="Hospital Admin creates doctor/nurse/patient",
)
async def create_hospital_user(
    hospital_id: int = Path(...),
    payload: HospitalAdminCreateUserIn = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id", allow_super_admin= True))
):
    result = await hospital_admin_create_user(db, actor_user=current_user, hospital_id=hospital_id, payload=payload.dict())
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
    """
    Assign permissions to a hospital role.
    Accepts either permission_ids or permission_names.
    """
    logger = logging.getLogger(__name__)
    
    # Convert permission names to IDs if names are provided
    permission_ids = payload.permission_ids or []
    
    if payload.permission_names:
        from models.models import PermissionMaster
        logger.info(f"🔍 Converting {len(payload.permission_names)} permission names to IDs")
        
        # Fetch permission IDs for the given names
        perm_query = select(PermissionMaster.permission_id).where(
            PermissionMaster.permission_name.in_(payload.permission_names)
        )
        perm_result = await db.execute(perm_query)
        permission_ids = [row[0] for row in perm_result.all()]
        
        logger.info(f"✅ Found {len(permission_ids)} permission IDs")
        
        if len(permission_ids) != len(payload.permission_names):
            logger.warning(f"⚠️ Some permission names not found in database")
    
    if not permission_ids:
        raise HTTPException(status_code=400, detail="No valid permissions provided")
    
    result = await assign_permissions_to_hospital_role(db, hospital_id, role_id, permission_ids)
    return result


@router.get(
    "/hospitals/{hospital_id}/dashboard-stats",
    response_model=Dict[str, Any],
    summary="Get comprehensive dashboard statistics for hospital admin"
)
async def get_dashboard_statistics(
    hospital_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id", allow_super_admin= True))
):
    """
    Get comprehensive dashboard statistics for hospital admin including:
    - Total consultations (all time, this month, this week)
    - Total users (doctors, patients)
    - User slots (used/available)
    - Consultation hours
    - Active consultations
    """
    try:
        logger = logging.getLogger(__name__)
        logger.info(f"Fetching dashboard stats for hospital_id: {hospital_id}")
        
        from datetime import datetime, timedelta
        
        # Get current date ranges
        now = datetime.now()
        start_of_week = now - timedelta(days=now.weekday())
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Total consultations (all time)
        total_consultations_query = select(func.count(Consultation.consultation_id)).where(
            Consultation.hospital_id == hospital_id
        )
        total_consultations = (await db.execute(total_consultations_query)).scalar() or 0
        
        # Consultations this month
        monthly_consultations_query = select(func.count(Consultation.consultation_id)).where(
            Consultation.hospital_id == hospital_id,
            Consultation.created_at >= start_of_month
        )
        monthly_consultations = (await db.execute(monthly_consultations_query)).scalar() or 0
        
        # Consultations this week
        weekly_consultations_query = select(func.count(Consultation.consultation_id)).where(
            Consultation.hospital_id == hospital_id,
            Consultation.created_at >= start_of_week
        )
        weekly_consultations = (await db.execute(weekly_consultations_query)).scalar() or 0
        
        # Active consultations
        active_consultations_query = select(func.count(Consultation.consultation_id)).where(
            Consultation.hospital_id == hospital_id,
            Consultation.status.in_(["scheduled", "in_progress", "active"])
        )
        active_consultations = (await db.execute(active_consultations_query)).scalar() or 0
        
        # Get total doctors
        doctor_role_query = select(HospitalRole.hospital_role_id).where(
            HospitalRole.hospital_id == hospital_id,
            HospitalRole.role_name == "doctor"
        )
        doctor_role = (await db.execute(doctor_role_query)).scalar_one_or_none()
        
        total_doctors = 0
        if doctor_role:
            doctors_query = select(func.count(HospitalUserRoles.user_id)).where(
                HospitalUserRoles.hospital_id == hospital_id,
                HospitalUserRoles.hospital_role_id == doctor_role,
                HospitalUserRoles.is_active == 1
            )
            total_doctors = (await db.execute(doctors_query)).scalar() or 0
        
        # Get total patients
        patient_role_query = select(HospitalRole.hospital_role_id).where(
            HospitalRole.hospital_id == hospital_id,
            HospitalRole.role_name == "patient"
        )
        patient_role = (await db.execute(patient_role_query)).scalar_one_or_none()
        
        total_patients = 0
        if patient_role:
            patients_query = select(func.count(HospitalUserRoles.user_id)).where(
                HospitalUserRoles.hospital_id == hospital_id,
                HospitalUserRoles.hospital_role_id == patient_role,
                HospitalUserRoles.is_active == 1
            )
            total_patients = (await db.execute(patients_query)).scalar() or 0
        
        # Get total users (all roles)
        total_users_query = select(func.count(func.distinct(HospitalUserRoles.user_id))).where(
            HospitalUserRoles.hospital_id == hospital_id,
            HospitalUserRoles.is_active == 1
        )
        total_users = (await db.execute(total_users_query)).scalar() or 0
        
        # Calculate consultation hours (assuming each consultation is ~30 minutes)
        # You can adjust this based on actual consultation duration in your system
        consultation_hours_monthly = monthly_consultations * 0.5  # 30 minutes per consultation
        
        # Mock subscription data (replace with actual subscription logic when available)
        user_slots_total = 15  # This should come from subscription plan
        user_slots_used = total_users
        user_slots_remaining = max(0, user_slots_total - user_slots_used)
        
        logger.info(f"Dashboard stats fetched successfully for hospital {hospital_id}")
        
        return {
            "hospital_id": hospital_id,
            "consultations": {
                "total": int(total_consultations),
                "monthly": int(monthly_consultations),
                "weekly": int(weekly_consultations),
                "active": int(active_consultations)
            },
            "users": {
                "total": int(total_users),
                "doctors": int(total_doctors),
                "patients": int(total_patients)
            },
            "subscription": {
                "user_slots_total": int(user_slots_total),
                "user_slots_used": int(user_slots_used),
                "user_slots_remaining": int(user_slots_remaining),
                "consultation_hours_monthly": float(consultation_hours_monthly),
                "plan_name": "Pro Plan",  # Mock data - replace with actual subscription
                "plan_status": "active",
                "renewal_days": 12,  # Mock data - replace with actual subscription
                "monthly_cost": 299  # Mock data - replace with actual subscription
            }
        }
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching dashboard stats for hospital {hospital_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard statistics: {str(e)}")


@router.get("/permissions", response_model=list[Dict[str, Any]])
async def list_all_permissions(
    db: AsyncSession = Depends(get_db),
):
    """
    List all available permissions from permission_master table.
    This endpoint is accessible to all authenticated users for form dropdowns.
    """
    try:
        from models.models import PermissionMaster
        logger = logging.getLogger(__name__)
        
        logger.info("🔍 Fetching all permissions from permission_master")
        
        query = select(PermissionMaster).order_by(PermissionMaster.permission_name)
        result = await db.execute(query)
        permissions = result.scalars().all()
        
        permission_list = [
            {
                "permission_id": p.permission_id,
                "permission_name": p.permission_name,
                "description": p.description or ""
            }
            for p in permissions
        ]
        
        logger.info(f"✅ Found {len(permission_list)} permissions")
        return permission_list
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"❌ Error fetching permissions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch permissions: {str(e)}")
