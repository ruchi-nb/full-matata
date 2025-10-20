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
 * Get hospital users
 */
export async function getHospitalUsers(hospitalId) {
  return request(`/hospitals/${hospitalId}/users`, { method: "GET" });
}

/**
 * Get hospital roles
 */
export async function getHospitalRoles(hospitalId) {
  return request(`/hospitals/${hospitalId}/roles`, { method: "GET" });
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
 * Get all hospitals with enhanced statistics
 */
export async function getAllHospitals() {
  return request("/search/hospitals", { method: "GET" });
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

/**
 * List hospital lab technicians
 */
export async function listHospitalLabTechnicians(hospitalId) {
  // Lab technicians are custom roles, so they're included in the doctors endpoint
  // Or we can create a specific endpoint for them
  return request(withQuery("/hospitals/nurses", { hospital_id: hospitalId }), { method: "GET" }).then(() => []).catch(() => []);
  // For now, return empty array as lab_technician role might not exist
}