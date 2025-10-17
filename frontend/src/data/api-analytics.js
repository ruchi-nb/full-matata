import { request } from './api.js';

// =============================================
// ANALYTICS APIs
// =============================================

/**
 * Get hospital analytics
 */
export function getHospitalAnalytics(hospitalId, period = "monthly") {
  return request(`/analytics/hospitals/${hospitalId}?period=${period}`, { 
    method: "GET" 
  });
}

/**
 * Get doctor performance analytics
 */
export function getDoctorPerformanceAnalytics(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  return request(`/analytics/doctors/performance?${params.toString()}`, { 
    method: "GET" 
  });
}

/**
 * Get consultation trends
 */
export function getConsultationTrends(timeRange = "30d") {
  return request(`/analytics/consultations/trends?time_range=${timeRange}`, {
    method: "GET"
  });
}