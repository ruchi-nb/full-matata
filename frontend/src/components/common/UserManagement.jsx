'use client';

import React, { useState, useEffect, useMemo } from "react";
import { User, Users, Stethoscope, Microscope, SquarePen, Pause, Trash2 } from "lucide-react";
import { 
  listHospitalDoctors, 
  listHospitalNurses, 
  listHospitalPatients, 
  listHospitalLabTechnicians,
  removeDoctorFromHospital 
} from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";
import { ScaleIn, FadeIn } from "@/components/common/animations";

// Stats Card Component
const StatsCard = ({ icon: Icon, bgColor, iconColor, label, value }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center space-x-3">
      <div className={`p-2 ${bgColor} rounded-lg`}>
        <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

// Management Header Component
const ManagementHeader = ({ title, subtitle, buttonText, onAddClick, showAddButton = true }) => (
  <div className="flex items-center justify-between mb-8">
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-600 mt-2">{subtitle}</p>
    </div>
    {showAddButton && (
      <button
        onClick={onAddClick}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
      >
        <span>{buttonText}</span>
      </button>
    )}
  </div>
);

// Filters Component
const UserFilters = ({
  search,
  onSearchChange,
  role,
  onRoleChange,
  specialty,
  onSpecialtyChange,
  filteredCount = 0,
  totalCount = 0,
  availableRoles = ['doctor', 'nurse', 'patient', 'lab_technician'],
  availableSpecialties = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology']
}) => {
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
            {availableRoles.map(roleType => (
              <option key={roleType} value={roleType}>
                {getRoleDisplayName(roleType)}
              </option>
            ))}
          </select>

          {/* Specialty Select */}
          <select
            value={specialty}
            onChange={(e) => onSpecialtyChange(e.target.value)}
            className="px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Specialties</option>
            {availableSpecialties.map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {filteredCount} of {totalCount} {selectedRoleDisplay.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

// User Table Component
const UserTable = ({ 
  users, 
  onView, 
  onPause, 
  onDelete, 
  loading = false,
  userType = 'doctor',
  showSpecialty = true,
  roleType = 'global'
}) => {
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'doctor': return 'Doctor';
      case 'nurse': return 'Nurse';
      case 'patient': return 'Patient';
      case 'lab_technician': return 'Lab Technician';
      default: return 'User';
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
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No {getRoleDisplayName(userType).toLowerCase()}s found
          </h3>
          <p className="text-gray-600 mb-4">
            {roleType === 'hospital' 
              ? `No users assigned to custom roles yet. Create custom roles first, then add users.`
              : `No ${getRoleDisplayName(userType).toLowerCase()}s found. Add ${getRoleDisplayName(userType).toLowerCase()}s to get started.`
            }
          </p>
          {roleType === 'hospital' && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/Hospital/createRole'}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Create Custom Role
              </button>
              <button
                onClick={() => window.location.href = '/Hospital/addCustomRoleUser'}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Add User to Role
              </button>
            </div>
          )}
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
                {getRoleDisplayName(userType)}
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                Email
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                User ID
              </th>
              {showSpecialty && (
                <th className="text-left py-4 px-6 font-medium text-gray-900">
                  Specialty
                </th>
              )}
              <th className="text-left py-4 px-6 font-medium text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.user_id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                {/* User Info */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {user.username?.charAt(0)?.toUpperCase() || user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.username || user.name || `${getRoleDisplayName(userType)} ${user.user_id}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {user.user_id}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="py-4 px-6 text-gray-900">
                  <span>{user.email || 'N/A'}</span>
                </td>

                {/* User ID */}
                <td className="py-4 px-6 text-gray-900">
                  {user.user_id}
                </td>

                {/* Specialty */}
                {showSpecialty && (
                  <td className="py-4 px-6 text-gray-900">
                    {user.specialty || user.speciality || 'N/A'}
                  </td>
                )}

                {/* Actions */}
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    {onView && (
                      <button
                        onClick={() => onView(user)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Profile"
                      >
                        <SquarePen className="h-4 w-4" />
                      </button>
                    )}
                    {onPause && (
                      <button
                        onClick={() => onPause(user)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(user)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from Hospital"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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

// Main UserManagement Component
const UserManagement = ({
  // Configuration props
  title = "User Management",
  subtitle = "Manage your AI doctor avatars and their configurations",
  buttonText = "Add User",
  addButtonRoute = "/Hospital/addDoctor",
  
  // Role configuration
  roleType = "global", // "global" or "hospital"
  availableRoles = ['doctor', 'nurse', 'patient', 'lab_technician'],
  availableSpecialties = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology'],
  
  // API configuration
  apiFunctions = {
    doctors: listHospitalDoctors,
    nurses: listHospitalNurses,
    patients: listHospitalPatients,
    labTechnicians: listHospitalLabTechnicians
  },
  
  // Callbacks
  onAddClick = null,
  onView = null,
  onPause = null,
  onDelete = null,
  
  // UI configuration
  showAddButton = true,
  showSpecialty = true,
  statsConfig = {
    showDoctors: true,
    showPatients: true,
    showNurses: false,
    showLabTechnicians: false
  }
}) => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, getHospitalId } = useUser();

  // Load users based on role filter
  useEffect(() => {
    async function loadUsers() {
      try {
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        let usersData = [];
        
        if (roleFilter === "all") {
          // Load all user types based on available roles
          const promises = [];
          
          // Map available roles to API functions
          availableRoles.forEach(role => {
            if (role === 'doctor' && apiFunctions.doctors) {
              promises.push(apiFunctions.doctors(hospitalId));
            } else if (role === 'patient' && apiFunctions.patients) {
              promises.push(apiFunctions.patients(hospitalId));
            } else if (role === 'nurse' && apiFunctions.nurses) {
              promises.push(apiFunctions.nurses(hospitalId));
            } else if (role === 'lab_technician' && apiFunctions.labTechnicians) {
              promises.push(apiFunctions.labTechnicians(hospitalId));
            } else if (role === 'hospital_admin' && apiFunctions.hospitalAdmins) {
              promises.push(apiFunctions.hospitalAdmins(hospitalId));
            }
          });
          
          const results = await Promise.all(promises);
          usersData = results.flat().filter(Boolean);
        } else {
          // Load specific role type
          let apiFunction = null;
          
          if (roleFilter === 'doctor' && apiFunctions.doctors) {
            apiFunction = apiFunctions.doctors;
          } else if (roleFilter === 'patient' && apiFunctions.patients) {
            apiFunction = apiFunctions.patients;
          } else if (roleFilter === 'nurse' && apiFunctions.nurses) {
            apiFunction = apiFunctions.nurses;
          } else if (roleFilter === 'lab_technician' && apiFunctions.labTechnicians) {
            apiFunction = apiFunctions.labTechnicians;
          } else if (roleFilter === 'hospital_admin' && apiFunctions.hospitalAdmins) {
            apiFunction = apiFunctions.hospitalAdmins;
          }
          
          if (apiFunction) {
            usersData = await apiFunction(hospitalId);
          }
        }

        setUsers(usersData || []);
      } catch (error) {
        console.error("Failed to load users:", error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadUsers();
    }
  }, [user, roleFilter, apiFunctions, availableRoles]);

  // Filter users based on search and specialty
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = 
        user.username?.toLowerCase().includes(search.toLowerCase()) ||
        user.name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase());
      
      const matchesSpecialty = 
        specialtyFilter === "all" || 
        user.specialty === specialtyFilter || 
        user.speciality === specialtyFilter;

      return matchesSearch && matchesSpecialty;
    });
  }, [users, search, specialtyFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const doctors = users.filter(u => u.role === 'doctor' || roleFilter === 'doctor' || (roleFilter === 'all' && availableRoles.includes('doctor')));
    const patients = users.filter(u => u.role === 'patient' || roleFilter === 'patient' || (roleFilter === 'all' && availableRoles.includes('patient')));
    const nurses = users.filter(u => u.role === 'nurse' || roleFilter === 'nurse' || (roleFilter === 'all' && availableRoles.includes('nurse')));
    const labTechnicians = users.filter(u => u.role === 'lab_technician' || roleFilter === 'lab_technician' || (roleFilter === 'all' && availableRoles.includes('lab_technician')));
    const hospitalAdmins = users.filter(u => u.role === 'hospital_admin' || roleFilter === 'hospital_admin' || (roleFilter === 'all' && availableRoles.includes('hospital_admin')));

    return {
      doctors: doctors.length,
      patients: patients.length,
      nurses: nurses.length,
      labTechnicians: labTechnicians.length,
      hospitalAdmins: hospitalAdmins.length
    };
  }, [users, roleFilter, availableRoles]);

  // Handle add button click
  const handleAddClick = () => {
    if (onAddClick) {
      onAddClick();
    } else {
      // Default behavior - navigate to route
      window.location.href = addButtonRoute;
    }
  };

  // Handle user actions
  const handleView = (user) => {
    if (onView) {
      onView(user);
    } else {
      console.log("Viewing profile:", user);
    }
  };

  const handlePause = (user) => {
    if (onPause) {
      onPause(user);
    } else {
      console.log("Pausing user:", user);
    }
  };

  const handleDelete = (user) => {
    if (onDelete) {
      onDelete(user);
    } else {
      console.log("Deleting user:", user);
    }
  };

  // Stats data configuration
  const statsData = [
    statsConfig.showHospitalAdmins && {
      icon: User,
      bgColor: "bg-red-50",
      iconColor: "text-red-600",
      label: "Total Hospital Admins",
      value: stats.hospitalAdmins,
    },
    statsConfig.showDoctors && {
      icon: User,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      label: "Total Doctors",
      value: stats.doctors,
    },
    statsConfig.showPatients && {
      icon: Stethoscope,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      label: "Total Patients",
      value: stats.patients,
    },
    statsConfig.showNurses && {
      icon: Users,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      label: "Total Nurses",
      value: stats.nurses,
    },
    statsConfig.showLabTechnicians && {
      icon: Microscope,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
      label: "Total Lab Technicians",
      value: stats.labTechnicians,
    },
  ].filter(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <FadeIn direction="up" duration={0.8} delay={0.2} speed={1}>
        <ScaleIn direction="up" duration={0.8} delay={0.4} speed={1}>
          <ManagementHeader
            title={title}
            subtitle={subtitle}
            buttonText={buttonText}
            onAddClick={handleAddClick}
            showAddButton={showAddButton}
          />
        </ScaleIn>
      </FadeIn>

      {/* Stats */}
      <FadeIn direction="up" duration={0.8} delay={0.4} speed={1}>
        <ScaleIn direction="up" duration={0.8} delay={0.6} speed={1}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {statsData.map((stat, index) => (
              <StatsCard
                key={index}
                icon={stat.icon}
                bgColor={stat.bgColor}
                iconColor={stat.iconColor}
                label={stat.label}
                value={stat.value}
              />
            ))}
          </div>
        </ScaleIn>
      </FadeIn>

      {/* Filters */}
      <FadeIn direction="up" duration={0.8} delay={0.6} speed={1}>
        <ScaleIn direction="up" duration={0.8} delay={0.8} speed={1}>
          <UserFilters
            search={search}
            onSearchChange={setSearch}
            role={roleFilter}
            onRoleChange={setRoleFilter}
            specialty={specialtyFilter}
            onSpecialtyChange={setSpecialtyFilter}
            filteredCount={filteredUsers.length}
            totalCount={users.length}
            availableRoles={availableRoles}
            availableSpecialties={availableSpecialties}
          />
        </ScaleIn>
      </FadeIn>

      {/* Table */}
      <FadeIn direction="up" duration={0.8} delay={0.8} speed={1}>
        <ScaleIn direction="up" duration={0.8} delay={1.0} speed={1}>
          <UserTable
            users={filteredUsers}
            onView={handleView}
            onPause={handlePause}
            onDelete={handleDelete}
            loading={loading}
            userType={roleFilter === 'all' ? 'user' : roleFilter}
            showSpecialty={showSpecialty}
            roleType={roleType}
          />
        </ScaleIn>
      </FadeIn>
    </div>
  );
};

export default UserManagement;
