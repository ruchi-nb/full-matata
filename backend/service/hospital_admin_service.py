import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from models.models import (
    Users,
    UserDetails,
    HospitalUserRoles,
    HospitalRole,
    HospitalMaster,
    RoleMaster,
    HospitalRolePermission,
    PermissionMaster,
)
from utils.utils import generate_passwd_hash
from utils.validators import validate_email, validate_name, validate_password

logger = logging.getLogger(__name__)


def get_default_permissions_for_role(role_name: str) -> list:
    """
    Get the default permissions for a specific role.
    This ensures that when roles are created, they get the appropriate permissions.
    """
    default_permissions = {
        'hospital_admin': [
            'hospital.profile.view', 'hospital.profile.update',
            'hospital.specialities.list', 'hospital.speciality.create', 'hospital.speciality.update', 'hospital.speciality.delete',
            'hospital.doctors.list', 'hospital.doctor.create', 'hospital.doctor.update', 'hospital.doctor.delete', 'hospital.doctor.performance.view',
            'hospital.patients.list',
            'doctor.view', 'doctor.profile.view', 'doctor.profile.update',
            'patient.profile.view', 'patient.profile.update',
            'patient.profile.avatar.upload',
            'patient.consultation.list',
            'upload.profile_image', 'upload.profile_audio'
        ],
        'doctor': [
            'doctor.view', 'doctor.profile.view', 'doctor.profile.update',
            'doctor.patients.list', 'doctor.patient.view', 'doctor.patient.consultations.list',
            'patient.consultation.list', 'doctor.analytics.patients', 'doctor.consultations.monthly',
            'upload.profile_image', 'upload.profile_audio', 'appointment.create', 'consultation.start'
        ],
        'patient': [
            'patient.profile.view', 'patient.profile.update', 'patient.profile.avatar.upload',
            'patient.consultation.list', 'appointment.create', 'upload.profile_image'
        ]
    }
    
    return default_permissions.get(role_name, [])


