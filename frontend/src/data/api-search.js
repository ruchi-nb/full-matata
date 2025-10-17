import { request } from './api.js';

// =============================================
// SEARCH APIs
// =============================================

/**
 * Search hospitals
 */
export function searchHospitals(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  return request(`/search/hospitals?${params.toString()}`, { method: "GET" });
}

/**
 * Search doctors
 */
export function searchDoctors(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  return request(`/search/doctors?${params.toString()}`, { method: "GET" });
}

/**
 * Search specialties
 */
export function searchSpecialties(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  return request(`/search/specialties?${params.toString()}`, { method: "GET" });
}