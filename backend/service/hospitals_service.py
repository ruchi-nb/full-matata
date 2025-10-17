from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DisconnectionError,
    InvalidRequestError
)
from models.models import HospitalMaster, Specialties, Users, HospitalUserRoles, DoctorSpecialties, HospitalSpecialties, RoleMaster
from centralisedErrorHandling.ErrorHandling import (
    DatabaseError,
    ValidationError,
    DataIntegrityError,
    ConnectionError,
    TransactionError,
    ResourceNotFoundError
)
import logging

logger = logging.getLogger(__name__)


async def _safe_rollback(db: AsyncSession, context: str) -> None:
    """Safely attempt database rollback with error handling"""
    try:
        await db.rollback()
        logger.info(f"Successfully rolled back transaction for {context}")
    except InvalidRequestError as e:
        logger.warning(f"Rollback skipped - no transaction active for {context}: {e}")
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection lost during rollback for {context}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during rollback for {context}: {e}", exc_info=True)


async def get_hospital_profile(db: AsyncSession, hospital_id: int) -> Optional[HospitalMaster]:
    try:
        row = await db.get(HospitalMaster, int(hospital_id))
        return row
    except Exception as e:
        raise DatabaseError("Failed to fetch hospital profile", operation="select", table="hospital_master", original_error=e)


