import { request } from './api.js';

// =============================================
// DOCTOR APIs
// =============================================

/**
 * Get doctor profile
 */
export function getDoctorProfile() {
  return request("/doctors/profile", { method: "GET" });
}

/**
 * Update doctor profile
 */
export function updateDoctorProfile(update) {
  // Check if update is FormData (for file uploads)
  if (update instanceof FormData) {
    return request("/doctors/profile", { 
      method: "PUT", 
      body: update,
      headers: {} // Don't set Content-Type for FormData, let browser set it with boundary
    });
  }
  
  // Regular JSON update
  return request("/doctors/profile", { method: "PUT", body: JSON.stringify(update || {}) });
}

/**
 * Get doctor specialties
 */
export function getDoctorSpecialties() {
  return request("/doctors/specialties", { method: "GET" });
}

/**
 * Set doctor specialties
 */
export function setDoctorSpecialties(specialtyIds = []) {
  return request("/doctors/specialties", { method: "PUT", body: JSON.stringify(specialtyIds || []) });
}

/**
 * List doctor's patients
 */
export function listDoctorPatients() {
  return request("/doctors/patients", { method: "GET" });
}

/**
 * Get specific patient details for doctor
 */
export function getDoctorPatient(patientId) {
  return request(`/doctors/patients/${patientId}`, { method: "GET" });
}

/**
 * Get patient consultations for doctor
 */
export function getDoctorPatientConsultations(patientId) {
  return request(`/doctors/patients/${patientId}/consultations`, { method: "GET" });
}

/**
 * Get doctor patient analytics
 */
export function getDoctorPatientsAnalytics() {
  return request("/doctors/analytics/patients", { method: "GET" });
}

/**
 * Get monthly consultations for doctor
 */
export function getDoctorMonthlyConsultations() {
  return request("/doctors/consultations/monthly", { method: "GET" });
}

/**
 * Get doctor dashboard statistics (comprehensive)
 * Returns stats, patients list with consultation counts
 */
export function getDoctorDashboardStats() {
  return request("/doctors/dashboard-stats", { method: "GET" });
}