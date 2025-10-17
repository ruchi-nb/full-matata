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

/**
 * Log analytics event (authenticated users)
 */
export function logAnalyticsEvent(event, data = {}) {
  return request('/analytics/event', {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href
    })
  });
}

/**
 * Log analytics event (public - no authentication required)
 */
export function logPublicAnalyticsEvent(event, data = {}) {
  return request('/analytics/event/public', {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href
    })
  });
}

/**
 * Get comprehensive analytics
 */
export function getComprehensiveAnalytics(hours = 24) {
  return request(`/analytics/comprehensive?hours=${hours}`, {
    method: "GET"
  });
}

/**
 * Get cost breakdown
 */
export function getCostBreakdown(hours = 24) {
  return request(`/analytics/cost-breakdown?hours=${hours}`, {
    method: "GET"
  });
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics(hours = 24) {
  return request(`/analytics/performance?hours=${hours}`, {
    method: "GET"
  });
}