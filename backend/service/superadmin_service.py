import logging
from typing import Dict, List
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from models.models import (
    HospitalMaster,
    HospitalRole,
    HospitalRolePermission,
    Users,
    UserDetails,
    HospitalUserRoles,
    RoleMaster,
    RolePermission,
    PermissionMaster,
    t_doctor_hospitals,
    PatientHospitals,
)
from schema.schema import OnboardHospitalAdminIn, OnboardHospitalAdminOut
from utils.validators import validate_email, validate_password
from utils.utils import generate_passwd_hash
from centralisedErrorHandling.ErrorHandling import ValidationError


def get_default_permissions_for_role(role_name: str) -> List[str]:
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


async def ensure_tenant_roles_and_permissions(
    db: AsyncSession,
    hospital_id: int,
    role_names: List[str],
) -> Dict[str, HospitalRole]:
    created_or_existing: Dict[str, HospitalRole] = {}
    try:
        for rn in role_names:
            # 1) Reuse existing tenant role if present
            q = await db.execute(
                select(HospitalRole).where(
                    HospitalRole.hospital_id == hospital_id,
                    HospitalRole.role_name == rn
                )
            )
            existing_hr = q.scalar_one_or_none()
            if existing_hr:
                created_or_existing[rn] = existing_hr
                logger.debug("Reusing existing tenant role '%s' for hospital %s", rn, hospital_id)
                continue

            # 2) Create new HospitalRole
            new_hr = HospitalRole(
                hospital_id=int(hospital_id),
                role_name=rn,
                description=f"default {rn} role for hospital {hospital_id}"
            )
            db.add(new_hr)
            await db.flush()  
            created_or_existing[rn] = new_hr
            logger.info("Created tenant role '%s' (id=%s) for hospital %s", rn, new_hr.hospital_role_id, hospital_id)

            # 3) Assign default permissions based on role type
            default_permissions = get_default_permissions_for_role(rn)
            
            if not default_permissions:
                logger.warning("No default permissions defined for role '%s'; skipping permission assignment", rn)
                continue

            # Get permission IDs for the default permissions
            perm_q = await db.execute(
                select(PermissionMaster.permission_id).where(
                    PermissionMaster.permission_name.in_(default_permissions)
                )
            )
            perm_id_tuples = perm_q.all()
            perm_ids = [pid for (pid,) in perm_id_tuples if pid is not None]

            if not perm_ids:
                logger.warning("No permission IDs found for role '%s' permissions: %s", rn, default_permissions)
                continue

            # 4) Avoid duplicates: fetch existing permission ids for this new_hr
            existing_perm_q = await db.execute(
                select(HospitalRolePermission.permission_id)
                .where(HospitalRolePermission.hospital_role_id == new_hr.hospital_role_id)
            )
            existing_perm_ids = set(pid for (pid,) in existing_perm_q.all())

            to_insert = [pid for pid in perm_ids if pid not in existing_perm_ids]
            for pid in to_insert:
                hrp = HospitalRolePermission(
                    hospital_role_id=int(new_hr.hospital_role_id),
                    permission_id=int(pid)
                )
                db.add(hrp)

            if to_insert:
                await db.flush()
                logger.info("Assigned %d default permissions to tenant role '%s' (hospital %s)", len(to_insert), rn, hospital_id)
            else:
                logger.debug("All default permissions already present for tenant role '%s' (hospital %s)", rn, hospital_id)

        return created_or_existing

    except SQLAlchemyError as se:
        logger.exception("DB error while ensuring tenant roles/permissions for hospital %s", hospital_id)
        raise
    except ValueError as ve:
        logger.error("Invalid data while ensuring tenant roles/permissions for hospital %s: %s", hospital_id, ve)
        raise



logger = logging.getLogger(__name__)