async def update_hospital_profile(db: AsyncSession, hospital_id: int, update_data: Dict[str, Any]) -> HospitalMaster:
    try:
        hospital: Optional[HospitalMaster] = await db.get(HospitalMaster, int(hospital_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch hospital", operation="select", table="hospital_master", original_error=e)

    if not hospital:
        raise ValidationError("Hospital not found", field="hospital_id", value=hospital_id)

    allowed = {"hospital_name", "hospital_email", "admin_contact", "address"}
    changed = False
    for k, v in (update_data or {}).items():
        if k in allowed and getattr(hospital, k) != v:
            setattr(hospital, k, v)
            changed = True

    if not changed:
        return hospital

    try:
        db.add(hospital)
        await db.commit()
        await db.refresh(hospital)
        return hospital
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_master")
        logger.error(f"Unexpected error in update_hospital_profile: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update hospital profile",
            operation="update",
            table="hospital_master",
            original_error=e,
            context={"hospital_id": hospital_id}
        )


async def list_specialities(db: AsyncSession, limit: int = 500) -> List[Specialties]:
    """Return hardcoded specialties instead of database query"""
    # Hardcoded specialties based on seeded data
    hardcoded_specialties = [
        Specialties(specialty_id=1, name="Cardiology", description="Heart and cardiovascular health", status="active"),
        Specialties(specialty_id=2, name="Dermatology", description="Skin, hair, and nail care", status="active"),
        Specialties(specialty_id=3, name="General Medicine", description="Primary healthcare and wellness", status="active"),
        Specialties(specialty_id=4, name="Pediatrics", description="Healthcare for children and adolescents", status="active"),
        Specialties(specialty_id=5, name="Orthopedics", description="Bone, joint, and muscle care", status="active"),
        Specialties(specialty_id=6, name="Neurology", description="Brain and nervous system care", status="active"),
        Specialties(specialty_id=7, name="Oncology", description="Cancer diagnosis and treatment", status="active"),
        Specialties(specialty_id=8, name="Psychiatry", description="Mental health and behavioral disorders", status="active"),
    ]
    
    # Apply limit if specified
    if limit and limit < len(hardcoded_specialties):
        return hardcoded_specialties[:limit]
    
    return hardcoded_specialties


async def create_speciality(db: AsyncSession, *, name: str, description: Optional[str] = None, status: Optional[str] = "active") -> Specialties:
    if not name or not isinstance(name, str) or not name.strip():
        raise ValidationError("name is required", field="name")

    new_row = Specialties(name=name.strip(), description=description, status=status or "active")
    try:
        db.add(new_row)
        await db.commit()
        await db.refresh(new_row)
        return new_row
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "specialties")
        logger.error(f"Unexpected error in create_speciality: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to create specialty",
            operation="insert",
            table="specialties",
            original_error=e,
            context={"name": name}
        )


async def update_speciality(db: AsyncSession, specialty_id: int, *, name: Optional[str] = None, description: Optional[str] = None, status: Optional[str] = None) -> Specialties:
    try:
        row: Optional[Specialties] = await db.get(Specialties, int(specialty_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch specialty", operation="select", table="specialties", original_error=e)

    if not row:
        raise ValidationError("Specialty not found", field="specialty_id", value=specialty_id)

    changed = False
    if name is not None and name.strip() and row.name != name.strip():
        row.name = name.strip()
        changed = True
    if description is not None and row.description != description:
        row.description = description
        changed = True
    if status is not None and row.status != status:
        row.status = status
        changed = True

    if not changed:
        return row

    try:
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "specialties")
        logger.error(f"Unexpected error in update_speciality: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update specialty",
            operation="update",
            table="specialties",
            original_error=e,
            context={"specialty_id": specialty_id}
        )


async def delete_speciality(db: AsyncSession, specialty_id: int) -> None:
    try:
        row: Optional[Specialties] = await db.get(Specialties, int(specialty_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch specialty", operation="select", table="specialties", original_error=e)

    if not row:
        # treat as idempotent delete
        return

    try:
        await db.delete(row)
        await db.commit()
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "specialties")
        logger.error(f"Unexpected error in delete_speciality: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to delete specialty",
            operation="delete",
            table="specialties",
            original_error=e,
            context={"specialty_id": specialty_id}
        )


# -----------------------------
# Doctor lifecycle (hospital)
# -----------------------------

async def add_doctor_to_hospital(
    db: AsyncSession,
    *,
    hospital_id: int,
    doctor_user_id: int,
    hospital_role_id: Optional[int] = None,
) -> HospitalUserRoles:
    try:
        user = await db.get(Users, int(doctor_user_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch user", operation="select", table="users", original_error=e)
    if not user:
        raise ValidationError("Doctor user not found", field="doctor_user_id", value=doctor_user_id)

    if hospital_role_id is None:
        raise ValidationError("hospital_role_id is required", field="hospital_role_id")

    try:
        # If a mapping for user and hospital exists with any role, keep a single active mapping; update role if provided
        q = select(HospitalUserRoles).where(
            and_(
                HospitalUserRoles.hospital_id == int(hospital_id),
                HospitalUserRoles.user_id == int(doctor_user_id),
            )
        )
        res = await db.execute(q)
        hur = res.scalars().first()
        if hur:
            if hospital_role_id is not None:
                hur.hospital_role_id = int(hospital_role_id)
            hur.is_active = 1
            db.add(hur)
            await db.commit()
            await db.refresh(hur)
            return hur

        # create new mapping
        new_hur = HospitalUserRoles(
            hospital_id=int(hospital_id),
            user_id=int(doctor_user_id),
            hospital_role_id=int(hospital_role_id),
            is_active=1,
        )
        db.add(new_hur)
        await db.commit()
        await db.refresh(new_hur)
        return new_hur
    except (ValidationError, DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_user_roles")
        logger.error(f"Unexpected error in add_doctor_to_hospital: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to add doctor to hospital",
            operation="insert",
            table="hospital_user_roles",
            original_error=e,
            context={"hospital_id": hospital_id, "doctor_user_id": doctor_user_id, "hospital_role_id": hospital_role_id}
        )


async def update_doctor_in_hospital(
    db: AsyncSession,
    *,
    hospital_id: int,
    doctor_user_id: int,
    update_fields: Dict[str, Any],
    new_hospital_role_id: Optional[int] = None,
    specialty_ids: Optional[List[int]] = None,
) -> Users:
    try:
        user = await db.get(Users, int(doctor_user_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch user", operation="select", table="users", original_error=e)
    if not user:
        raise ValidationError("Doctor not found", field="doctor_user_id", value=doctor_user_id)

    try:
        # Update mapping role if provided
        if new_hospital_role_id is not None:
            q = select(HospitalUserRoles).where(
                and_(
                    HospitalUserRoles.hospital_id == int(hospital_id),
                    HospitalUserRoles.user_id == int(doctor_user_id),
                )
            )
            res = await db.execute(q)
            hur = res.scalars().first()
            if not hur:
                hur = HospitalUserRoles(
                    hospital_id=int(hospital_id),
                    user_id=int(doctor_user_id),
                    hospital_role_id=int(new_hospital_role_id),
                    is_active=1,
                )
            else:
                hur.hospital_role_id = int(new_hospital_role_id)
                hur.is_active = 1
            db.add(hur)

        # Update specialties if provided: upsert provided and remove others for the doctor
        if specialty_ids is not None:
            # Fetch existing for doctor
            q = select(DoctorSpecialties).where(DoctorSpecialties.user_id == int(doctor_user_id))
            res = await db.execute(q)
            existing = {int(ds.specialty_id): ds for ds in res.scalars().all()}
            keep = set(int(s) for s in specialty_ids)
            # delete removed
            for sid, row in list(existing.items()):
                if sid not in keep:
                    await db.delete(row)
            # add new
            for sid in keep:
                if sid not in existing:
                    db.add(DoctorSpecialties(user_id=int(doctor_user_id), specialty_id=int(sid)))

        # Update basic fields on Users (only username/email allowed here)
        allowed = {"username", "email"}
        changed = False
        for k, v in (update_fields or {}).items():
            if k in allowed and getattr(user, k) != v and v is not None:
                setattr(user, k, v)
                changed = True
        if changed:
            db.add(user)

        await db.commit()
        await db.refresh(user)
        return user
    except (ValidationError, DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "users/hospital_user_roles/doctor_specialties")
        logger.error(f"Unexpected error in update_doctor_in_hospital: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update doctor",
            operation="update",
            table="users/hospital_user_roles/doctor_specialties",
            original_error=e,
            context={"hospital_id": hospital_id, "doctor_user_id": doctor_user_id}
        )


async def remove_doctor_from_hospital(db: AsyncSession, *, hospital_id: int, doctor_user_id: int) -> None:
    try:
        q = select(HospitalUserRoles).where(
            and_(
                HospitalUserRoles.hospital_id == int(hospital_id),
                HospitalUserRoles.user_id == int(doctor_user_id),
            )
        )
        res = await db.execute(q)
        hur = res.scalars().first()
        if not hur:
            return
        await db.delete(hur)
        await db.commit()
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_user_roles")
        logger.error(f"Unexpected error in remove_doctor_from_hospital: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to remove doctor from hospital",
            operation="delete",
            table="hospital_user_roles",
            original_error=e,
            context={"hospital_id": hospital_id, "doctor_user_id": doctor_user_id}
        )


async def get_hospital_users_debug(db: AsyncSession, *, hospital_id: int) -> Dict[str, Any]:
    """
    Debug version to check what's in the hospital_user_roles table
    """
    try:
        from sqlalchemy import select
        from models.models import Users, HospitalUserRoles, RoleMaster, UserDetails, HospitalMaster
        
        # Check if hospital exists
        hospital_check = await db.execute(select(HospitalMaster).where(HospitalMaster.hospital_id == hospital_id))
        hospital = hospital_check.scalar_one_or_none()
        
        # Check hospital_user_roles table
        roles_check = await db.execute(
            select(HospitalUserRoles).where(HospitalUserRoles.hospital_id == hospital_id)
        )
        roles = roles_check.fetchall()
        
        # Get detailed info about users in hospital_user_roles
        detailed_check = await db.execute(
            select(
                Users.user_id,
                Users.username,
                Users.email,
                Users.global_role_id,
                RoleMaster.role_name.label('global_role_name'),
                HospitalUserRoles.hospital_role_id,
                HospitalUserRoles.is_active
            )
            .join(HospitalUserRoles, HospitalUserRoles.user_id == Users.user_id)
            .join(RoleMaster, RoleMaster.role_id == Users.global_role_id)
            .where(HospitalUserRoles.hospital_id == hospital_id)
        )
        detailed_users = detailed_check.fetchall()
        
        return {
            "hospital_exists": hospital is not None,
            "hospital_name": hospital.hospital_name if hospital else None,
            "hospital_user_roles_count": len(roles),
            "hospital_user_roles": [
                {
                    "user_id": r.user_id, 
                    "hospital_id": r.hospital_id, 
                    "hospital_role_id": r.hospital_role_id,
                    "is_active": r.is_active
                } for r in roles
            ],
            "detailed_users": [
                {
                    "user_id": u.user_id,
                    "username": u.username,
                    "email": u.email,
                    "global_role_id": u.global_role_id,
                    "global_role_name": u.global_role_name,
                    "hospital_role_id": u.hospital_role_id,
                    "is_active": u.is_active
                } for u in detailed_users
            ]
        }
        
    except Exception as e:
        return {"error": str(e)}


async def get_hospital_users(db: AsyncSession, *, hospital_id: int, limit: int = 500) -> List[Dict[str, Any]]:
    """
    Get all users associated with a hospital from hospital_user_roles table
    This covers hospital_admin, doctor, and patient roles created by superadmin
    """
    try:
        from sqlalchemy import select
        from models.models import Users, HospitalUserRoles, RoleMaster, UserDetails
        
        # Simple query: get all users from hospital_user_roles table
        q = (
            select(
                Users.user_id,
                Users.username,
                Users.email,
                Users.global_role_id,
                RoleMaster.role_name.label('global_role_name'),
                UserDetails.first_name,
                UserDetails.last_name,
                UserDetails.phone,
                HospitalUserRoles.hospital_role_id,
                HospitalUserRoles.assigned_on
            )
            .join(HospitalUserRoles, HospitalUserRoles.user_id == Users.user_id)
            .join(RoleMaster, RoleMaster.role_id == Users.global_role_id)
            .outerjoin(UserDetails, UserDetails.user_id == Users.user_id)
            .where(
                HospitalUserRoles.hospital_id == hospital_id,
                HospitalUserRoles.is_active == True
            )
            .limit(limit)
        )
        
        res = await db.execute(q)
        rows = res.fetchall()
        
        # Convert to list of dictionaries
        users = []
        for row in rows:
            user_dict = {
                'user_id': row.user_id,
                'username': row.username,
                'email': row.email,
                'global_role_id': row.global_role_id,
                'global_role': {
                    'role_id': row.global_role_id,
                    'role_name': row.global_role_name
                },
                'first_name': row.first_name,
                'last_name': row.last_name,
                'phone': row.phone,
                'hospital_role_id': row.hospital_role_id,
                'assigned_on': row.assigned_on.isoformat() if row.assigned_on else None
            }
            users.append(user_dict)
        
        return users
        
    except Exception as e:
        raise DatabaseError("Failed to get hospital users", operation="select", table="hospital_user_roles", original_error=e)


async def list_hospital_doctors(db: AsyncSession, *, hospital_id: int, limit: int = 500) -> List[Users]:
    try:
        q = (
            select(Users)
            .join(HospitalUserRoles, HospitalUserRoles.user_id == Users.user_id)
            .where(
                and_(
                    HospitalUserRoles.hospital_id == int(hospital_id),
                    HospitalUserRoles.is_active == 1,
                )
            )
            .limit(int(limit))
        )
        res = await db.execute(q)
        return list(res.scalars().all())
    except Exception as e:
        raise DatabaseError("Failed to list hospital doctors", operation="select", table="users/hospital_user_roles", original_error=e)


# -----------------------------
# Hospital Specialties
# -----------------------------

async def add_hospital_specialties(db: AsyncSession, *, hospital_id: int, specialty_ids: List[int]) -> List[HospitalSpecialties]:
    """Add specialties to a hospital"""
    if not specialty_ids:
        return []
    
    try:
        # Validate that all specialties exist
        q = select(Specialties).where(Specialties.specialty_id.in_(specialty_ids))
        res = await db.execute(q)
        existing_specialties = {s.specialty_id for s in res.scalars().all()}
        
        missing_specialties = set(specialty_ids) - existing_specialties
        if missing_specialties:
            raise ValidationError(f"Specialties not found: {missing_specialties}", field="specialty_ids")
        
        # Check for existing hospital-specialty mappings
        q = select(HospitalSpecialties).where(
            and_(
                HospitalSpecialties.hospital_id == int(hospital_id),
                HospitalSpecialties.specialty_id.in_(specialty_ids)
            )
        )
        res = await db.execute(q)
        existing_mappings = {(hs.hospital_id, hs.specialty_id) for hs in res.scalars().all()}
        
        # Create new mappings for specialties not already associated
        new_mappings = []
        for specialty_id in specialty_ids:
            if (int(hospital_id), specialty_id) not in existing_mappings:
                hs = HospitalSpecialties(
                    hospital_id=int(hospital_id),
                    specialty_id=int(specialty_id)
                )
                db.add(hs)
                new_mappings.append(hs)
        
        await db.commit()
        
        # Refresh all mappings to return
        q = select(HospitalSpecialties).where(
            and_(
                HospitalSpecialties.hospital_id == int(hospital_id),
                HospitalSpecialties.specialty_id.in_(specialty_ids)
            )
        )
        res = await db.execute(q)
        return list(res.scalars().all())
        
    except (ValidationError, DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_specialties")
        logger.error(f"Unexpected error in add_hospital_specialties: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to add hospital specialties",
            operation="insert",
            table="hospital_specialties",
            original_error=e,
            context={"hospital_id": hospital_id, "specialty_ids": specialty_ids}
        )


async def list_hospital_specialties(db: AsyncSession, *, hospital_id: int) -> List[Specialties]:
    """List all specialties for a hospital"""
    try:
        q = (
            select(Specialties)
            .join(HospitalSpecialties, HospitalSpecialties.specialty_id == Specialties.specialty_id)
            .where(HospitalSpecialties.hospital_id == int(hospital_id))
        )
        res = await db.execute(q)
        return list(res.scalars().all())
    except Exception as e:
        raise DatabaseError("Failed to list hospital specialties", operation="select", table="specialties/hospital_specialties", original_error=e)


async def remove_hospital_specialties(db: AsyncSession, *, hospital_id: int, specialty_ids: List[int]) -> None:
    """Remove specialties from a hospital"""
    if not specialty_ids:
        return
    
    try:
        q = select(HospitalSpecialties).where(
            and_(
                HospitalSpecialties.hospital_id == int(hospital_id),
                HospitalSpecialties.specialty_id.in_(specialty_ids)
            )
        )
        res = await db.execute(q)
        mappings_to_delete = res.scalars().all()
        
        for mapping in mappings_to_delete:
            await db.delete(mapping)
        
        await db.commit()
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_specialties")
        logger.error(f"Unexpected error in remove_hospital_specialties: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to remove hospital specialties",
            operation="delete",
            table="hospital_specialties",
            original_error=e,
            context={"hospital_id": hospital_id, "specialty_ids": specialty_ids}
        )


# ========================================
# PHASE 1.1: PUBLIC HOSPITAL SEARCH
# ========================================

async def search_hospitals_public(
    db: AsyncSession, 
    query: Optional[str] = None, 
    specialty: Optional[str] = None, 
    city: Optional[str] = None, 
    limit: int = 20, 
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Public hospital search - no authentication required"""
    try:
        from sqlalchemy import func
        
        # Build base query
        base_query = select(HospitalMaster)
        
        # Add filters
        conditions = []
        
        if query:
            conditions.append(
                HospitalMaster.hospital_name.ilike(f"%{query}%")
            )
        
        if city:
            conditions.append(
                HospitalMaster.city.ilike(f"%{city}%")
            )
        
        if specialty:
            # Join with specialties to filter by specialty
            base_query = base_query.join(
                HospitalSpecialties, 
                HospitalMaster.hospital_id == HospitalSpecialties.hospital_id
            ).join(
                Specialties,
                HospitalSpecialties.specialty_id == Specialties.specialty_id
            )
            conditions.append(
                Specialties.specialty_name.ilike(f"%{specialty}%")
            )
        
        if conditions:
            base_query = base_query.where(and_(*conditions))
        
        # Add pagination and ordering
        base_query = base_query.order_by(HospitalMaster.hospital_name).limit(limit).offset(offset)
        
        result = await db.execute(base_query)
        hospitals = result.scalars().all()
        
        # Format results
        formatted_hospitals = []
        for hospital in hospitals:
            # Get doctor count for this hospital
            doctor_count_result = await db.execute(
                select(func.count(Users.user_id))
                .join(HospitalUserRoles, Users.user_id == HospitalUserRoles.user_id)
                .join(RoleMaster, Users.global_role_id == RoleMaster.role_id)
                .where(
                    and_(
                        HospitalUserRoles.hospital_id == hospital.hospital_id,
                        RoleMaster.role_name == "doctor"
                    )
                )
            )
            doctor_count = doctor_count_result.scalar() or 0
            
            # Get specialties for this hospital
            specialties_result = await db.execute(
                select(Specialties.specialty_name)
                .join(HospitalSpecialties, Specialties.specialty_id == HospitalSpecialties.specialty_id)
                .where(HospitalSpecialties.hospital_id == hospital.hospital_id)
            )
            specialties = [row[0] for row in specialties_result.fetchall()]
            
            formatted_hospitals.append({
                "hospital_id": hospital.hospital_id,
                "hospital_name": hospital.hospital_name,
                "address": hospital.address,
                "city": hospital.city,
                "state": hospital.state,
                "pincode": hospital.pincode,
                "phone": hospital.phone,
                "email": hospital.email,
                "website": hospital.website,
                "description": hospital.description,
                "doctor_count": doctor_count,
                "specialties": specialties,
                "is_active": hospital.is_active,
                "created_at": hospital.created_at.isoformat() if hospital.created_at else None,
                "updated_at": hospital.updated_at.isoformat() if hospital.updated_at else None
            })
        
        return formatted_hospitals
    except Exception as e:
        logger.error(f"Error searching hospitals: {e}")
        raise DatabaseError("Failed to search hospitals", operation="select", table="hospital_master", original_error=e)
