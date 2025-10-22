"""
One-time migration: Add existing patients to patient_hospitals table
Run this once to fix patients created before the automatic association was added
"""

import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from database.database import get_db
from models.models import Users, PatientHospitals, HospitalUserRoles

async def migrate():
    print("\n" + "="*80)
    print("MIGRATION: Add existing patients to patient_hospitals")
    print("="*80 + "\n")
    
    async for db in get_db():
        try:
            # Find all patients (global_role_id = 4)
            patients_query = select(Users).where(Users.global_role_id == 4)
            patients_result = await db.execute(patients_query)
            patients = patients_result.scalars().all()
            
            print(f"Found {len(patients)} patients in users table\n")
            
            fixed_count = 0
            already_ok_count = 0
            
            for patient in patients:
                # Check if patient already in patient_hospitals
                check_query = select(PatientHospitals).where(
                    PatientHospitals.user_id == patient.user_id
                )
                check_result = await db.execute(check_query)
                existing = check_result.scalar_one_or_none()
                
                if existing:
                    print(f"✓ Patient {patient.user_id} ({patient.email}) already in patient_hospitals")
                    already_ok_count += 1
                    continue
                
                # Find which hospital this patient belongs to via hospital_user_roles
                hospital_role_query = select(HospitalUserRoles).where(
                    HospitalUserRoles.user_id == patient.user_id,
                    HospitalUserRoles.is_active == True
                )
                hospital_role_result = await db.execute(hospital_role_query)
                hospital_roles = hospital_role_result.scalars().all()
                
                if not hospital_roles:
                    print(f"⚠ Patient {patient.user_id} ({patient.email}) has no hospital assignment in hospital_user_roles - SKIPPING")
                    continue
                
                # Add to patient_hospitals for each hospital
                for hur in hospital_roles:
                    patient_hospital = PatientHospitals(
                        user_id=patient.user_id,
                        hospital_id=hur.hospital_id,
                        is_active=1
                    )
                    db.add(patient_hospital)
                    print(f"✓ Added patient {patient.user_id} ({patient.email}) to hospital {hur.hospital_id}")
                    fixed_count += 1
            
            await db.commit()
            
            print("\n" + "="*80)
            print("MIGRATION COMPLETE")
            print("="*80)
            print(f"✓ Patients already OK: {already_ok_count}")
            print(f"✓ Patients fixed: {fixed_count}")
            print(f"✓ Total patients: {len(patients)}")
            print("\nPatients should now see specialties when they log in!")
            print("="*80 + "\n")
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(migrate())

