'use client';

import React, { useState, useEffect } from "react";
import {
  User,
  SquarePen,
  Trash2,
} from "lucide-react";
import { getHospitalUsers, getHospitalUsersDebug, removeDoctorFromHospital } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";
import DoctorFilters from "./DoctorFilters";
import DoctorViewModal from "./DoctorViewModal";

const DoctorTable = ({ onView, onDelete }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [role, setRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    // Only load if user is available
    if (user) {
      loadHospitalUsers();
    }
  }, [user]);

  // Filter users based on search, specialty, and role
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (search) {
      filtered = filtered.filter(user => 
        user.username?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Role filter
    if (role !== "all") {
      filtered = filtered.filter(user => 
        user.global_role?.role_name === role
      );
    }

    // Specialty filter (assuming users have specialties - you may need to adjust this)
    if (specialty !== "all") {
      filtered = filtered.filter(user => 
        user.specialties?.some(spec => spec.name === specialty) ||
        user.specialty === specialty
      );
    }

    setFilteredUsers(filtered);
  }, [users, search, specialty, role]);

  const handleView = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    onView?.(user);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleModalEdit = () => {
    // Reload users list after edit
    loadHospitalUsers();
  };

  const handleDelete = async (userToDelete) => {
    if (window.confirm(`Are you sure you want to remove ${userToDelete.username} from the hospital?`)) {
      try {
        // Get hospital_id from user context
        const hospitalId = user?.hospital_id || user?.hospital_roles?.[0]?.hospital_id;
        
        if (!hospitalId) {
          alert("No hospital ID found for user");
          return;
        }

        await removeDoctorFromHospital(hospitalId, userToDelete.user_id);
        // Reload the users list
        const usersList = await getHospitalUsers(hospitalId);
        setUsers(usersList || []);
        onDelete?.(userToDelete);
      } catch (error) {
        console.error("Failed to remove user:", error);
        alert("Failed to remove user. Please try again.");
      }
    }
  };

  const loadHospitalUsers = async () => {
    try {
      // Get hospital_id from user context
      const hospitalId = user?.hospital_id || user?.hospital_roles?.[0]?.hospital_id;
      
      if (!hospitalId) {
        console.error("No hospital ID found for user");
        setLoading(false);
        return;
      }

      // First, let's debug what's in the database
      console.log("=== DEBUGGING DATABASE ===");
      const debugInfo = await getHospitalUsersDebug(hospitalId);
      console.log("Debug info:", debugInfo);
      
      // Now get the actual users
      const usersList = await getHospitalUsers(hospitalId);
      console.log("Hospital users API response:", usersList);
      console.log("Response type:", typeof usersList);
      console.log("Response length:", usersList?.length);
      console.log("First user:", usersList?.[0]);
      setUsers(usersList || []);
    } catch (error) {
      console.error("Failed to load hospital users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="opacity-50">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          No users found. Add users to get started.
        </div>
      </div>
    );
  }

  return (
    <>
      <DoctorFilters
        search={search}
        onSearchChange={setSearch}
        specialty={specialty}
        onSpecialtyChange={setSpecialty}
        role={role}
        onRoleChange={setRole}
        filteredCount={filteredUsers.length}
        totalCount={users.length}
      />
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-900">
                  Name
                </th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">
                  Email
                </th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">
                  Role
                </th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
              <tr
                key={user.user_id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                {/* Name */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {(user.first_name?.charAt(0) || user.last_name?.charAt(0) || user.username?.charAt(0) || 'U').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}`
                          : user.first_name || user.last_name || user.username || `User ${user.user_id}`
                        }
                      </div>
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="py-4 px-6 text-gray-900">
                  <div className="flex items-center space-x-1">
                    <span>{user.email || 'N/A'}</span>
                  </div>
                </td>

                {/* Role */}
                <td className="py-4 px-6 text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {user.global_role?.role_name || 'Unknown'}
                  </span>
                </td>

                {/* Actions */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleView(user)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Profile"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove from Hospital"
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
    </div>
    
    {/* Doctor View Modal */}
    <DoctorViewModal
      user={selectedUser}
      isOpen={isModalOpen}
      onClose={handleModalClose}
      onEdit={handleModalEdit}
    />
    </>
  );
};

export default DoctorTable;
