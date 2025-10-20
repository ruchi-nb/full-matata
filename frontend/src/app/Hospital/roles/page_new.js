'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import HosSidebar from "@/components/Hospital/Sidebar";
import { Plus, Users, Shield, Edit, Trash2 } from "lucide-react";
import { useUser } from "@/data/UserContext";
import { request } from "@/data/api";

export default function CustomRoleManagementPage() {
  const router = useRouter();
  const { user, getHospitalId } = useUser();
  const [customRoles, setCustomRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load custom roles
  useEffect(() => {
    async function loadCustomRoles() {
      try {
        const hospitalId = getHospitalId();
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        console.log("🔍 Loading custom roles for hospital:", hospitalId);
        
        const roles = await request(`/hospitals/${hospitalId}/roles`, { method: "GET" });
        console.log("✅ Roles loaded:", roles);
        
        // Filter out default roles (doctor, patient, hospital_admin)
        const customOnly = roles.filter(r => 
          !['doctor', 'patient', 'hospital_admin'].includes(r.role_name.toLowerCase())
        );
        
        setCustomRoles(customOnly);
        
        // Auto-select first role if available
        if (customOnly.length > 0) {
          setSelectedRole(customOnly[0].role_name);
        }
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
  }, [user, getHospitalId]);

  // Load users for selected role
  useEffect(() => {
    async function loadRoleUsers() {
      if (!selectedRole) {
        setRoleUsers([]);
        return;
      }

      setLoadingUsers(true);
      try {
        const hospitalId = getHospitalId();
        console.log(`🔍 Loading users for role: ${selectedRole}`);
        
        const users = await request(
          `/hospital-admin/hospitals/${hospitalId}/roles/${selectedRole}/users`,
          { method: "GET" }
        );
        console.log("✅ Users loaded:", users);
        setRoleUsers(users || []);
      } catch (error) {
        console.error(`Failed to load users for role ${selectedRole}:`, error);
        setRoleUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    }

    loadRoleUsers();
  }, [selectedRole, getHospitalId]);

  const handleEditUser = (userId) => {
    router.push(`/Hospital/editUser?userId=${userId}`);
  };

  const handleDeleteUser = async (userId) => {
    // Implement deactivate user
    if (window.confirm("Are you sure you want to deactivate this user?")) {
      try {
        const hospitalId = getHospitalId();
        await request(
          `/hospital-admin/hospitals/${hospitalId}/users/${userId}/deactivate`,
          { method: "PUT" }
        );
        alert("User deactivated successfully");
        // Reload users
        const users = await request(
          `/hospital-admin/hospitals/${hospitalId}/roles/${selectedRole}/users`,
          { method: "GET" }
        );
        setRoleUsers(users || []);
      } catch (error) {
        alert("Failed to deactivate user");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#E6EEF8]">
        <div className="h-full w-[17rem] flex-shrink-0">
          <HosSidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading custom roles...</div>
        </div>
      </div>
    );
  }

  // Show empty state if no custom roles
  if (customRoles.length === 0) {
    return (
      <div className="flex h-screen bg-[#E6EEF8]">
        <div className="h-full w-[17rem] flex-shrink-0">
          <HosSidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="p-6 max-w-7xl mx-auto">
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
                  <Plus className="h-4 w-4" />
                  <span>Create Custom Role</span>
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-12 text-center">
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Shield className="h-12 w-12 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">No Custom Roles Yet</h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    Create your first custom role to start managing hospital-specific user types like nurses, lab technicians, or receptionists.
                  </p>
                  <button
                    onClick={() => router.push("/Hospital/createRole")}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center space-x-2"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Create Your First Role</span>
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
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
                  Manage users with custom roles - {customRoles.length} custom role{customRoles.length !== 1 ? 's' : ''} available
                </p>
              </div>
              <button
                onClick={() => router.push("/Hospital/createRole")}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Role</span>
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {customRoles.map((role, index) => (
                <div key={role.role_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 ${
                      index % 4 === 0 ? 'bg-blue-50' :
                      index % 4 === 1 ? 'bg-purple-50' :
                      index % 4 === 2 ? 'bg-green-50' : 'bg-orange-50'
                    } rounded-lg`}>
                      <Users className={`h-6 w-6 ${
                        index % 4 === 0 ? 'text-blue-600' :
                        index % 4 === 1 ? 'text-purple-600' :
                        index % 4 === 2 ? 'text-green-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{role.role_name}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {selectedRole === role.role_name ? roleUsers.length : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Role Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Role to View Users
              </label>
              <select
                value={selectedRole || ''}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {customRoles.map((role) => (
                  <option key={role.role_id} value={role.role_name}>
                    {role.role_name} Role
                  </option>
                ))}
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Users with "{selectedRole}" Role
                </h2>
              </div>
              
              {loadingUsers ? (
                <div className="p-8 text-center text-gray-600">Loading users...</div>
              ) : roleUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No users with this role yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-4 px-6 font-medium text-gray-900">User</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-900">Email</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-900">User ID</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleUsers.map((user) => (
                        <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                                {user.username?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.username || `User ${user.user_id}`}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {selectedRole} • ID: {user.user_id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-900">{user.email}</td>
                          <td className="py-4 px-6 text-gray-900">{user.user_id}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditUser(user.user_id)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit User"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.user_id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Deactivate User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

