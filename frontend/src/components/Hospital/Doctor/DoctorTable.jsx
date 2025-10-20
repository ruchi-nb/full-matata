'use client';

import React, { useState, useEffect } from "react";
import {
  Mail,
  Phone,
  SquarePen,
  Pause,
  Trash2,
} from "lucide-react";
import { listHospitalDoctors, removeDoctorFromHospital } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";

const DoctorTable = ({ onView, onPause, onDelete }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, getHospitalId } = useUser();

  useEffect(() => {
    async function loadHospitalDoctors() {
      try {
        // Get hospital_id using the enhanced getHospitalId function
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        const doctorsList = await listHospitalDoctors(hospitalId);
        setDoctors(doctorsList || []);
      } catch (error) {
        console.error("Failed to load hospital doctors:", error);
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    }

    // Only load if user is available
    if (user) {
      loadHospitalDoctors();
    }
  }, [user, getHospitalId]);

  const handleDelete = async (doctor) => {
    if (window.confirm(`Are you sure you want to remove ${doctor.username} from the hospital?`)) {
      try {
        // Get hospital_id using the enhanced getHospitalId function
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          alert("No hospital ID found for user");
          return;
        }

        await removeDoctorFromHospital(hospitalId, doctor.user_id);
        // Reload the doctors list
        const doctorsList = await listHospitalDoctors(hospitalId);
        setDoctors(doctorsList || []);
        onDelete?.(doctor);
      } catch (error) {
        console.error("Failed to remove doctor:", error);
        alert("Failed to remove doctor. Please try again.");
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
                Doctor
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
                {/* Doctor Info */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {doctor.username?.charAt(0)?.toUpperCase() || 'D'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {doctor.username || `Doctor ${doctor.user_id}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {doctor.user_id}
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
                      onClick={() => onView?.(doctor)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Profile"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onPause?.(doctor)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Pause"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doctor)}
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
  );
};

export default DoctorTable;
