import { request } from './api.js';

// =============================================
// HOSPITAL ADMIN APIs
// =============================================

// Query parameter helper
function withQuery(path, params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) {
      v.forEach((val) => usp.append(k, String(val)));
    } else {
      usp.set(k, String(v));
    }
  });
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Get the hospital ID for the current hospital admin user
 */
export async function getMyHospitalId() {
  return request("/hospitals/my-hospital-id", { method: "GET" });
}

/**
 * Get hospital profile
 */
export function getHospitalProfile(hospitalId) {
  return request(withQuery("/hospitals/profile", { hospital_id: hospitalId }), { method: "GET" });
}

/**
 * Update hospital profile
 */
export function updateHospitalProfile(hospitalId, payload) {
  return request(withQuery("/hospitals/profile", { hospital_id: hospitalId }), {
    method: "PUT",
    body: JSON.stringify(payload || {}),
  });
}

// =============================================
// SPECIALTY MANAGEMENT APIs
// =============================================

/**
 * List all specialties
 */
export function listSpecialities(hospitalId) {
  return request(withQuery("/hospitals/specialities", { hospital_id: hospitalId }), { method: "GET" });
}

/**
 * Create new specialty
 */
export function createSpeciality(hospitalId, payload) {
  return request(withQuery("/hospitals/specialities", { hospital_id: hospitalId }), {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

/**
 * Update specialty
 */
export function updateSpeciality(hospitalId, id, payload) {
  return request(withQuery(`/hospitals/specialities/${id}`, { hospital_id: hospitalId }), {
    method: "PUT",
    body: JSON.stringify(payload || {}),
  });
}

/**
 * Delete specialty
 */
export function deleteSpeciality(hospitalId, id) {
  return request(withQuery(`/hospitals/specialities/${id}`, { hospital_id: hospitalId }), { method: "DELETE" });
}

// =============================================
// DOCTOR MANAGEMENT APIs
// =============================================

/**
 * Get all doctors (for admin purposes)
 */
export async function getAllDoctors() {
  return request('/search/doctors', { method: "GET" });
}

/**
 * List hospital doctors
 */
export function listHospitalDoctors(hospitalId) {
  return request(withQuery("/hospitals/doctors", { hospital_id: hospitalId }), { method: "GET" });
}

/**
 * Add doctor to hospital
 */
export function addDoctorToHospital(hospitalId, payload, specialtyIds) {
  const path = withQuery("/hospitals/doctors", {
    hospital_id: hospitalId,
    ...(Array.isArray(specialtyIds) && specialtyIds.length ? { specialty_ids: specialtyIds } : {}),
  });
  return request(path, { method: "POST", body: JSON.stringify(payload || {}) });
}

/**
 * Update doctor in hospital
 */
export function updateDoctorInHospital(hospitalId, doctorUserId, payload, specialtyIds) {
  const path = withQuery(`/hospitals/doctors/${doctorUserId}`, {
    hospital_id: hospitalId,
    ...(Array.isArray(specialtyIds) && specialtyIds.length ? { specialty_ids: specialtyIds } : {}),
  });
  return request(path, { method: "PUT", body: JSON.stringify(payload || {}) });
}

/**
 * Remove doctor from hospital
 */
export function removeDoctorFromHospital(hospitalId, doctorUserId) {
  return request(withQuery(`/hospitals/doctors/${doctorUserId}`, { hospital_id: hospitalId }), { method: "DELETE" });
}

// =============================================
// ROLE & PERMISSION MANAGEMENT APIs
// =============================================

/**
 * Get permissions catalog
 */
export async function getPermissionsCatalog() {
  return request("/api/permissions/catalog", { method: "GET" });
}

/**
 * Get hospital by ID
 */
export async function getHospitalById(hospitalId) {
  return request(`/hospitals/${hospitalId}`, { method: "GET" });
}

/**
 * Debug function to check what's in the database
 */
export async function getHospitalUsersDebug(hospitalId) {
  return request(`/hospitals/${hospitalId}/users/debug`, { method: "GET" });
}

/**
 * Get all users associated with a hospital from different association tables
 */
export async function getHospitalUsers(hospitalId) {
  return request(`/hospitals/${hospitalId}/users`, { method: "GET" });
}

/**
 * Get hospital specialties
 */
export async function getHospitalSpecialties(hospitalId) {
  return request(`/hospitals/${hospitalId}/specialties`, { method: "GET" });
}

/**
 * Get hospital roles
 */
export async function getHospitalRoles(hospitalId) {
  return request(`/hospital-admin/hospitals/${hospitalId}/roles`, { method: "GET" });
}

/**
 * Create hospital role
 */
export async function createHospitalRole(hospitalId, roleData) {
  return request(`/hospital-admin/hospitals/${hospitalId}/roles`, {
    method: "POST",
    body: JSON.stringify(roleData)
  });
}

/**
 * Get specific hospital role
 */
export async function getHospitalRole(hospitalId, roleId) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}`, { method: "GET" });
}

/**
 * Update hospital role
 */
export async function updateHospitalRole(hospitalId, roleId, roleData) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}`, {
    method: "PUT",
    body: JSON.stringify(roleData)
  });
}

/**
 * Delete hospital role
 */
export async function deleteHospitalRole(hospitalId, roleId) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}`, { method: "DELETE" });
}

/**
 * Get role permissions
 */
export async function getRolePermissions(hospitalId, roleId) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}/permissions`, { method: "GET" });
}

/**
 * Set role permissions
 */
export async function setRolePermissions(hospitalId, roleId, permissionNames) {
  return request(`/hospital-admin/hospitals/${hospitalId}/roles/${roleId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permission_names: permissionNames })
  });
}

/**
 * Add permission to role
 */
export async function addRolePermission(hospitalId, roleId, permissionKey) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}/permissions/${permissionKey}`, {
    method: "POST"
  });
}