async def create_hospital_with_admin(
    db: AsyncSession,
    payload: OnboardHospitalAdminIn,
    actor_user: Dict | None = None,  # optional info about who performed action (super_admin)
) -> OnboardHospitalAdminOut:
    """
    Create a hospital and a hospital_admin user in same operation.
    DOES NOT use `async with db.begin()` — uses explicit flush/commit/rollback.
    """
    # Validate incoming fields
    try:
        hospital_name = payload.hospital_name.strip()
        admin_email = payload.admin_email  # Skip validation for now
        admin_username = payload.admin_username or admin_email.split("@")[0]
        admin_password = validate_password(payload.admin_password)
        admin_first = payload.admin_first_name or None
        admin_last = payload.admin_last_name or None
        admin_phone = payload.admin_phone or None
    except ValidationError as ve:
        # convert to HTTP-friendly response (ValidationError raised by validators)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))

    try:
        # Uniqueness checks (friendly client errors)
        q = await db.execute(select(HospitalMaster).where(HospitalMaster.hospital_name == hospital_name))
        if q.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Hospital with this name already exists")

        q = await db.execute(select(Users).where(Users.email == admin_email))
        if q.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")

        q = await db.execute(select(Users).where(Users.username == admin_username))
        if q.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this username already exists")

        # 1) Create hospital row
        hospital = HospitalMaster(
            hospital_name=hospital_name,
            hospital_email=admin_email,
            admin_contact=admin_phone,
            address=payload.admin_first_name or None,
        )
        db.add(hospital)
        await db.flush()  # populates hospital.hospital_id

        # 2) Ensure tenant roles exist and copy permissions (idempotent helper)
        default_tenant_roles = ["hospital_admin", "doctor", "patient"]
        created_tenant_roles = await ensure_tenant_roles_and_permissions(db, int(hospital.hospital_id), default_tenant_roles)

        # 3) Create hospital_admin user (global role 'hospital_admin' must exist)
        role_q = await db.execute(select(RoleMaster).where(RoleMaster.role_name == "hospital_admin"))
        global_hospital_admin_role = role_q.scalar_one_or_none()
        if not global_hospital_admin_role:
            # mis-seed
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Global role 'hospital_admin' not found. Please seed role_master.")

        hashed = generate_passwd_hash(admin_password)
        user = Users(
            username=admin_username,
            email=admin_email,
            password_hash=hashed,
            global_role_id=int(global_hospital_admin_role.role_id)
        )
        db.add(user)
        await db.flush()  # populate user.user_id

        # 4) user_details
        ud = UserDetails(
            user_id=int(user.user_id),
            first_name=admin_first,
            last_name=admin_last,
            phone=admin_phone
        )
        db.add(ud)
        await db.flush()

        # 5) Link user -> tenant hospital_role (hospital_admin role for this hospital)
        tenant_hr = created_tenant_roles.get("hospital_admin")
        if not tenant_hr:
            # this should not happen since helper creates/reuses, but guard anyway
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Tenant hospital_admin role missing for created hospital")

        hur = HospitalUserRoles(
            hospital_id=int(hospital.hospital_id),
            user_id=int(user.user_id),
            hospital_role_id=int(tenant_hr.hospital_role_id),
            is_active=1
        )
        db.add(hur)
        await db.flush()

        # 6) commit all changes
        await db.commit()

        # 7) Build response
        return OnboardHospitalAdminOut(
            hospital_id=int(hospital.hospital_id),
            hospital_name=hospital.hospital_name,
            hospital_email=hospital.hospital_email,
            admin_user_id=int(user.user_id),
            admin_username=user.username,
            admin_email=user.email,
            access_token=None,
            refresh_token=None,
            expires_in=None
        )

    except HTTPException:
        # rollback and rethrow client errors
        try:
            await db.rollback()
        except Exception:
            pass
        raise

    except IntegrityError as ie:
        logger.exception("DB integrity error while onboarding hospital admin: %s", ie)
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database integrity error during onboarding")

    except SQLAlchemyError as e:
        logger.exception("Database error in create_hospital_with_admin")
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error during onboarding")
    



