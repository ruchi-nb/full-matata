'use client';
import React, { useState, useEffect } from "react";
import { Search, Funnel } from "lucide-react";

const DoctorFilters = ({
  search,
  onSearchChange,
  specialty,
  onSpecialtyChange,
  role,
  onRoleChange,
  filteredCount = 0,
  totalCount = 0,
}) => {
  // Get the display name for the selected role
  const getRoleDisplayName = (roleValue) => {
    switch (roleValue) {
      case 'doctor': return 'Doctors';
      case 'nurse': return 'Nurses';
      case 'patient': return 'Patients';
      case 'lab_technician': return 'Lab Technicians';
      case 'all': return 'Roles';
      default: return 'Roles';
    }
  };

  const selectedRoleDisplay = getRoleDisplayName(role);

  // Load specialties from backend
  const [specialties, setSpecialties] = useState([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(true);

  useEffect(() => {
    async function loadSpecialties() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const accessToken = document.cookie.split('accessToken=')[1]?.split(';')[0];
        
        const response = await fetch(`${backendUrl}/hospitals/specialities`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setSpecialties(data || []);
        } else {
          console.error("Failed to load specialties:", response.status);
          setSpecialties([]);
        }
      } catch (error) {
        console.error("Error loading specialties:", error);
        setSpecialties([]);
      } finally {
        setLoadingSpecialties(false);
      }
    }

    loadSpecialties();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
          
          {/* Role Select */}
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
          >
            <option value="all">All Roles</option>
            <option value="doctor">Doctors</option>
            <option value="nurse">Nurses</option>
            <option value="patient">Patients</option>
            <option value="lab_technician">Lab Technicians</option>
          </select>

          <select
            value={specialty}
            onChange={(e) => onSpecialtyChange(e.target.value)}
            disabled={loadingSpecialties}
            className="px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 w-full sm:w-auto"
          >
            <option value="all">
              {loadingSpecialties ? "Loading specialties..." : "All Specialties"}
            </option>
            {specialties.length > 0 ? (
              specialties.map((s) => (
                <option key={s.specialty_id} value={s.name}>
                  {s.name}
                </option>
              ))
            ) : (
              !loadingSpecialties && <option value="" disabled>No specialties available</option>
            )}
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Funnel className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {filteredCount} of {totalCount} {selectedRoleDisplay.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DoctorFilters;