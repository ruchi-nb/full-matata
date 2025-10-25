'use client';
import React, { useMemo, useState, useContext, useEffect } from "react";
import { User, FileText, Save, Key, X, RefreshCw } from "lucide-react";
import { createHospitalUser, getHospitalRoles } from '@/data/api-hospital-admin';
import { createUserForHospital } from '@/data/api-superadmin';
import { useUser } from '@/data/UserContext';
import { LifeLine } from 'react-loading-indicators';

// Mock context for hospital ID (you might have this in your app)
const HospitalContext = React.createContext();

const DEFAULT_ROLES = [
  { name: "doctor", label: "Doctor", isDefault: true },
  { name: "patient", label: "Patient", isDefault: true }
];

// Hardcoded specialties removed - now fetched from backend


function randFrom(chars, n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const DoctorForm = ({ onSuccess, onCancel, context = 'hospital-admin', hospitalId: propHospitalId = null }) => {
  const { user, getHospitalId } = useUser();
  const hospitalId = propHospitalId || getHospitalId();
  const hasHospitalAccess = !!hospitalId;
  const isSuperAdminContext = context === 'superadmin';

  // Early return before any other hooks to avoid Rules of Hooks violation
  if (!hasHospitalAccess) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">You don't have permission to access this hospital's data.</p>
        </div>
      </div>
    );
  }

  console.log("🔍 DoctorForm Debug:", {
    user: user ? { 
      user_id: user.user_id, 
      role: user._detectedRole || user.role_name,
      hospital_id: user.hospital_id 
    } : null,
    hospitalId,
    hasHospitalAccess
  });

  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [specialties, setSpecialties] = useState([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(true);

  // Load custom roles dynamically
  useEffect(() => {
    async function loadRoles() {
      try {
        if (!hospitalId) {
          setLoadingRoles(false);
          return;
        }

        // For superadmin context, we might have different role loading logic
        if (isSuperAdminContext) {
          // Superadmin can create users with any role, including custom hospital roles
          try {
            const customRoles = await getHospitalRoles(hospitalId);
            const customRoleObjects = customRoles.map(role => ({
              name: role.role_name,
              label: role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' '),
              isDefault: false,
              hospital_role_id: role.hospital_role_id,
              description: role.description
            }));
            
            // Combine roles and remove duplicates based on role name
            const allRoles = [...DEFAULT_ROLES, ...customRoleObjects];
            const uniqueRoles = allRoles.filter((role, index, self) => 
              index === self.findIndex(r => r.name === role.name)
            );
            setAvailableRoles(uniqueRoles);
            console.log("✅ Superadmin: Custom roles loaded:", customRoleObjects.length);
          } catch (error) {
            console.log("⚠️ Superadmin: Custom roles endpoint not available, using default roles only");
            setAvailableRoles(DEFAULT_ROLES);
            setRolesError("Custom roles not available - using default roles only");
          }
        } else {
          // Hospital admin context - try to fetch custom roles
          try {
            const customRoles = await getHospitalRoles(hospitalId);
            const customRoleObjects = customRoles.map(role => ({
              name: role.role_name,
              label: role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' '),
              isDefault: false,
              hospital_role_id: role.hospital_role_id,
              description: role.description
            }));
            
            // Combine roles and remove duplicates based on role name
            const allRoles = [...DEFAULT_ROLES, ...customRoleObjects];
            const uniqueRoles = allRoles.filter((role, index, self) => 
              index === self.findIndex(r => r.name === role.name)
            );
            setAvailableRoles(uniqueRoles);
            console.log("✅ Hospital admin: Custom roles loaded:", customRoleObjects.length);
          } catch (error) {
            console.log("⚠️ Hospital admin: Custom roles endpoint not available, using default roles only");
            console.log("Error details:", error.message);
            setAvailableRoles(DEFAULT_ROLES);
            setRolesError("Custom roles not available - using default roles only");
          }
        }
      } catch (error) {
        console.error("Failed to load roles:", error);
        setRolesError("Failed to load roles. Using default roles only.");
        setAvailableRoles(DEFAULT_ROLES);
      } finally {
        setLoadingRoles(false);
      }
    }

    if (hospitalId) {
      loadRoles();
    }
  }, [hospitalId, isSuperAdminContext]);

  // Load specialties from backend
  useEffect(() => {
    async function loadSpecialties() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const accessToken = document.cookie.split('accessToken=')[1]?.split(';')[0];
        
        console.log("🔍 Fetching specialties from:", `${backendUrl}/hospitals/specialities`);
        
        const response = await fetch(`${backendUrl}/hospitals/specialities`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("✅ Specialties loaded:", data);
          setSpecialties(data || []);
        } else {
          console.error("Failed to load specialties:", response.status, response.statusText);
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

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    specialty: "",
    password: "",
    genMode: "pattern", // 'pattern' | 'random'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Set default role when roles are loaded
  useEffect(() => {
    if (availableRoles.length > 0 && !form.role) {
      setForm(prev => ({ ...prev, role: availableRoles[0].name }));
    }
  }, [availableRoles, form.role]);

  const username = useMemo(() => form.email.trim(), [form.email]);

  const onChange = (field) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value ?? e;
    setForm((f) => ({ ...f, [field]: value }));
    // Clear messages when user starts typing
    if (error || success) {
      setError("");
      setSuccess("");
    }
  };


  const isClinician = form.role === "doctor" || form.role === "nurse" || form.role === "lab technician" || 
                     (form.role && !availableRoles.find(r => r.name === form.role)?.isDefault);

  const refreshRoles = async () => {
    setLoadingRoles(true);
    setRolesError("");
    try {
      // Try to fetch custom roles, but don't fail if endpoint doesn't exist
      try {
        const customRoles = await getHospitalRoles(hospitalId);
        const customRoleObjects = customRoles.map(role => ({
          name: role.role_name,
          label: role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1).replace('_', ' '),
          isDefault: false,
          hospital_role_id: role.hospital_role_id,
          description: role.description
        }));
        
        // Combine roles and remove duplicates based on role name
        const allRoles = [...DEFAULT_ROLES, ...customRoleObjects];
        const uniqueRoles = allRoles.filter((role, index, self) => 
          index === self.findIndex(r => r.name === role.name)
        );
        setAvailableRoles(uniqueRoles);
        console.log(`✅ ${isSuperAdminContext ? 'Superadmin' : 'Hospital admin'}: Roles refreshed successfully:`, customRoleObjects.length);
      } catch (error) {
        console.log(`⚠️ ${isSuperAdminContext ? 'Superadmin' : 'Hospital admin'}: Custom roles endpoint not available during refresh`);
        setAvailableRoles(DEFAULT_ROLES);
        setRolesError("Custom roles not available - using default roles only");
      }
    } catch (error) {
      console.error("Failed to refresh roles:", error);
      setRolesError("Failed to refresh roles. Please try again.");
    } finally {
      setLoadingRoles(false);
    }
  };

  const generatePassword = () => {
    if (form.genMode === "random") {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
      const pw = randFrom(chars, 12);
      setForm((f) => ({ ...f, password: pw }));
      return;
    }
    // pattern: first 2 of first name + first 2 of last name + last 4 of phone + random 2
    const f2 = (form.firstName || "").replace(/\s+/g, "").slice(0, 2).toLowerCase();
    const l2 = (form.lastName || "").replace(/\s+/g, "").slice(0, 2).toLowerCase();
    const last4 = (form.phone || "").replace(/\D/g, "").slice(-4);
    const extra = randFrom("!@#$%abcdefghijkmnpqrstuvwxyz23456789", 2);
    const base = `${f2}${l2}${last4}${extra}`;
    setForm((f) => ({ ...f, password: base || randFrom("abcdefghijkmnpqrstuvwxyz23456789", 8) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate required fields (matching backend schema)
      if (!form.email || !form.role || !form.password) {
        throw new Error("Please fill in all required fields (Email, Role, Password)");
      }

      if (isClinician && !form.specialty) {
        throw new Error("Please select a specialty for clinician roles");
      }

      // Prepare payload according to API expectations
      const payload = {
        email: form.email,
        role_name: form.role,
        username: username,
        password: form.password,
        // Include optional fields only if they have values
        ...(form.firstName && { first_name: form.firstName }),
        ...(form.lastName && { last_name: form.lastName }),
        ...(form.phone && { phone: form.phone }),
        // Include specialty only for clinicians
        ...(isClinician && form.specialty && {
          specialty: form.specialty,
        }),
      };

      // Prepare specialty IDs array (convert specialty name to ID)
      const specialtyIds = isClinician && form.specialty ? 
        [specialties.find(s => s.name === form.specialty)?.specialty_id || form.specialty] : 
        [];

      console.log("Calling API with:", {
        hospitalId,
        payload,
        specialtyIds,
        context: isSuperAdminContext ? 'superadmin' : 'hospital-admin'
      });
      
      // Debug: Log the actual payload being sent
      console.log("🔍 Payload details:", {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        role_name: payload.role_name,
        username: payload.username,
        password: payload.password ? '***' : 'MISSING',
        phone: payload.phone,
        specialty: payload.specialty
      });

      // Call the appropriate API based on context
      let result;
      if (isSuperAdminContext) {
        // Use superadmin API for user creation
        result = await createUserForHospital(hospitalId, payload);
        console.log("✅ Superadmin API called successfully");
      } else {
        // Use hospital admin API for user creation
        result = await createHospitalUser(hospitalId, payload);
        console.log("✅ Hospital admin API called successfully");
      }

      // Handle success
      setSuccess(`User ${form.firstName} ${form.lastName} created successfully!`);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }

      // Reset form after successful submission
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "",
        specialty: "",
        password: "",
        genMode: "pattern",
      });

    } catch (err) {
      console.error("Failed to create user:", err);
      setError(err.message || "Failed to create user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      // Default cancel behavior
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "",
        specialty: "",
        password: "",
        genMode: "pattern",
      });
      setError("");
      setSuccess("");
    }
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-green-500 hover:text-green-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Personal Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-6">
          <User className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Personal Information
            {isSuperAdminContext && (
              <span className="ml-2 text-sm font-normal text-purple-600 bg-purple-100 px-2 py-1 rounded">
                Superadmin Mode
              </span>
            )}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              required
              type="text"
              placeholder="Enter first name"
              value={form.firstName}
              onChange={onChange("firstName")}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              required
              type="text"
              placeholder="Enter last name"
              value={form.lastName}
              onChange={onChange("lastName")}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address (username) *
            </label>
            <input
              required
              type="email"
              placeholder="user@hospital.com"
              value={form.email}
              onChange={onChange("email")}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={onChange("phone")}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Role selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Role *
              </label>
              <button
                type="button"
                onClick={refreshRoles}
                disabled={loadingRoles || loading}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                <RefreshCw className={`h-3 w-3 ${loadingRoles ? 'animate-spin' : ''}`} />
                <span>Refresh Roles</span>
              </button>
            </div>
            <select
              required
              value={form.role}
              onChange={(e) => {
                const newRole = e.target.value;
                const selectedRole = availableRoles.find(r => r.name === newRole);
                setForm((f) => ({
                  ...f,
                  role: newRole,
                  // reset clinician-only fields if switching to patient or non-clinician role
                  specialty: newRole === "patient" ? "" : f.specialty,
                }));
              }}
              disabled={loading || loadingRoles}
              className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">Select role</option>
              {availableRoles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.label} {role.isDefault ? '(Default)' : '(Custom)'}
                </option>
              ))}
            </select>
            {rolesError && (
              <p className="text-red-500 text-xs mt-1">{rolesError}</p>
            )}
            {form.role && (
              <p className="text-gray-500 text-xs mt-1">
                {availableRoles.find(r => r.name === form.role)?.description || 
                 `${form.role.charAt(0).toUpperCase() + form.role.slice(1)} role`}
              </p>
            )}
            {availableRoles.length === DEFAULT_ROLES.length && (
              <p className="text-blue-500 text-xs mt-1">
                💡 Only default roles available. Create custom roles to see more options.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Key className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Login Credentials
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              readOnly
              placeholder="Auto-filled from email"
              className="w-full px-4 py-2 text-gray-800 bg-gray-50 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              required
              type="text"
              placeholder="Click Generate or type your own"
              value={form.password}
              onChange={onChange("password")}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Generation Mode
            </label>
            <div className="flex items-center gap-2">
              <select
                value={form.genMode}
                onChange={onChange("genMode")}
                disabled={loading}
                className="flex-1 px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="pattern">Name+Phone Pattern</option>
                <option value="random">Random Secure</option>
              </select>
              <button
                type="button"
                onClick={generatePassword}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Generate Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Information (conditional) */}
      {isClinician && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Professional Details
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialty *
              </label>
              <select
                required
                value={form.specialty}
                onChange={onChange("specialty")}
                disabled={loading || loadingSpecialties}
                className="w-full px-4 py-2 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">
                  {loadingSpecialties ? "Loading specialties..." : "Select specialty"}
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

          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <LifeLine color="#ffffff" size="small" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Create User</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

// Provider component for hospital context
export const HospitalProvider = ({ children, hospitalId }) => {
  return (
    <HospitalContext.Provider value={{ hospitalId }}>
      {children}
    </HospitalContext.Provider>
  );
};

export default DoctorForm;