async def create_user_for_hospital_by_superadmin(
    db: AsyncSession,
    hospital_id: int,
    user_type: str,  # 'doctor' or 'patient'
    payload: dict,
    actor_user: Dict | None = None,
):
    """
    Super Admin creates a doctor/patient and assigns to a hospital.
    1. Creates user + user_details
    2. Sets global_role_id based on user_type
    3. Links to hospital via hospital_user_roles + doctor_hospitals/patient_hospitals
    """

    valid_types = ["doctor", "patient"]
    if user_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user_type '{user_type}'. Allowed: {valid_types}",
        )

    try:
        # Validate hospital existence
        hospital_q = await db.execute(select(HospitalMaster).where(HospitalMaster.hospital_id == hospital_id))
        hospital = hospital_q.scalar_one_or_none()
        if not hospital:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found")

        # Validate inputs
        email = payload.get("email")  # Skip validation for now
        username = payload.get("username") or email.split("@")[0]
        password = validate_password(payload.get("password"))
        first_name = payload.get("first_name")
        last_name = payload.get("last_name")
        phone = payload.get("phone")

        # Check uniqueness
        q = await db.execute(select(Users).where(Users.email == email))
        if q.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")

        q = await db.execute(select(Users).where(Users.username == username))
        if q.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this username already exists")

        # Fetch global role_id (doctor/patient)
        role_q = await db.execute(select(RoleMaster).where(RoleMaster.role_name == user_type))
        global_role = role_q.scalar_one_or_none()
        if not global_role:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=f"Global role '{user_type}' not found in role_master")

        # Ensure tenant role exists with proper permissions
        created_tenant_roles = await ensure_tenant_roles_and_permissions(db, hospital_id, [user_type])
        tenant_hr = created_tenant_roles.get(user_type)
        if not tenant_hr:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=f"Failed to create tenant role '{user_type}' for hospital {hospital_id}")

        # Create user
        hashed_pwd = generate_passwd_hash(password)
        user = Users(
            username=username,
            email=email,
            password_hash=hashed_pwd,
            global_role_id=int(global_role.role_id),
        )
        db.add(user)
        await db.flush()  # populate user_id

        # Create user details
        details = UserDetails(
            user_id=int(user.user_id),
            first_name=first_name,
            last_name=last_name,
            phone=phone,
        )
        db.add(details)
        await db.flush()

        # Create hospital_user_roles mapping
        hur = HospitalUserRoles(
            hospital_id=hospital_id,
            user_id=int(user.user_id),
            hospital_role_id=int(tenant_hr.hospital_role_id),
            is_active=1
        )
        db.add(hur)
        await db.flush()

        # Add specific table mapping (doctor_hospitals / patient_hospitals)
        if user_type == "doctor":
            from sqlalchemy import insert
            stmt = insert(t_doctor_hospitals).values(user_id=int(user.user_id), hospital_id=hospital_id)
            await db.execute(stmt)
        elif user_type == "patient":
            patient_entry = PatientHospitals(user_id=int(user.user_id), hospital_id=hospital_id)
            db.add(patient_entry)

        await db.commit()

        return {
            "user_id": int(user.user_id),
            "username": user.username,
            "email": user.email,
            "global_role": user_type,
            "hospital_id": hospital_id,
            "tenant_role": user_type,
        }

    except HTTPException:
        try:
            await db.rollback()
        except Exception:
            pass
        raise

    except IntegrityError as ie:
        logger.exception("Integrity error while creating %s for hospital %s: %s", user_type, hospital_id, ie)
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database integrity error")

    except Exception as e:
        logger.exception("Unexpected error while creating %s for hospital %s: %s", user_type, hospital_id, e)
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Unexpected error during user creation")


async def assign_permissions_to_all_doctors(db: AsyncSession) -> Dict:
    """
    Assign required permissions to all doctors in the system.
    This function ensures all doctors have the necessary permissions to access their profiles.
    """
    try:
        # Required permissions for doctors
        required_permissions = [
            'doctor.profile.view',
            'doctor.profile.update',
            'doctor.patients.list',
            'doctor.patient.view',
            'doctor.patient.consultations.list',
            'doctor.analytics.patients',
            'doctor.consultations.monthly',
            'upload.profile_image',
            'upload.profile_audio'
        ]
        
        results = {
            'total_doctors': 0,
            'successful': 0,
            'failed': 0,
            'skipped': 0,
            'errors': []
        }
        
        # Get all doctors
        doctors_q = await db.execute(
            select(Users).where(Users.global_role_id.in_(
                select(RoleMaster.role_id).where(RoleMaster.role_name == 'doctor')
            ))
        )
        doctors = doctors_q.scalars().all()
        results['total_doctors'] = len(doctors)
        
        logger.info(f"Processing {len(doctors)} doctors for permission assignment")
        
        for doctor in doctors:
            try:
                # Check if doctor has hospital assignment
                if not doctor.hospital_id:
                    logger.warning(f"Doctor {doctor.email} has no hospital_id, skipping")
                    results['skipped'] += 1
                    continue
                
                # Ensure hospital has doctor role
                hr_q = await db.execute(
                    select(HospitalRole).where(
                        HospitalRole.hospital_id == doctor.hospital_id,
                        HospitalRole.role_name == 'doctor'
                    )
                )
                hospital_role = hr_q.scalar_one_or_none()
                
                if not hospital_role:
                    # Create doctor role for this hospital
                    hospital_role = HospitalRole(
                        hospital_id=doctor.hospital_id,
                        role_name='doctor',
                        description=f'Doctor role for hospital {doctor.hospital_id}'
                    )
                    db.add(hospital_role)
                    await db.flush()
                    logger.info(f"Created doctor role for hospital {doctor.hospital_id}")
                
                # Assign permissions to role
                for permission_name in required_permissions:
                    # Get permission ID
                    perm_q = await db.execute(
                        select(PermissionMaster.permission_id).where(
                            PermissionMaster.permission_name == permission_name
                        )
                    )
                    permission_id = perm_q.scalar_one_or_none()
                    
                    if permission_id:
                        # Check if permission already assigned
                        existing_q = await db.execute(
                            select(HospitalRolePermission).where(
                                HospitalRolePermission.hospital_role_id == hospital_role.hospital_role_id,
                                HospitalRolePermission.permission_id == permission_id
                            )
                        )
                        existing = existing_q.scalar_one_or_none()
                        
                        if not existing:
                            hrp = HospitalRolePermission(
                                hospital_role_id=hospital_role.hospital_role_id,
                                permission_id=permission_id
                            )
                            db.add(hrp)
                
                # Assign doctor to hospital role
                hur_q = await db.execute(
                    select(HospitalUserRoles).where(
                        HospitalUserRoles.user_id == doctor.user_id,
                        HospitalUserRoles.hospital_role_id == hospital_role.hospital_role_id
                    )
                )
                existing_assignment = hur_q.scalar_one_or_none()
                
                if not existing_assignment:
                    hur = HospitalUserRoles(
                        hospital_id=doctor.hospital_id,
                        user_id=doctor.user_id,
                        hospital_role_id=hospital_role.hospital_role_id,
                        is_active=1
                    )
                    db.add(hur)
                
                await db.commit()
                results['successful'] += 1
                logger.info(f"Assigned permissions to doctor {doctor.email}")
                
            except Exception as e:
                results['failed'] += 1
                error_msg = f"Failed to assign permissions to doctor {doctor.email}: {str(e)}"
                results['errors'].append(error_msg)
                logger.error(error_msg)
                await db.rollback()
        
        logger.info(f"Permission assignment completed: {results}")
        return results
        
    except Exception as e:
        logger.error(f"Fatal error in permission assignment: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign doctor permissions: {str(e)}"
        )


