// API service functions for dynamic dashboard
import { apiRequest } from './api-base';

// User permissions API
export const getUserPermissions = async () => {
  try {
    const response = await apiRequest('/api/auth/permissions', {
      method: 'GET',
    });
    return response.permissions || [];
  } catch (error) {
    console.error('Failed to fetch user permissions:', error);
    throw error;
  }
};

// Patient management API
export const getPatients = async () => {
  try {
    const response = await apiRequest('/api/hospital/patients', {
      method: 'GET',
    });
    return response.patients || [];
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    throw error;
  }
};

export const createPatient = async (patientData) => {
  try {
    const response = await apiRequest('/api/hospital/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
    return response.patient;
  } catch (error) {
    console.error('Failed to create patient:', error);
    throw error;
  }
};

export const updatePatient = async (patientId, patientData) => {
  try {
    const response = await apiRequest(`/api/hospital/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(patientData),
    });
    return response.patient;
  } catch (error) {
    console.error('Failed to update patient:', error);
    throw error;
  }
};

export const deletePatient = async (patientId) => {
  try {
    const response = await apiRequest(`/api/hospital/patients/${patientId}`, {
      method: 'DELETE',
    });
    return response;
  } catch (error) {
    console.error('Failed to delete patient:', error);
    throw error;
  }
};

// Doctor management API
export const getDoctors = async () => {
  try {
    const response = await apiRequest('/api/hospital/doctors', {
      method: 'GET',
    });
    return response.doctors || [];
  } catch (error) {
    console.error('Failed to fetch doctors:', error);
    throw error;
  }
};

export const createDoctor = async (doctorData) => {
  try {
    const response = await apiRequest('/api/hospital/doctors', {
      method: 'POST',
      body: JSON.stringify(doctorData),
    });
    return response.doctor;
  } catch (error) {
    console.error('Failed to create doctor:', error);
    throw error;
  }
};

export const updateDoctor = async (doctorId, doctorData) => {
  try {
    const response = await apiRequest(`/api/hospital/doctors/${doctorId}`, {
      method: 'PUT',
      body: JSON.stringify(doctorData),
    });
    return response.doctor;
  } catch (error) {
    console.error('Failed to update doctor:', error);
    throw error;
  }
};

export const deleteDoctor = async (doctorId) => {
  try {
    const response = await apiRequest(`/api/hospital/doctors/${doctorId}`, {
      method: 'DELETE',
    });
    return response;
  } catch (error) {
    console.error('Failed to delete doctor:', error);
    throw error;
  }
};

// Reports and analytics API
export const getReports = async () => {
  try {
    const response = await apiRequest('/api/hospital/reports', {
      method: 'GET',
    });
    return response.reports || [];
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    throw error;
  }
};

export const getAnalytics = async (period = '30d') => {
  try {
    const response = await apiRequest(`/api/hospital/analytics?period=${period}`, {
      method: 'GET',
    });
    return response.analytics || {};
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    throw error;
  }
};

// Base API request function
const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('access_token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
};
