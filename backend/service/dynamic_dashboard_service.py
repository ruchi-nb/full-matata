import logging
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from models.models import (
    Users,
    UserDetails,
    HospitalUserRoles,
    HospitalRole,
    HospitalRolePermission,
    PermissionMaster,
    HospitalMaster,
    Consultation,
    PatientHospitals,
    DoctorSpecialties
)
from dependencies.dependencies import get_user_permissions

logger = logging.getLogger(__name__)

async def get_user_permissions_for_dashboard(db: AsyncSession, user: dict) -> List[str]:
    """Get user permissions for dynamic dashboard"""
    try:
        user_id = user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        # Get hospital ID from user's hospital roles
        hospital_q = await db.execute(
            select(HospitalUserRoles.hospital_id)
            .where(
                HospitalUserRoles.user_id == user_id,
                HospitalUserRoles.is_active == True
            )
            .limit(1)
        )
        hospital_id = hospital_q.scalar_one_or_none()
        
        if not hospital_id:
            raise HTTPException(status_code=403, detail="User not associated with any hospital")
        
        # Get user permissions
        permissions = await get_user_permissions(user_id, db, hospital_id)
        return list(permissions)
        
    except Exception as e:
        logger.error(f"Failed to get user permissions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user permissions")

async def get_patients_for_dashboard(db: AsyncSession, user: dict) -> List[Dict[str, Any]]:
    """Get patients for dashboard with permission check"""
    try:
        # Check if user has patient.view permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'patient.view' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to view patients")
        
        # Get hospital ID
        user_id = user.get("user_id")
        hospital_q = await db.execute(
            select(HospitalUserRoles.hospital_id)
            .where(
                HospitalUserRoles.user_id == user_id,
                HospitalUserRoles.is_active == True
            )
            .limit(1)
        )
        hospital_id = hospital_q.scalar_one_or_none()
        
        # Get patients for the hospital using PatientHospitals relationship
        patients_q = await db.execute(
            select(Users, UserDetails, PatientHospitals)
            .join(UserDetails, Users.user_id == UserDetails.user_id)
            .join(PatientHospitals, Users.user_id == PatientHospitals.user_id)
            .where(PatientHospitals.hospital_id == hospital_id)
            .order_by(Users.created_at.desc())
        )
        
        patients = []
        for user, user_details, patient_hospital in patients_q.all():
            patients.append({
                "id": user.user_id,
                "name": f"{user_details.first_name} {user_details.last_name}".strip(),
                "email": user.email,
                "phone": user_details.phone,
                "status": "active" if user.is_active else "inactive",
                "lastVisit": patient_hospital.last_visit_date.isoformat() if patient_hospital.last_visit_date else None,
                "createdAt": user.created_at.isoformat() if user.created_at else None
            })
        
        return patients
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get patients: {e}")
        raise HTTPException(status_code=500, detail="Failed to get patients")

async def create_patient_for_dashboard(db: AsyncSession, user: dict, patient_data: dict) -> Dict[str, Any]:
    """Create a new patient with permission check"""
    try:
        # Check if user has patient.create permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'patient.create' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to create patients")
        
        # Implementation for creating patient would go here
        # This is a placeholder - you would implement the actual patient creation logic
        raise HTTPException(status_code=501, detail="Patient creation not implemented yet")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create patient: {e}")
        raise HTTPException(status_code=500, detail="Failed to create patient")

async def update_patient_for_dashboard(db: AsyncSession, user: dict, patient_id: int, patient_data: dict) -> Dict[str, Any]:
    """Update a patient with permission check"""
    try:
        # Check if user has patient.update permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'patient.update' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to update patients")
        
        # Implementation for updating patient would go here
        raise HTTPException(status_code=501, detail="Patient update not implemented yet")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update patient: {e}")
        raise HTTPException(status_code=500, detail="Failed to update patient")

async def delete_patient_for_dashboard(db: AsyncSession, user: dict, patient_id: int) -> None:
    """Delete a patient with permission check"""
    try:
        # Check if user has patient.delete permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'patient.delete' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to delete patients")
        
        # Implementation for deleting patient would go here
        raise HTTPException(status_code=501, detail="Patient deletion not implemented yet")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete patient: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete patient")

async def get_doctors_for_dashboard(db: AsyncSession, user: dict) -> List[Dict[str, Any]]:
    """Get doctors for dashboard with permission check"""
    try:
        # Check if user has doctor.view permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'doctor.view' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to view doctors")
        
        # Get hospital ID
        user_id = user.get("user_id")
        hospital_q = await db.execute(
            select(HospitalUserRoles.hospital_id)
            .where(
                HospitalUserRoles.user_id == user_id,
                HospitalUserRoles.is_active == True
            )
            .limit(1)
        )
        hospital_id = hospital_q.scalar_one_or_none()
        
        # Get doctors for the hospital using HospitalUserRoles and DoctorSpecialties
        doctors_q = await db.execute(
            select(Users, UserDetails, HospitalUserRoles, DoctorSpecialties)
            .join(UserDetails, Users.user_id == UserDetails.user_id)
            .join(HospitalUserRoles, Users.user_id == HospitalUserRoles.user_id)
            .outerjoin(DoctorSpecialties, Users.user_id == DoctorSpecialties.user_id)
            .where(
                HospitalUserRoles.hospital_id == hospital_id,
                HospitalUserRoles.is_active == True
            )
            .order_by(Users.created_at.desc())
        )
        
        doctors = []
        for user, user_details, hospital_role, doctor_specialty in doctors_q.all():
            doctors.append({
                "id": user.user_id,
                "name": f"{user_details.first_name} {user_details.last_name}".strip(),
                "email": user.email,
                "phone": user_details.phone,
                "specialty": doctor_specialty.specialty_name if doctor_specialty else "General",
                "status": "active" if user.is_active else "inactive",
                "experience": doctor_specialty.experience_years if doctor_specialty else 0,
                "createdAt": user.created_at.isoformat() if user.created_at else None
            })
        
        return doctors
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get doctors: {e}")
        raise HTTPException(status_code=500, detail="Failed to get doctors")