async def get_doctor_permissions_status(db: AsyncSession) -> Dict:
    """
    Get the current status of doctor permissions across the system.
    """
    try:
        # Get all doctors and their permission status
        result = await db.execute(
            select(
                Users.user_id,
                Users.email,
                Users.first_name,
                Users.last_name,
                Users.hospital_id,
                HospitalMaster.hospital_name,
                HospitalRolePermission.permission_id,
                PermissionMaster.permission_name
            )
            .select_from(Users)
            .join(RoleMaster, Users.global_role_id == RoleMaster.role_id)
            .outerjoin(HospitalMaster, Users.hospital_id == HospitalMaster.hospital_id)
            .outerjoin(HospitalUserRoles, Users.user_id == HospitalUserRoles.user_id)
            .outerjoin(HospitalRole, HospitalUserRoles.hospital_role_id == HospitalRole.hospital_role_id)
            .outerjoin(HospitalRolePermission, HospitalRole.hospital_role_id == HospitalRolePermission.hospital_role_id)
            .outerjoin(PermissionMaster, HospitalRolePermission.permission_id == PermissionMaster.permission_id)
            .where(RoleMaster.role_name == 'doctor')
        )
        
        doctors_data = {}
        for row in result:
            user_id = row.user_id
            if user_id not in doctors_data:
                doctors_data[user_id] = {
                    'user_id': user_id,
                    'email': row.email,
                    'first_name': row.first_name,
                    'last_name': row.last_name,
                    'hospital_id': row.hospital_id,
                    'hospital_name': row.hospital_name,
                    'permissions': []
                }
            
            if row.permission_name:
                doctors_data[user_id]['permissions'].append(row.permission_name)
        
        doctors = list(doctors_data.values())
        
        # Calculate summary statistics
        total_doctors = len(doctors)
        required_permissions = [
            'doctor.profile.view',
            'doctor.profile.update',
            'doctor.patients.list',
            'doctor.patient.view',
            'doctor.patient.consultations.list',
            'doctor.analytics.patients',
            'doctor.consultations.monthly',
            'upload.profile_image',
            'upload.profile_audio'
        ]
        
        doctors_with_all_permissions = len([
            d for d in doctors 
            if all(perm in d['permissions'] for perm in required_permissions)
        ])
        
        doctors_with_some_permissions = len([
            d for d in doctors 
            if any(perm in d['permissions'] for perm in required_permissions)
        ])
        
        doctors_with_no_permissions = total_doctors - doctors_with_some_permissions
        
        return {
            "summary": {
                "total_doctors": total_doctors,
                "doctors_with_all_permissions": doctors_with_all_permissions,
                "doctors_with_some_permissions": doctors_with_some_permissions,
                "doctors_with_no_permissions": doctors_with_no_permissions,
                "completion_percentage": round((doctors_with_all_permissions / total_doctors * 100) if total_doctors > 0 else 0, 2)
            },
            "doctors": doctors
        }
        
    except Exception as e:
        logger.error(f"Error getting doctor permissions status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get doctor permissions status: {str(e)}"
        )