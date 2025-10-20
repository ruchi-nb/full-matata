'use client';

import React, { useState, useEffect } from "react";
import {
  Mail,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { listHospitalDoctors, removeDoctorFromHospital } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";

const DoctorTable = ({ doctors = [], loading = false, onView, onPause, onDelete }) => {
  const { getHospitalId } = useUser();
  const router = useRouter();

  const handleEdit = (doctor) => {
    router.push(`/Hospital/editUser?userId=${doctor.user_id}`);
  };

  const handleDelete = async (doctor) => {
    const userName = doctor.first_name && doctor.last_name 
      ? `${doctor.first_name} ${doctor.last_name}` 
      : doctor.username || `User ${doctor.user_id}`;
      
    if (window.confirm(`Are you sure you want to deactivate ${userName}? They will no longer have access to the hospital.`)) {
      try {
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          alert("No hospital ID found");
          return;
        }

        // Soft delete - deactivate user in hospital_user_roles
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const accessToken = document.cookie.split('accessToken=')[1]?.split(';')[0];
        
        const response = await fetch(`${backendUrl}/hospital-admin/hospitals/${hospitalId}/users/${doctor.user_id}/deactivate`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          alert("User deactivated successfully");
          onDelete?.(doctor);
        } else {
          const error = await response.json();
          alert(`Failed to deactivate user: ${error.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error("Failed to deactivate user:", error);
        alert("Failed to deactivate user. Please try again.");
      }
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

  if (!doctors || doctors.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          No doctors found. Add doctors to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                All Users
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                Email
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                User ID
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => (
              <tr
                key={doctor.user_id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                {/* User Info */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                      doctor.roleType === 'Patient' ? 'bg-green-500' :
                      doctor.roleType === 'Nurse' ? 'bg-purple-500' :
                      'bg-blue-500'
                    }`}>
                      {doctor.username?.charAt(0)?.toUpperCase() || doctor.first_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {doctor.first_name && doctor.last_name 
                          ? `${doctor.first_name} ${doctor.last_name}`
                          : doctor.username || `User ${doctor.user_id}`
                        }
                      </div>
                      <div className="text-sm text-gray-500">
                        {doctor.roleType || 'User'} • ID: {doctor.user_id}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="py-4 px-6 text-gray-900">
                  <div className="flex items-center space-x-1">
                    <Mail className="h-3 w-3" />
                    <span>{doctor.email || 'N/A'}</span>
                  </div>
                </td>

                {/* User ID */}
                <td className="py-4 px-6 text-gray-900">
                  {doctor.user_id}
                </td>

                {/* Actions */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(doctor)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit User"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doctor)}
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
    </div>
  );
};

export default DoctorTable;
