#!/usr/bin/env python3
"""
Script to seed default specialties in the database
Run this script to add common medical specialties to the database
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import get_db
from service.hospitals_service import create_speciality

async def seed_specialties():
    """Seed default specialties in the database"""
    
    default_specialties = [
        {"name": "Cardiology", "description": "Heart and cardiovascular system disorders"},
        {"name": "Neurology", "description": "Brain and nervous system disorders"},
        {"name": "Orthopedics", "description": "Bones, joints, and musculoskeletal system"},
        {"name": "Pediatrics", "description": "Medical care for infants, children, and adolescents"},
        {"name": "Dermatology", "description": "Skin, hair, and nail disorders"},
        {"name": "Gynecology", "description": "Women's reproductive health and disorders"},
        {"name": "General Medicine", "description": "General medical care and internal medicine"},
        {"name": "Emergency Medicine", "description": "Emergency and urgent medical care"},
        {"name": "Radiology", "description": "Medical imaging and diagnostic radiology"},
        {"name": "Anesthesiology", "description": "Pain management and anesthesia"},
        {"name": "Oncology", "description": "Cancer treatment and care"},
        {"name": "Psychiatry", "description": "Mental health and psychiatric disorders"},
        {"name": "Urology", "description": "Urinary tract and male reproductive system"},
        {"name": "Ophthalmology", "description": "Eye and vision care"},
        {"name": "ENT (Ear, Nose, Throat)", "description": "Ear, nose, and throat disorders"},
        {"name": "Gastroenterology", "description": "Digestive system disorders"},
        {"name": "Endocrinology", "description": "Hormone and metabolic disorders"},
        {"name": "Pulmonology", "description": "Lung and respiratory system disorders"},
        {"name": "Nephrology", "description": "Kidney and urinary system disorders"},
        {"name": "Hematology", "description": "Blood and blood-forming organs disorders"}
    ]
    
    async for db in get_db():
        try:
            print("🌱 Starting to seed specialties...")
            
            created_count = 0
            skipped_count = 0
            
            for specialty_data in default_specialties:
                try:
                    # Try to create the specialty
                    specialty = await create_speciality(
                        db=db,
                        name=specialty_data["name"],
                        description=specialty_data["description"],
                        status="active"
                    )
                    print(f"✅ Created specialty: {specialty.name}")
                    created_count += 1
                    
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        print(f"⏭️  Skipped existing specialty: {specialty_data['name']}")
                        skipped_count += 1
                    else:
                        print(f"❌ Error creating specialty {specialty_data['name']}: {e}")
            
            print(f"\n📊 Summary:")
            print(f"   Created: {created_count} specialties")
            print(f"   Skipped: {skipped_count} specialties")
            print(f"   Total: {len(default_specialties)} specialties")
            
            if created_count > 0:
                print("🎉 Successfully seeded specialties!")
            else:
                print("ℹ️  All specialties already exist in the database")
                
        except Exception as e:
            print(f"❌ Error during seeding: {e}")
        finally:
            break  # Exit the async generator

if __name__ == "__main__":
    print("🏥 Medical Specialties Seeder")
    print("=" * 40)
    asyncio.run(seed_specialties())
