from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
from dependencies.dependencies import get_current_user, get_db
from service.dynamic_dashboard_service import (
    get_user_permissions_for_dashboard,
    get_patients_for_dashboard,
    create_patient_for_dashboard,
    update_patient_for_dashboard,
    delete_patient_for_dashboard,
    get_doctors_for_dashboard,
    create_doctor_for_dashboard,
    update_doctor_for_dashboard,
    delete_doctor_for_dashboard,
    get_reports_for_dashboard,
    get_analytics_for_dashboard
)

router = APIRouter(prefix="/api/hospital", tags=["Dynamic Dashboard"])

@router.get("/permissions")
async def get_user_permissions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user permissions for dynamic dashboard"""
    try:
        permissions = await get_user_permissions_for_dashboard(db, current_user)
        return {"permissions": permissions}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch permissions: {str(e)}"
        )

@router.get("/patients")
async def get_patients(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get patients for dashboard (requires patient.view permission)"""
    try:
        patients = await get_patients_for_dashboard(db, current_user)
        return {"patients": patients}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch patients: {str(e)}"
        )

@router.post("/patients")
async def create_patient(
    patient_data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new patient (requires patient.create permission)"""
    try:
        patient = await create_patient_for_dashboard(db, current_user, patient_data)
        return patient
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create patient: {str(e)}"
        )

@router.put("/patients/{patient_id}")
async def update_patient(
    patient_id: int,
    patient_data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a patient (requires patient.update permission)"""
    try:
        patient = await update_patient_for_dashboard(db, current_user, patient_id, patient_data)
        return patient
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update patient: {str(e)}"
        )

@router.delete("/patients/{patient_id}")
async def delete_patient(
    patient_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a patient (requires patient.delete permission)"""
    try:
        await delete_patient_for_dashboard(db, current_user, patient_id)
        return {"message": "Patient deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete patient: {str(e)}"
        )

@router.get("/doctors")
async def get_doctors(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get doctors for dashboard (requires doctor.view permission)"""
    try:
        doctors = await get_doctors_for_dashboard(db, current_user)
        return {"doctors": doctors}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch doctors: {str(e)}"
        )

@router.post("/doctors")
async def create_doctor(
    doctor_data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new doctor (requires doctor.create permission)"""
    try:
        doctor = await create_doctor_for_dashboard(db, current_user, doctor_data)
        return doctor
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create doctor: {str(e)}"
        )

@router.put("/doctors/{doctor_id}")
async def update_doctor(
    doctor_id: int,
    doctor_data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a doctor (requires doctor.update permission)"""
    try:
        doctor = await update_doctor_for_dashboard(db, current_user, doctor_id, doctor_data)
        return doctor
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update doctor: {str(e)}"
        )

@router.delete("/doctors/{doctor_id}")
async def delete_doctor(
    doctor_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a doctor (requires doctor.delete permission)"""
    try:
        await delete_doctor_for_dashboard(db, current_user, doctor_id)
        return {"message": "Doctor deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete doctor: {str(e)}"
        )

@router.get("/reports")
async def get_reports(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get reports for dashboard (requires reports.view permission)"""
    try:
        reports = await get_reports_for_dashboard(db, current_user)
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reports: {str(e)}"
        )

@router.get("/analytics")
async def get_analytics(
    period: str = "30d",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get analytics for dashboard (requires reports.view permission)"""
    try:
        analytics = await get_analytics_for_dashboard(db, current_user, period)
        return analytics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analytics: {str(e)}"
        )
