from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.database import get_db
from models.models import Users, HospitalMaster, Specialties, RoleMaster
from schema.schema import HospitalDoctorOut, HospitalProfileOut, SpecialityOut
from centralisedErrorHandling.ErrorHandling import DatabaseError


router = APIRouter(prefix="/search", tags=["search"]) 


@router.get("/doctors", response_model=List[HospitalDoctorOut])
async def search_doctors(q: str = "", db: AsyncSession = Depends(get_db)):
    try:
        ql = (q or "").strip().lower()
        # restrict to doctor global role if present
        query = select(Users).join(RoleMaster, RoleMaster.role_id == Users.global_role_id).where(RoleMaster.role_name == "doctor")
        if ql:
            from sqlalchemy import or_, func
            query = query.where(or_(func.lower(Users.username).like(f"%{ql}%"), func.lower(Users.email).like(f"%{ql}%")))
        res = await db.execute(query.limit(100))
        rows = res.scalars().all()
        return [HospitalDoctorOut(user_id=int(u.user_id), username=u.username, email=u.email, global_role_id=int(u.global_role_id) if u.global_role_id is not None else None) for u in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to search doctors") from e


@router.get("/hospitals", response_model=List[HospitalProfileOut])
async def search_hospitals(q: str = "", db: AsyncSession = Depends(get_db)):
    try:
        ql = (q or "").strip().lower()
        query = select(HospitalMaster)
        if ql:
            from sqlalchemy import func
            query = query.where(func.lower(HospitalMaster.hospital_name).like(f"%{ql}%"))
        res = await db.execute(query.limit(100))
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
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to search hospitals") from e


@router.get("/specialties", response_model=List[SpecialityOut])
async def search_specialties(q: str = "", db: AsyncSession = Depends(get_db)):
    try:
        ql = (q or "").strip().lower()
        query = select(Specialties)
        if ql:
            from sqlalchemy import func
            query = query.where(func.lower(Specialties.name).like(f"%{ql}%"))
        res = await db.execute(query.limit(100))
        rows = res.scalars().all()
        return [SpecialityOut(specialty_id=int(s.specialty_id), name=s.name, description=s.description, status=s.status) for s in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to search specialties") from e