/**
 * Remove permission from role
 */
export async function removeRolePermission(hospitalId, roleId, permissionKey) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}/permissions/${permissionKey}`, {
    method: "DELETE"
  });
}

/**
 * Get user roles
 */
export async function getUserRoles(hospitalId, userId) {
  return request(`/hospitals/${hospitalId}/users/${userId}/roles`, { method: "GET" });
}

/**
 * Assign role to user
 */
export async function assignUserRole(hospitalId, userId, roleId) {
  return request(`/hospitals/${hospitalId}/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role_id: roleId })
  });
}

/**
 * Update user role
 */
export async function updateUserRole(hospitalId, userId, roleId, isActive) {
  return request(`/hospitals/${hospitalId}/users/${userId}/roles/${roleId}`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive })
  });
}

/**
 * Delete user role
 */
export async function deleteUserRole(hospitalId, userId, roleId) {
  return request(`/hospitals/${hospitalId}/users/${userId}/roles/${roleId}`, {
    method: "DELETE"
  });
}

/**
 * Get users with specific role
 */
export async function getUsersWithRole(hospitalId, roleId) {
  return request(`/hospitals/${hospitalId}/roles/${roleId}/users`, { method: "GET" });
}

// =============================================
// DASHBOARD & ANALYTICS APIs
// =============================================

/**
 * Get all hospitals
 */
export async function getAllHospitals() {
  const response = await request("/search/hospitals", { method: "GET" });
  
  // Handle different response formats
  if (response && typeof response === 'object') {
    // If response has 'value' property (actual API format)
    if (response.value && Array.isArray(response.value)) {
      return response.value;
    }
    // If response has 'hospitals' property (expected format)
    if (response.hospitals && Array.isArray(response.hospitals)) {
      return response.hospitals;
    }
    // If response is already an array
    if (Array.isArray(response)) {
      return response;
    }
  }
  
  // Fallback: return empty array if format is unexpected
  console.warn('Unexpected API response format:', response);
  return [];
}

/**
 * Create user with any role (default or custom) - Unified function
 */
export async function createHospitalUser(hospitalId, payload) {
  return request(`/hospital-admin/hospitals/${hospitalId}/users`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * List hospital nurses (placeholder - implement based on your API)
 */
export async function listHospitalNurses(hospitalId) {
  return request(withQuery("/hospitals/nurses", { hospital_id: hospitalId }), { method: "GET" });
}

/**
 * List hospital patients (placeholder - implement based on your API)
 */
export async function listHospitalPatients(hospitalId) {
  return request(withQuery("/hospitals/patients", { hospital_id: hospitalId }), { method: "GET" });
}

// =============================================
// MISSING METHODS FOR HOSPITAL CARDS
// =============================================

/**
 * List all hospitals (alias for getAllHospitals)
 */
export async function listHospitals() {
  return getAllHospitals();
}

/**
 * Transform hospital data for frontend display
 */
export function transformHospitalData(hospital) {
  // Generate a consistent color based on hospital ID
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = (hospital.hospital_id || hospital.id) % colors.length;
  
  // Build location string from available fields
  const locationParts = [];
  if (hospital.city) locationParts.push(hospital.city);
  if (hospital.state) locationParts.push(hospital.state);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Location not specified';
  
  // Get primary specialty (first one or "Multi-specialty" if multiple)
  const specialty = hospital.specialties && hospital.specialties.length > 0 
    ? (hospital.specialties.length === 1 ? hospital.specialties[0] : 'Multi-specialty')
    : 'General Hospital';
  
  // Determine status
  const status = hospital.is_active === true || hospital.is_active === 1 ? 'Active' : 'Inactive';
  
  return {
    id: hospital.hospital_id || hospital.id,
    name: hospital.hospital_name || hospital.name,
    email: hospital.email || hospital.hospital_email || 'No email provided',
    phone: hospital.phone || hospital.admin_contact || 'No phone provided',
    location: location,
    specialty: specialty,
    status: status,
    color: colors[colorIndex],
    
    // Stats - use actual data when available, fallback to defaults
    doctors: hospital.doctor_count || 0,
    consultations: hospital.consultation_count || 0, // This might need to be fetched separately
    
    // Additional fields for completeness
    address: hospital.address,
    city: hospital.city,
    state: hospital.state,
    pincode: hospital.pincode,
    website: hospital.website,
    description: hospital.description,
    is_active: hospital.is_active,
    created_at: hospital.created_at,
    updated_at: hospital.updated_at,
    
    // Keep specialties array for detailed view
    specialties: hospital.specialties || []
  };
}

/**
 * Transform frontend data to backend format
 */
export function transformToBackendFormat(hospital) {
  return {
    hospital_name: hospital.name,
    address: hospital.address,
    city: hospital.city,
    state: hospital.state,
    pincode: hospital.pincode,
    phone: hospital.phone,
    email: hospital.email,
    website: hospital.website,
    description: hospital.description,
    is_active: hospital.is_active
  };
}

/**
 * Delete a hospital
 */
export async function deleteHospital(hospitalId) {
  return request(`/hospitals/${hospitalId}`, { method: "DELETE" });
}

/**
 * Create user for hospital
 */
export async function createUserForHospital(hospitalId, payload) {
  return request(`/hospitals/${hospitalId}/users`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * List hospital lab technicians
 */
export async function listHospitalLabTechnicians(hospitalId) {
  return request(withQuery("/hospitals/lab-technicians", { hospital_id: hospitalId }), { method: "GET" });
}