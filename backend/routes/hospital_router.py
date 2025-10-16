from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from database.database import get_db
from dependencies.dependencies import require_permissions, ensure_hospital_exists, ensure_hospital_role_belongs_to_hospital
from schema.schema import (
    HospitalProfileOut, HospitalProfileUpdate,
    SpecialityCreate, SpecialityUpdate, SpecialityOut,
    HospitalDoctorAdd, HospitalDoctorUpdate, HospitalDoctorOut
)
from service.hospitals_service import (
    get_hospital_profile, update_hospital_profile,
    list_specialities, create_speciality, update_speciality, delete_speciality,
    add_doctor_to_hospital, update_doctor_in_hospital, remove_doctor_from_hospital, list_hospital_doctors
)
from centralisedErrorHandling.ErrorHandling import DatabaseError, ValidationError
from service.audit_service import create_audit_log
from dependencies.dependencies import ensure_specialties_exist, ensure_user_exists


router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.get("/", response_model=List[HospitalProfileOut])
async def list_hospitals(
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.list"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        from sqlalchemy import select
        from models.models import HospitalMaster
        
        query = select(HospitalMaster).limit(20)
        res = await db.execute(query)
        rows = res.scalars().all()
        
        return [
            HospitalProfileOut(
                hospital_id=int(h.hospital_id),
                hospital_name=h.hospital_name,
                hospital_email=h.hospital_email,
                admin_contact=h.admin_contact,
                address=h.address,
                created_at=h.created_at.isoformat() if h.created_at else None,
                updated_at=h.updated_at.isoformat() if h.updated_at else None,
            ) for h in rows
        ]
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to list hospitals") from de


@router.post("/", response_model=HospitalProfileOut, status_code=status.HTTP_201_CREATED)
async def create_hospital(
    payload: HospitalProfileUpdate,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.create"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        from models.models import HospitalMaster
        
        new_hospital = HospitalMaster(
            hospital_name=payload.hospital_name,
            hospital_email=payload.hospital_email,
            admin_contact=payload.admin_contact,
            address=payload.address
        )
        
        db.add(new_hospital)
        await db.commit()
        await db.refresh(new_hospital)
        
        await create_audit_log(
            db,
            event_type="hospital.create",
            entity_type="hospital",
            entity_id=int(new_hospital.hospital_id),
            user_actor=int(caller.get("user_id")),
            new_values={"hospital_name": new_hospital.hospital_name},
        )
        
        return HospitalProfileOut(
            hospital_id=int(new_hospital.hospital_id),
            hospital_name=new_hospital.hospital_name,
            hospital_email=new_hospital.hospital_email,
            admin_contact=new_hospital.admin_contact,
            address=new_hospital.address,
            created_at=new_hospital.created_at.isoformat() if new_hospital.created_at else None,
            updated_at=new_hospital.updated_at.isoformat() if new_hospital.updated_at else None,
        )
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to create hospital") from de


@router.get("/profile", response_model=HospitalProfileOut)
async def read_hospital_profile(
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.profile.view"], hospital_id_param="hospital_id")),
    hospital_id: int = Depends(ensure_hospital_exists),
    db: AsyncSession = Depends(get_db),
):
    try:
        row = await get_hospital_profile(db, hospital_id)
        if not row:
            raise HTTPException(status_code=404, detail="Hospital not found")
        return HospitalProfileOut(
            hospital_id=int(row.hospital_id),
            hospital_name=row.hospital_name,
            hospital_email=row.hospital_email,
            admin_contact=row.admin_contact,
            address=row.address,
            created_at=row.created_at.isoformat() if row.created_at else None,
            updated_at=row.updated_at.isoformat() if row.updated_at else None,
        )
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to fetch hospital profile") from de


@router.put("/profile", response_model=HospitalProfileOut)
async def put_hospital_profile(
    payload: HospitalProfileUpdate,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.profile.update"], hospital_id_param="hospital_id")),
    hospital_id: int = Depends(ensure_hospital_exists),
    db: AsyncSession = Depends(get_db),
):
    try:
        updated = await update_hospital_profile(db, hospital_id, payload.model_dump(exclude_none=True))
        return HospitalProfileOut(
            hospital_id=int(updated.hospital_id),
            hospital_name=updated.hospital_name,
            hospital_email=updated.hospital_email,
            admin_contact=updated.admin_contact,
            address=updated.address,
            created_at=updated.created_at.isoformat() if updated.created_at else None,
            updated_at=updated.updated_at.isoformat() if updated.updated_at else None,
        )
    except ValidationError as ve:
        raise HTTPException(status_code=404, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to update hospital profile") from de


@router.delete("/{hospital_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hospital(
    hospital_id: int,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.delete"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        from models.models import HospitalMaster
        
        hospital = await db.get(HospitalMaster, hospital_id)
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        await db.delete(hospital)
        await db.commit()
        
        await create_audit_log(
            db,
            event_type="hospital.delete",
            entity_type="hospital",
            entity_id=int(hospital_id),
            user_actor=int(caller.get("user_id")),
            old_values={"hospital_name": hospital.hospital_name},
        )
        
        return {"status": "deleted"}
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to delete hospital") from de


@router.get("/specialities", response_model=list[SpecialityOut])
async def list_all_specialities(
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.specialities.list"], hospital_id_param="hospital_id")),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await list_specialities(db)
        return [SpecialityOut(specialty_id=int(r.specialty_id), name=r.name, description=r.description, status=r.status) for r in rows]
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to list specialties") from de


@router.post("/specialities", response_model=SpecialityOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: SpecialityCreate,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.speciality.create"], hospital_id_param="hospital_id")),
    db: AsyncSession = Depends(get_db),
):
    try:
        created = await create_speciality(db, name=payload.name, description=payload.description)
        await create_audit_log(
            db,
            event_type="speciality.create",
            entity_type="specialty",
            entity_id=int(created.specialty_id),
            user_actor=int(caller.get("user_id")),
            new_values={"name": created.name},
        )
        return SpecialityOut(specialty_id=int(created.specialty_id), name=created.name, description=created.description, status=created.status)
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to create specialty") from de


@router.put("/specialities/{id}", response_model=SpecialityOut)
async def update_department(
    id: int,
    payload: SpecialityUpdate,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.speciality.update"], hospital_id_param="hospital_id")),
    db: AsyncSession = Depends(get_db),
):
    try:
        updated = await update_speciality(db, id, name=payload.name, description=payload.description, status=payload.status)
        await create_audit_log(
            db,
            event_type="speciality.update",
            entity_type="specialty",
            entity_id=int(updated.specialty_id),
            user_actor=int(caller.get("user_id")),
            new_values=payload.model_dump(exclude_none=True),
        )
        return SpecialityOut(specialty_id=int(updated.specialty_id), name=updated.name, description=updated.description, status=updated.status)
    except ValidationError as ve:
        raise HTTPException(status_code=404, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to update specialty") from de


@router.delete("/specialities/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    id: int,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.speciality.delete"], hospital_id_param="hospital_id")),
    db: AsyncSession = Depends(get_db),
):
    try:
        await delete_speciality(db, id)
        await create_audit_log(
            db,
            event_type="speciality.delete",
            entity_type="specialty",
            entity_id=int(id),
            user_actor=int(caller.get("user_id")),
        )
        return {"status": "deleted"}
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to delete specialty") from de


# -----------------------------
# Doctors (hospital scope)
# -----------------------------

@router.post("/doctors", response_model=HospitalDoctorOut, status_code=status.HTTP_201_CREATED)
async def add_doctor(
    payload: HospitalDoctorAdd,
    specialty_ids: Optional[List[int]] = None,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.doctor.create"], hospital_id_param="hospital_id")),
    hospital_id: int = Depends(ensure_hospital_exists),
    db: AsyncSession = Depends(get_db),
):
    try:
        await ensure_user_exists(payload.doctor_user_id, db)
        if specialty_ids:
            await ensure_specialties_exist(specialty_ids, db)
        if payload.hospital_role_id is None:
            raise HTTPException(status_code=422, detail="hospital_role_id is required")
        # ensure role belongs to same hospital
        await ensure_hospital_role_belongs_to_hospital(hospital_id=hospital_id, role_id=int(payload.hospital_role_id), db=db)

        hur = await add_doctor_to_hospital(
            db,
            hospital_id=hospital_id,
            doctor_user_id=payload.doctor_user_id,
            hospital_role_id=payload.hospital_role_id,
        )
        await create_audit_log(
            db,
            event_type="hospital.doctor.add",
            entity_type="user",
            entity_id=int(payload.doctor_user_id),
            user_actor=int(caller.get("user_id")),
            new_values={"hospital_id": hospital_id, "hospital_role_id": payload.hospital_role_id},
        )
        # Also upsert specialties if provided
        if specialty_ids:
            await update_doctor_in_hospital(
                db,
                hospital_id=hospital_id,
                doctor_user_id=payload.doctor_user_id,
                update_fields={},
                specialty_ids=specialty_ids,
            )

        # Read back user for response
        doctors = await list_hospital_doctors(db, hospital_id=hospital_id, limit=1)
        # safer: query the specific user
        from sqlalchemy import select as _select
        from models.models import Users as _Users
        res = await db.execute(_select(_Users).where(_Users.user_id == payload.doctor_user_id))
        doc = res.scalar_one()
        return HospitalDoctorOut(
            user_id=int(doc.user_id),
            username=doc.username,
            email=doc.email,
            global_role_id=int(doc.global_role_id) if doc.global_role_id is not None else None,
        )
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to add doctor") from de


@router.put("/doctors/{id}", response_model=HospitalDoctorOut)
async def update_doctor(
    id: int,
    payload: HospitalDoctorUpdate,
    specialty_ids: Optional[List[int]] = None,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.doctor.update"], hospital_id_param="hospital_id")),
    hospital_id: int = Depends(ensure_hospital_exists),
    db: AsyncSession = Depends(get_db),
):
    try:
        await ensure_user_exists(id, db)
        if specialty_ids:
            await ensure_specialties_exist(specialty_ids, db)

        updated_user = await update_doctor_in_hospital(
            db,
            hospital_id=hospital_id,
            doctor_user_id=id,
            update_fields=payload.model_dump(exclude_none=True),
            specialty_ids=specialty_ids,
        )
        await create_audit_log(
            db,
            event_type="hospital.doctor.update",
            entity_type="user",
            entity_id=int(id),
            user_actor=int(caller.get("user_id")),
            new_values={"hospital_id": hospital_id} | payload.model_dump(exclude_none=True) | ({"specialty_ids": specialty_ids} if specialty_ids else {}),
        )
        return HospitalDoctorOut(
            user_id=int(updated_user.user_id),
            username=updated_user.username,
            email=updated_user.email,
            global_role_id=int(updated_user.global_role_id) if updated_user.global_role_id is not None else None,
        )
    except ValidationError as ve:
        raise HTTPException(status_code=404, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to update doctor") from de


@router.delete("/doctors/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(
    id: int,
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.doctor.delete"], hospital_id_param="hospital_id")),
    hospital_id: int = Depends(ensure_hospital_exists),
    db: AsyncSession = Depends(get_db),
):
    try:
        await remove_doctor_from_hospital(db, hospital_id=hospital_id, doctor_user_id=id)
        await create_audit_log(
            db,
            event_type="hospital.doctor.remove",
            entity_type="user",
            entity_id=int(id),
            user_actor=int(caller.get("user_id")),
            old_values={"hospital_id": hospital_id},
        )
        return {"status": "deleted"}
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to remove doctor") from de


@router.get("/doctors", response_model=List[HospitalDoctorOut])
async def list_doctors(
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.doctors.list"], hospital_id_param="hospital_id")),
    hospital_id: int = Depends(ensure_hospital_exists),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await list_hospital_doctors(db, hospital_id=hospital_id)
        return [
            HospitalDoctorOut(
                user_id=int(u.user_id),
                username=u.username,
                email=u.email,
                global_role_id=int(u.global_role_id) if u.global_role_id is not None else None,
            ) for u in rows
        ]
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to list doctors") from de

