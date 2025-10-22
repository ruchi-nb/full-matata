"""
Diagnostic script to check why patient is not seeing specialties
Run this to see exactly what's missing in the database
"""

import asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import get_db
from models.models import (
    Users, PatientHospitals, HospitalSpecialties, 
    Specialties, DoctorSpecialties, HospitalMaster
)

async def diagnose():
    """Run diagnostic checks"""
    
    print("\n" + "="*80)
    print("PATIENT SPECIALTY DIAGNOSTIC TOOL")
    print("="*80 + "\n")
    
    # Get database session
    async for db in get_db():
        try:
            # 1. Get all patients
            print("📋 STEP 1: Finding all patients...")
            patients_query = select(Users).where(Users.global_role_id == 4)  # role_id=4 is patient
            patients_result = await db.execute(patients_query)
            patients = patients_result.scalars().all()
            
            if not patients:
                print("❌ NO PATIENTS FOUND in users table!")
                return
            
            print(f"✅ Found {len(patients)} patients:")
            for p in patients:
                print(f"   - user_id={p.user_id}, username={p.username}, email={p.email}")
            
            # Let user choose which patient to diagnose
            print("\n" + "-"*80)
            patient_id = int(input("Enter patient user_id to diagnose: "))
            print("-"*80 + "\n")
            
            # 2. Check if patient is in patient_hospitals
            print(f"📋 STEP 2: Checking patient_hospitals for user_id={patient_id}...")
            ph_query = select(PatientHospitals).where(PatientHospitals.user_id == patient_id)
            ph_result = await db.execute(ph_query)
            patient_hospitals = ph_result.scalars().all()
            
            if not patient_hospitals:
                print(f"❌ PROBLEM FOUND: Patient {patient_id} is NOT in patient_hospitals table!")
                print("\n💡 FIX: Run this SQL to add patient to hospital:")
                print(f"   INSERT INTO patient_hospitals (user_id, hospital_id, is_active)")
                print(f"   VALUES ({patient_id}, <hospital_id>, 1);")
                print("\n⚠️  Replace <hospital_id> with the actual hospital ID")
                return
            
            print(f"✅ Patient is in {len(patient_hospitals)} hospital(s):")
            hospital_ids = []
            for ph in patient_hospitals:
                hospital_ids.append(ph.hospital_id)
                print(f"   - hospital_id={ph.hospital_id}, is_active={ph.is_active}")
            
            # 3. Check hospital_specialties for these hospitals
            print(f"\n📋 STEP 3: Checking hospital_specialties for hospitals: {hospital_ids}...")
            hs_query = (
                select(HospitalSpecialties, Specialties)
                .join(Specialties, Specialties.specialty_id == HospitalSpecialties.specialty_id)
                .where(HospitalSpecialties.hospital_id.in_(hospital_ids))
            )
            hs_result = await db.execute(hs_query)
            hospital_specialties = hs_result.all()
            
            if not hospital_specialties:
                print(f"❌ PROBLEM FOUND: NO specialties in hospital_specialties for hospitals {hospital_ids}!")
                print("\n💡 This means no doctors have been added with specialties")
                print("   OR doctors were added but hospital_specialties was not updated")
                
                # Check if there are any specialties in the system
                all_spec_query = select(Specialties)
                all_spec_result = await db.execute(all_spec_query)
                all_specialties = all_spec_result.scalars().all()
                
                if all_specialties:
                    print(f"\n📋 Available specialties in database ({len(all_specialties)}):")
                    for spec in all_specialties[:10]:  # Show first 10
                        print(f"   - specialty_id={spec.specialty_id}, name={spec.name}")
                    
                    print("\n💡 FIX: Add a specialty to the hospital by running:")
                    print(f"   INSERT INTO hospital_specialties (hospital_id, specialty_id, is_primary)")
                    print(f"   VALUES ({hospital_ids[0]}, <specialty_id>, 0);")
                
                return
            
            print(f"✅ Found {len(hospital_specialties)} specialties in hospital:")
            for hs, spec in hospital_specialties:
                print(f"   - specialty_id={spec.specialty_id}, name={spec.name}, status={spec.status}")
            
            # 4. Check if specialties are active
            print(f"\n📋 STEP 4: Checking if specialties are active...")
            inactive = [spec for hs, spec in hospital_specialties if spec.status != 'active']
            if inactive:
                print(f"⚠️  WARNING: {len(inactive)} specialties are INACTIVE:")
                for spec in inactive:
                    print(f"   - {spec.name} (status={spec.status})")
                print("\n💡 FIX: Update specialty status to 'active':")
                for spec in inactive:
                    print(f"   UPDATE specialties SET status='active' WHERE specialty_id={spec.specialty_id};")
            else:
                print("✅ All specialties are active")
            
            # 5. Check doctor associations
            print(f"\n📋 STEP 5: Checking doctors with specialties in these hospitals...")
            
            # Find doctors in hospital_specialties
            for hs, spec in hospital_specialties:
                # Find doctors with this specialty
                doc_spec_query = (
                    select(DoctorSpecialties, Users)
                    .join(Users, Users.user_id == DoctorSpecialties.user_id)
                    .where(DoctorSpecialties.specialty_id == spec.specialty_id)
                )
                doc_spec_result = await db.execute(doc_spec_query)
                doctors = doc_spec_result.all()
                
                if doctors:
                    print(f"\n   Specialty: {spec.name}")
                    print(f"   Doctors with this specialty ({len(doctors)}):")
                    for ds, doc in doctors:
                        print(f"      - user_id={doc.user_id}, username={doc.username}, email={doc.email}")
                else:
                    print(f"\n   ⚠️  Specialty: {spec.name} - NO DOCTORS ASSIGNED")
            
            # 6. Summary
            print("\n" + "="*80)
            print("SUMMARY")
            print("="*80)
            print(f"✅ Patient {patient_id} is in patient_hospitals table")
            print(f"✅ Patient's hospital(s): {hospital_ids}")
            print(f"✅ Hospital has {len(hospital_specialties)} specialties")
            
            active_specialties = [spec for hs, spec in hospital_specialties if spec.status == 'active']
            print(f"✅ {len(active_specialties)} specialties are active")
            
            print("\n💡 If patient still sees 'No Hospital Assigned', check:")
            print("   1. Backend logs when patient visits /patientportal")
            print("   2. Frontend console logs")
            print("   3. JWT token has correct user_id")
            print("\n")
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

if __name__ == "__main__":
    asyncio.run(diagnose())

