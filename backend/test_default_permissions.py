#!/usr/bin/env python3
"""
Test Script: Verify Default Permissions Assignment
==================================================

This script tests that when doctors and patients are created, they automatically
get the required default permissions assigned.

Usage:
    python test_default_permissions.py

Requirements:
    - Backend server running
    - Superadmin credentials
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PermissionTestAPI:
    """API client for testing permission assignment"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def login_as_superadmin(self, email: str, password: str) -> str:
        """Login as superadmin and get access token"""
        try:
            async with self.session.post(
                f"{self.base_url}/auth/login",
                json={"email": email, "password": password}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("access_token")
                else:
                    error_text = await response.text()
                    raise Exception(f"Login failed: {response.status} - {error_text}")
        except Exception as e:
            logger.error(f"Error during login: {e}")
            raise
    
    async def create_test_doctor(self, access_token: str, hospital_id: int) -> Dict[str, Any]:
        """Create a test doctor to verify permissions are assigned"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Create a test doctor
            doctor_data = {
                "email": f"test_doctor_{asyncio.get_event_loop().time()}@example.com",
                "username": f"test_doctor_{int(asyncio.get_event_loop().time())}",
                "password": "TestPassword123!",
                "first_name": "Test",
                "last_name": "Doctor",
                "phone": "+1234567890"
            }
            
            async with self.session.post(
                f"{self.base_url}/superadmin/hospitals/{hospital_id}/users",
                headers=headers,
                json={**doctor_data, "user_type": "doctor"}
            ) as response:
                if response.status == 201:
                    data = await response.json()
                    return data
                else:
                    error_text = await response.text()
                    raise Exception(f"Doctor creation failed: {response.status} - {error_text}")
        except Exception as e:
            logger.error(f"Error during doctor creation: {e}")
            raise
    
    async def create_test_patient(self, access_token: str, hospital_id: int) -> Dict[str, Any]:
        """Create a test patient to verify permissions are assigned"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Create a test patient
            patient_data = {
                "email": f"test_patient_{asyncio.get_event_loop().time()}@example.com",
                "username": f"test_patient_{int(asyncio.get_event_loop().time())}",
                "password": "TestPassword123!",
                "first_name": "Test",
                "last_name": "Patient",
                "phone": "+1234567890"
            }
            
            async with self.session.post(
                f"{self.base_url}/superadmin/hospitals/{hospital_id}/users",
                headers=headers,
                json={**patient_data, "user_type": "patient"}
            ) as response:
                if response.status == 201:
                    data = await response.json()
                    return data
                else:
                    error_text = await response.text()
                    raise Exception(f"Patient creation failed: {response.status} - {error_text}")
        except Exception as e:
            logger.error(f"Error during patient creation: {e}")
            raise
    
    async def get_doctor_permissions_status(self, access_token: str) -> Dict[str, Any]:
        """Get the current status of doctor permissions"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with self.session.get(
                f"{self.base_url}/superadmin/doctor-permissions-status",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    error_text = await response.text()
                    raise Exception(f"Status check failed: {response.status} - {error_text}")
        except Exception as e:
            logger.error(f"Error during status check: {e}")
            raise

async def main():
    """Main execution function"""
    logger.info("Starting default permissions assignment test...")
    
    # Configuration - Update these with your superadmin credentials
    SUPERADMIN_EMAIL = "superadmin@example.com"  # Update with actual superadmin email
    SUPERADMIN_PASSWORD = "your_password"  # Update with actual superadmin password
    API_BASE_URL = "http://localhost:8000"  # Update if backend runs on different port
    TEST_HOSPITAL_ID = 1  # Update with an actual hospital ID
    
    async with PermissionTestAPI(API_BASE_URL) as api:
        try:
            # Step 1: Login as superadmin
            logger.info("Logging in as superadmin...")
            access_token = await api.login_as_superadmin(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
            logger.info("✅ Successfully logged in as superadmin")
            
            # Step 2: Check initial status
            logger.info("Checking initial doctor permissions status...")
            initial_status = await api.get_doctor_permissions_status(access_token)
            initial_summary = initial_status['data']['summary']
            
            print("\n" + "="*60)
            print("INITIAL DOCTOR PERMISSIONS STATUS")
            print("="*60)
            print(f"Total Doctors: {initial_summary['total_doctors']}")
            print(f"Doctors with All Permissions: {initial_summary['doctors_with_all_permissions']}")
            print(f"Doctors with Some Permissions: {initial_summary['doctors_with_some_permissions']}")
            print(f"Doctors with No Permissions: {initial_summary['doctors_with_no_permissions']}")
            print(f"Completion Percentage: {initial_summary['completion_percentage']}%")
            
            # Step 3: Create test doctor
            logger.info("Creating test doctor...")
            doctor_result = await api.create_test_doctor(access_token, TEST_HOSPITAL_ID)
            print(f"\n✅ Test doctor created successfully:")
            print(f"   User ID: {doctor_result['user_id']}")
            print(f"   Email: {doctor_result['email']}")
            print(f"   Hospital ID: {doctor_result['hospital_id']}")
            print(f"   Role: {doctor_result['tenant_role']}")
            
            # Step 4: Create test patient
            logger.info("Creating test patient...")
            patient_result = await api.create_test_patient(access_token, TEST_HOSPITAL_ID)
            print(f"\n✅ Test patient created successfully:")
            print(f"   User ID: {patient_result['user_id']}")
            print(f"   Email: {patient_result['email']}")
            print(f"   Hospital ID: {patient_result['hospital_id']}")
            print(f"   Role: {patient_result['tenant_role']}")
            
            # Step 5: Check final status
            logger.info("Checking final doctor permissions status...")
            final_status = await api.get_doctor_permissions_status(access_token)
            final_summary = final_status['data']['summary']
            
            print("\n" + "="*60)
            print("FINAL DOCTOR PERMISSIONS STATUS")
            print("="*60)
            print(f"Total Doctors: {final_summary['total_doctors']}")
            print(f"Doctors with All Permissions: {final_summary['doctors_with_all_permissions']}")
            print(f"Doctors with Some Permissions: {final_summary['doctors_with_some_permissions']}")
            print(f"Doctors with No Permissions: {final_summary['doctors_with_no_permissions']}")
            print(f"Completion Percentage: {final_summary['completion_percentage']}%")
            
            # Step 6: Verify the new doctor has permissions
            new_doctor = None
            for doctor in final_status['data']['doctors']:
                if doctor['email'] == doctor_result['email']:
                    new_doctor = doctor
                    break
            
            if new_doctor:
                print(f"\n" + "="*60)
                print("NEW DOCTOR PERMISSIONS VERIFICATION")
                print("="*60)
                print(f"Doctor Email: {new_doctor['email']}")
                print(f"Permission Status: {new_doctor['permission_status']}")
                print(f"Permission Count: {new_doctor['permission_count']}")
                print(f"Assigned Permissions:")
                for perm in new_doctor['permissions']:
                    print(f"  - {perm}")
                
                # Check if doctor has the required profile permissions
                required_profile_perms = ['doctor.profile.view', 'doctor.profile.update']
                has_profile_perms = all(perm in new_doctor['permissions'] for perm in required_profile_perms)
                
                if has_profile_perms:
                    print(f"\n✅ SUCCESS: New doctor has required profile permissions!")
                    print("The doctor should now be able to access their profile settings.")
                else:
                    print(f"\n❌ FAILURE: New doctor is missing required profile permissions!")
                    print("The doctor will still get permission errors.")
            else:
                print(f"\n❌ ERROR: Could not find the newly created doctor in the status report")
            
            print("\n" + "="*60)
            print("TEST SUMMARY")
            print("="*60)
            if final_summary['doctors_with_all_permissions'] > initial_summary['doctors_with_all_permissions']:
                print("✅ SUCCESS: Default permissions are being assigned to new doctors!")
                print("New doctors and patients will automatically get the required permissions.")
            else:
                print("❌ FAILURE: Default permissions are not being assigned properly.")
                print("Check the backend logs for errors in the permission assignment process.")
            
        except Exception as e:
            logger.error(f"Test execution failed: {e}")
            print(f"\n❌ Test execution failed: {e}")
            print("\nTroubleshooting:")
            print("1. Make sure the backend server is running")
            print("2. Check your superadmin credentials")
            print("3. Verify the API base URL and hospital ID are correct")
            print("4. Check backend logs for detailed error information")

if __name__ == "__main__":
    print("Default Permissions Assignment Test")
    print("====================================")
    print("\nThis script tests that new doctors and patients automatically get default permissions.")
    print("\nBefore running this script:")
    print("1. Make sure your backend server is running")
    print("2. Update SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in the script")
    print("3. Update API_BASE_URL if your backend runs on a different port")
    print("4. Update TEST_HOSPITAL_ID with an actual hospital ID")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    
    try:
        input()
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest cancelled by user.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")


