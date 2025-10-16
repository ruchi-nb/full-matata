'use client';
import React from "react";
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-80"
            />
          </div>
          
          {/* Role Select */}
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Neurology">Neurology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Dermatology">Dermatology</option>
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