async def create_doctor_for_dashboard(db: AsyncSession, user: dict, doctor_data: dict) -> Dict[str, Any]:
    """Create a new doctor with permission check"""
    try:
        # Check if user has doctor.create permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'doctor.create' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to create doctors")
        
        # Implementation for creating doctor would go here
        raise HTTPException(status_code=501, detail="Doctor creation not implemented yet")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create doctor: {e}")
        raise HTTPException(status_code=500, detail="Failed to create doctor")

async def update_doctor_for_dashboard(db: AsyncSession, user: dict, doctor_id: int, doctor_data: dict) -> Dict[str, Any]:
    """Update a doctor with permission check"""
    try:
        # Check if user has doctor.update permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'doctor.update' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to update doctors")
        
        # Implementation for updating doctor would go here
        raise HTTPException(status_code=501, detail="Doctor update not implemented yet")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update doctor: {e}")
        raise HTTPException(status_code=500, detail="Failed to update doctor")

async def delete_doctor_for_dashboard(db: AsyncSession, user: dict, doctor_id: int) -> None:
    """Delete a doctor with permission check"""
    try:
        # Check if user has doctor.delete permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'doctor.delete' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to delete doctors")
        
        # Implementation for deleting doctor would go here
        raise HTTPException(status_code=501, detail="Doctor deletion not implemented yet")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete doctor: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete doctor")

async def get_reports_for_dashboard(db: AsyncSession, user: dict) -> List[Dict[str, Any]]:
    """Get reports for dashboard with permission check"""
    try:
        # Check if user has reports.view permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'reports.view' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to view reports")
        
        # Get hospital ID
        user_id = user.get("user_id")
        hospital_q = await db.execute(
            select(HospitalUserRoles.hospital_id)
            .where(
                HospitalUserRoles.user_id == user_id,
                HospitalUserRoles.is_active == True
            )
            .limit(1)
        )
        hospital_id = hospital_q.scalar_one_or_none()
        
        # Mock reports data - in a real implementation, you would query actual reports
        reports = [
            {
                "id": 1,
                "name": "Patient Summary Report",
                "description": "Monthly summary of patient activities",
                "type": "Monthly",
                "generatedAt": (datetime.now() - timedelta(days=1)).isoformat(),
                "period": "Last 30 days",
                "status": "ready"
            },
            {
                "id": 2,
                "name": "Doctor Performance Report",
                "description": "Performance metrics for all doctors",
                "type": "Performance",
                "generatedAt": (datetime.now() - timedelta(days=3)).isoformat(),
                "period": "Last 30 days",
                "status": "ready"
            },
            {
                "id": 3,
                "name": "Financial Report",
                "description": "Revenue and cost analysis",
                "type": "Financial",
                "generatedAt": (datetime.now() - timedelta(days=7)).isoformat(),
                "period": "Last 30 days",
                "status": "processing"
            }
        ]
        
        return reports
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get reports: {e}")
        raise HTTPException(status_code=500, detail="Failed to get reports")

async def get_analytics_for_dashboard(db: AsyncSession, user: dict, period: str = "30d") -> Dict[str, Any]:
    """Get analytics for dashboard with permission check"""
    try:
        # Check if user has reports.view permission
        permissions = await get_user_permissions_for_dashboard(db, user)
        if 'reports.view' not in permissions:
            raise HTTPException(status_code=403, detail="Insufficient permissions to view analytics")
        
        # Get hospital ID
        user_id = user.get("user_id")
        hospital_q = await db.execute(
            select(HospitalUserRoles.hospital_id)
            .where(
                HospitalUserRoles.user_id == user_id,
                HospitalUserRoles.is_active == True
            )
            .limit(1)
        )
        hospital_id = hospital_q.scalar_one_or_none()
        
        # Calculate date range based on period
        end_date = datetime.now()
        if period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        elif period == "1y":
            start_date = end_date - timedelta(days=365)
        else:
            start_date = end_date - timedelta(days=30)
        
        # Get analytics data
        # Total patients
        total_patients_q = await db.execute(
            select(func.count(PatientHospitals.user_id))
            .where(PatientHospitals.hospital_id == hospital_id)
        )
        total_patients = total_patients_q.scalar() or 0
        
        # Total consultations in period
        total_consultations_q = await db.execute(
            select(func.count(Consultation.consultation_id))
            .where(
                Consultation.hospital_id == hospital_id,
                Consultation.created_at >= start_date,
                Consultation.created_at <= end_date
            )
        )
        total_consultations = total_consultations_q.scalar() or 0
        
        # Mock analytics data
        analytics = {
            "totalPatients": total_patients,
            "patientGrowth": 12.5,
            "totalConsultations": total_consultations,
            "consultationGrowth": 8.3,
            "revenue": "45,230",
            "revenueGrowth": 15.2,
            "reportsGenerated": 3,
            "period": period,
            "generatedAt": datetime.now().isoformat()
        }
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")