async def hospital_admin_create_user(
    db: AsyncSession,
    actor_user: dict,
    hospital_id: int,
    payload: dict
):
    """
    Hospital Admin creates a new user (doctor/nurse/patient/etc.)
    within their own hospital.
    """

    role_name = payload.get("role_name")
    email = validate_email(payload["email"])
    username = payload.get("username") or email.split("@")[0]
    password = validate_password(payload["password"])
    first_name = payload.get("first_name")
    last_name = payload.get("last_name")
    phone = payload.get("phone")
    specialty = payload.get("specialty")  # For doctors


    # Check if user is superadmin (bypass hospital check) or validate hospital access
    user_role = actor_user.get("global_role", {}).get("role_name")
    if user_role != "superadmin":
        # For hospital admins, check if they belong to this hospital
        admin_hospital_id = actor_user.get("hospital_id")
        if not admin_hospital_id or int(admin_hospital_id) != int(hospital_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="You are not authorized to create users in this hospital")

    
    hospital_q = await db.execute(select(HospitalMaster).where(HospitalMaster.hospital_id == hospital_id))
    hospital = hospital_q.scalar_one_or_none()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found")


    q = await db.execute(select(Users).where(Users.email == email))
    if q.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")

    q = await db.execute(select(Users).where(Users.username == username))
    if q.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this username already exists")


    q = await db.execute(select(HospitalRole).where(
        HospitalRole.hospital_id == hospital_id,
        HospitalRole.role_name == role_name
    ))
    tenant_role = q.scalar_one_or_none()
    if not tenant_role:
        # Create custom tenant role if missing
        tenant_role = HospitalRole(
            hospital_id=hospital_id,
            role_name=role_name,
            description=f"Custom role created by hospital_admin ({actor_user.get('user_id')})"
        )
        db.add(tenant_role)
        await db.flush()
        
        # Assign default permissions to the new role
        default_permissions = get_default_permissions_for_role(role_name)
        if default_permissions:
            # Get permission IDs for the default permissions
            perm_q = await db.execute(
                select(PermissionMaster.permission_id).where(
                    PermissionMaster.permission_name.in_(default_permissions)
                )
            )
            perm_id_tuples = perm_q.all()
            perm_ids = [pid for (pid,) in perm_id_tuples if pid is not None]
            
            # Assign permissions to the role
            for pid in perm_ids:
                hrp = HospitalRolePermission(
                    hospital_role_id=tenant_role.hospital_role_id,
                    permission_id=pid
                )
                db.add(hrp)
            
            await db.flush()
            logger.info("Assigned %d default permissions to new role '%s' for hospital %s", len(perm_ids), role_name, hospital_id)


    # Get global_role_id from role_master based on role_name
    from models.models import RoleMaster
    role_master_query = select(RoleMaster).where(RoleMaster.role_name == role_name)
    role_master_result = await db.execute(role_master_query)
    role_master = role_master_result.scalar_one_or_none()
    
    if not role_master:
        raise ValueError(f"Role '{role_name}' not found in role_master table")
    
    global_role_id = role_master.role_id
    logger.info(f"🔍 Found global_role_id {global_role_id} for role '{role_name}'")
    
    hashed = generate_passwd_hash(password)
    user = Users(
        username=username, 
        email=email, 
        password_hash=hashed,
        global_role_id=global_role_id  # Set global_role_id from role_master
    )
    db.add(user)
    await db.flush()
    logger.info(f"✅ Created user {user.user_id} with global_role_id {global_role_id}")


    ud = UserDetails(user_id=user.user_id, first_name=first_name, last_name=last_name, phone=phone)
    db.add(ud)
    await db.flush()


    hur = HospitalUserRoles(
        hospital_id=hospital_id,
        user_id=user.user_id,
        hospital_role_id=tenant_role.hospital_role_id,
        is_active=True
    )
    db.add(hur)
    await db.flush()

    # Handle specialty assignment for doctors
    if role_name == "doctor" and specialty:
        try:
            from models.models import DoctorSpecialties, Specialties
            
            # Find specialty by name
            specialty_query = select(Specialties).where(Specialties.name == specialty)
            specialty_result = await db.execute(specialty_query)
            specialty_obj = specialty_result.scalar_one_or_none()
            
            if specialty_obj:
                # Create doctor specialty relationship
                doctor_specialty = DoctorSpecialties(
                    user_id=user.user_id,
                    specialty_id=specialty_obj.specialty_id
                )
                db.add(doctor_specialty)
                await db.flush()
                logger.info(f"Assigned specialty '{specialty}' to doctor {user.user_id}")
            else:
                logger.warning(f"Specialty '{specialty}' not found in database")
        except Exception as e:
            logger.error(f"Failed to assign specialty to doctor: {e}")
            # Continue without specialty assignment

    await db.commit()

    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "hospital_id": hospital_id,
        "tenant_role": tenant_role.role_name
    }
async def create_custom_hospital_role(db: AsyncSession, hospital_id: int, payload: dict, actor_user: dict):
    """
    Hospital admin creates a custom role for their hospital.
    """
    role_name = payload["role_name"].lower()
    desc = payload.get("description", None)

    # Verify role doesn't exist already
    q = await db.execute(select(HospitalRole).where(HospitalRole.hospital_id == hospital_id, HospitalRole.role_name == role_name))
    if q.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Role already exists")

    hr = HospitalRole(hospital_id=hospital_id, role_name=role_name, description=desc)
    db.add(hr)
    await db.flush()
    await db.commit()
    return {
        "hospital_role_id": hr.hospital_role_id,
        "hospital_id": hospital_id,
        "role_name": hr.role_name,
        "description": hr.description
    }


async def assign_permissions_to_hospital_role(db: AsyncSession, hospital_id: int, role_id: int, permission_ids: list):
    """
    Assign selected permissions to a hospital-specific role.
    """
    # Verify role belongs to hospital
    q = await db.execute(select(HospitalRole).where(
        HospitalRole.hospital_role_id == role_id,
        HospitalRole.hospital_id == hospital_id
    ))
    hr = q.scalar_one_or_none()
    if not hr:
        raise HTTPException(status_code=404, detail="Role not found for this hospital")

    for pid in permission_ids:
        db.add(HospitalRolePermission(hospital_role_id=role_id, permission_id=pid))

    await db.commit()
    return {"role_id": role_id, "assigned_permissions": len(permission_ids)}
