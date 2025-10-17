'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserManagement from "@/components/common/UserManagement";
import HosSidebar from "@/components/Hospital/Sidebar";
import HospitalProtectedRoute from "@/components/Hospital/HospitalProtectedRoute";
import { useUser } from "@/data/UserContext";

// Dynamic API functions for custom roles
import { getHospitalRoles } from '@/data/api-hospital-admin.js';
import { request } from '@/data/api.js';

// Function to get hospital-specific custom roles
const getHospitalCustomRoles = async (hospitalId) => {
  try {
    const response = await getHospitalRoles(hospitalId);
    return response || [];
  } catch (error) {
    console.log("⚠️ Custom roles endpoint not available:", error.message);
    return [];
  }
};

// Function to get users with specific custom role
const getUsersWithCustomRole = async (hospitalId, roleName) => {
  try {
    const response = await request(`/api/hospitals/${hospitalId}/users?role_name=${roleName}&use_hospital_role=true`, { 
      method: "GET" 
    });
    return response || [];
  } catch (error) {
    console.error(`Failed to fetch users with role ${roleName}:`, error);
    return [];
  }
};

export default function CustomRoleManagementPage() {
  const router = useRouter();
  const { user, getHospitalId } = useUser();
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load custom roles dynamically
  useEffect(() => {
    async function loadCustomRoles() {
      try {
        const hospitalId = getHospitalId();
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        const roles = await getHospitalCustomRoles(hospitalId);
        setCustomRoles(roles);
      } catch (error) {
        console.error("Failed to load custom roles:", error);
        setCustomRoles([]);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadCustomRoles();
    }
  }, [user]);

  // Create dynamic API functions based on available custom roles
  const createDynamicApiFunctions = () => {
    const apiFunctions = {};
    
    customRoles.forEach(role => {
      const roleKey = role.role_name.toLowerCase().replace(/\s+/g, '_');
      apiFunctions[roleKey] = (hospitalId) => getUsersWithCustomRole(hospitalId, role.role_name);
    });
    
    return apiFunctions;
  };

  // Create dynamic stats config based on available roles
  const createDynamicStatsConfig = () => {
    const statsConfig = {
      showDoctors: false,
      showPatients: false,
      showNurses: false,
      showLabTechnicians: false,
      showHospitalAdmins: false
    };
    
    customRoles.forEach(role => {
      const roleKey = role.role_name.toLowerCase().replace(/\s+/g, '_');
      if (roleKey === 'nurse') statsConfig.showNurses = true;
      if (roleKey === 'lab_technician') statsConfig.showLabTechnicians = true;
      // Add more role mappings as needed
    });
    
    return statsConfig;
  };

  const handleAddUser = () => {
    router.push("/Hospital/addCustomRoleUser");
  };

  const handleView = (user) => {
    console.log("Viewing custom role user profile:", user);
  };

  const handlePause = (user) => {
    console.log("Pausing custom role user:", user);
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Are you sure you want to remove ${user.username || user.name} from this role?`)) {
      try {
        console.log("Deleting custom role user:", user);
        // Add API call to remove user from custom role
      } catch (error) {
        console.error("Failed to remove custom role user:", error);
        alert("Failed to remove user. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <HospitalProtectedRoute>
        <div className="flex h-screen bg-[#E6EEF8]">
          <div className="h-full w-[17rem] flex-shrink-0">
            <HosSidebar />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto">
              <div className="p-6 max-w-7xl mx-auto">
                <div className="opacity-50">
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </HospitalProtectedRoute>
    );
  }

  // Show empty state with "Add Role" button if no custom roles exist
  if (customRoles.length === 0) {
    return (
      <HospitalProtectedRoute>
        <div className="flex h-screen bg-[#E6EEF8]">
          <div className="h-full w-[17rem] flex-shrink-0">
                <HosSidebar />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto">
              <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h1 className="text-3xl font-bold text-gray-900">Custom Role Management</h1>
                        <p className="text-gray-600 mt-2">
                          Create and manage custom roles for your hospital
                        </p>
                      </div>
                      <button
                        onClick={() => router.push("/Hospital/createRole")}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
                      >
                        <span>Create Custom Role</span>
                      </button>
                    </div>

                {/* Empty State */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-12 text-center">
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-semibold text-gray-900 mb-4">No Custom Roles Yet</h3>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto">
                          Create your first custom role to start managing hospital-specific user types like nurses, lab technicians, or receptionists.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <button
                            onClick={() => router.push("/Hospital/createRole")}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Create Your First Role</span>
                          </button>
                          <button
                            onClick={() => router.push("/Hospital/doctor")}
                            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                          >
                            Manage Global Users
                          </button>
                        </div>
                      </div>
                    </div>
              </div>
            </main>
          </div>
        </div>
      </HospitalProtectedRoute>
    );
  }

  return (
    <HospitalProtectedRoute>
      <div className="flex h-screen bg-[#E6EEF8]">
        <div className="h-full w-[17rem] flex-shrink-0">
              <HosSidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <UserManagement
              title="Custom Role Management"
              subtitle={`Manage users with custom roles - ${customRoles.length} custom roles available`}
              buttonText="Add Custom Role User"
              addButtonRoute="/Hospital/addCustomRoleUser"
              roleType="hospital"
              availableRoles={customRoles.map(role => role.role_name.toLowerCase().replace(/\s+/g, '_'))}
              availableSpecialties={['General', 'Emergency', 'Outpatient', 'Surgery', 'ICU']}
              apiFunctions={createDynamicApiFunctions()}
              onAddClick={handleAddUser}
              onView={handleView}
              onPause={handlePause}
              onDelete={handleDelete}
              showAddButton={true}
              showSpecialty={true}
              statsConfig={createDynamicStatsConfig()}
            />
          </main>
        </div>
      </div>
    </HospitalProtectedRoute>
  );
}
