#!/usr/bin/env python3
"""
Migration script to add patient.consultation.create permission
"""
import asyncio
import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import AsyncSessionLocal
from sqlalchemy import text

async def run_migration():
    """Run the migration to add patient.consultation.create permission"""
    try:
        async with AsyncSessionLocal() as db:
            print("Adding patient.consultation.create permission...")
            
            # Add permission (MySQL syntax)
            await db.execute(text("""
                INSERT IGNORE INTO permission_master (permission_name, description, created_at) 
                VALUES ('patient.consultation.create', 'Create consultations as a patient', NOW());
            """))
            
            print("Adding permission to patient role...")
            
            # Add permission to patient role (MySQL syntax)
            await db.execute(text("""
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT r.role_id, p.permission_id
                FROM role_master r, permission_master p
                WHERE r.role_name = 'patient' AND p.permission_name = 'patient.consultation.create';
            """))
            
            await db.commit()
            print("Migration completed successfully!")
            print("Patients now have permission to create consultations")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(run_migration())
    if success:
        print("\nDatabase migration completed!")
        print("Next steps:")
        print("1. Restart the backend server")
        print("2. Test the consultation form")
    else:
        print("\nMigration failed. Please check the error above.")
        sys.exit(1)
