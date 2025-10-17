#!/usr/bin/env python3
"""
Doctor Permissions Assignment Script
===================================

This script calls the superadmin API to assign permissions to all doctors.
It can be run from the backend to automatically fix permission issues.

Usage:
    python assign_doctor_permissions_api.py

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

class DoctorPermissionAPI:
    """API client for doctor permission assignment"""
    
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
    
    async def assign_permissions_to_all_doctors(self, access_token: str) -> Dict[str, Any]:
        """Call the API to assign permissions to all doctors"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with self.session.post(
                f"{self.base_url}/superadmin/assign-doctor-permissions",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    error_text = await response.text()
                    raise Exception(f"Permission assignment failed: {response.status} - {error_text}")
        except Exception as e:
            logger.error(f"Error during permission assignment: {e}")
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
    logger.info("Starting doctor permissions assignment via API...")
    
    # Configuration - Update these with your superadmin credentials
    SUPERADMIN_EMAIL = "superadmin@example.com"  # Update with actual superadmin email
    SUPERADMIN_PASSWORD = "your_password"  # Update with actual superadmin password
    API_BASE_URL = "http://localhost:8000"  # Update if backend runs on different port
    
    async with DoctorPermissionAPI(API_BASE_URL) as api:
        try:
            # Step 1: Login as superadmin
            logger.info("Logging in as superadmin...")
            access_token = await api.login_as_superadmin(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
            logger.info("✅ Successfully logged in as superadmin")
            
            # Step 2: Check current status
            logger.info("Checking current doctor permissions status...")
            status_data = await api.get_doctor_permissions_status(access_token)
            
            print("\n" + "="*60)
            print("CURRENT DOCTOR PERMISSIONS STATUS")
            print("="*60)
            summary = status_data['data']['summary']
            print(f"Total Doctors: {summary['total_doctors']}")
            print(f"Doctors with All Permissions: {summary['doctors_with_all_permissions']}")
            print(f"Doctors with Some Permissions: {summary['doctors_with_some_permissions']}")
            print(f"Doctors with No Permissions: {summary['doctors_with_no_permissions']}")
            print(f"Completion Percentage: {summary['completion_percentage']}%")
            
            # Step 3: Assign permissions if needed
            if summary['doctors_with_all_permissions'] < summary['total_doctors']:
                logger.info("Assigning permissions to all doctors...")
                results = await api.assign_permissions_to_all_doctors(access_token)
                
                print("\n" + "="*60)
                print("PERMISSION ASSIGNMENT RESULTS")
                print("="*60)
                result_data = results['results']
                print(f"Total Doctors: {result_data['total_doctors']}")
                print(f"Successful: {result_data['successful']}")
                print(f"Failed: {result_data['failed']}")
                print(f"Skipped: {result_data['skipped']}")
                
                if result_data['errors']:
                    print(f"\nErrors ({len(result_data['errors'])}):")
                    for error in result_data['errors']:
                        print(f"  - {error}")
                
                # Step 4: Check final status
                logger.info("Checking final status after assignment...")
                final_status = await api.get_doctor_permissions_status(access_token)
                final_summary = final_status['data']['summary']
                
                print("\n" + "="*60)
                print("FINAL STATUS AFTER ASSIGNMENT")
                print("="*60)
                print(f"Total Doctors: {final_summary['total_doctors']}")
                print(f"Doctors with All Permissions: {final_summary['doctors_with_all_permissions']}")
                print(f"Doctors with Some Permissions: {final_summary['doctors_with_some_permissions']}")
                print(f"Doctors with No Permissions: {final_summary['doctors_with_no_permissions']}")
                print(f"Completion Percentage: {final_summary['completion_percentage']}%")
                
                if final_summary['doctors_with_all_permissions'] == final_summary['total_doctors']:
                    print("\n✅ SUCCESS: All doctors now have the required permissions!")
                    print("Doctors can now access their profile settings.")
                else:
                    print("\n⚠️ WARNING: Some doctors still need manual permission assignment.")
                    print("Check the errors above and consider running the SQL script.")
            else:
                print("\n✅ All doctors already have the required permissions!")
            
        except Exception as e:
            logger.error(f"Script execution failed: {e}")
            print(f"\n❌ Script execution failed: {e}")
            print("\nTroubleshooting:")
            print("1. Make sure the backend server is running")
            print("2. Check your superadmin credentials")
            print("3. Verify the API base URL is correct")
            print("4. Check backend logs for detailed error information")

if __name__ == "__main__":
    print("Doctor Permissions Assignment Script")
    print("====================================")
    print("\nBefore running this script:")
    print("1. Make sure your backend server is running")
    print("2. Update SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in the script")
    print("3. Update API_BASE_URL if your backend runs on a different port")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    
    try:
        input()
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nScript cancelled by user.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")


