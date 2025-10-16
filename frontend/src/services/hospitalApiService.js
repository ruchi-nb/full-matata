// File: services/hospitalApiService.js
import { getStoredTokens } from '../data/api.js';

class HospitalApiService {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async requestWithRetry(endpoint, options = {}, retries = this.maxRetries) {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || 30000;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      let timeoutId;
      const controller = new AbortController();
      
      try {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        const config = {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        };

        // Add authentication header if available
        const { accessToken } = getStoredTokens();
        if (accessToken) {
          config.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, config);
        
        clearTimeout(timeoutId);
        
        if (response.status === 429) {
          const delay = Math.min(attempt * this.retryDelay, 10000);
          await this.delay(delay);
          continue;
        }
        
        if (!response.ok) {
          // Handle 401 Unauthorized - try to refresh token
          if (response.status === 401) {
            console.log("🔄 Token expired, attempting refresh...");
            const { refreshTokens } = await import('../data/api.js');
            const refreshSuccess = await refreshTokens();
            
            if (refreshSuccess) {
              // Retry the request with new token
              const { accessToken: newToken } = getStoredTokens();
              if (newToken) {
                config.headers['Authorization'] = `Bearer ${newToken}`;
                const retryResponse = await fetch(url, config);
                clearTimeout(timeoutId);
                
                if (!retryResponse.ok) {
                  let errorData;
                  try {
                    errorData = await retryResponse.json();
                  } catch {
                    errorData = { detail: `HTTP error! status: ${retryResponse.status}` };
                  }
                  throw new Error(errorData.detail || `HTTP error! status: ${retryResponse.status}`);
                }
                
                const contentType = retryResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  return await retryResponse.json();
                } else {
                  return await retryResponse.text();
                }
              }
            }
          }
          
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { detail: `HTTP error! status: ${response.status}` };
          }
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
        
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (attempt === retries) {
          console.error(`Hospital API request failed after ${retries} attempts:`, error);
          throw error;
        }
        
        await this.delay(attempt * this.retryDelay);
      }
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // List all hospitals with additional data
  async listHospitals() {
    const hospitals = await this.requestWithRetry('/hospitals/', {
      method: 'GET',
      timeout: 10000
    });
    
    // Enhance each hospital with doctor count
    const enhancedHospitals = await Promise.all(
      hospitals.map(async (hospital) => {
        try {
          const doctors = await this.listHospitalDoctors(hospital.hospital_id);
          return {
            ...hospital,
            doctor_count: doctors.length
          };
        } catch (error) {
          console.warn(`Failed to fetch doctors for hospital ${hospital.hospital_id}:`, error);
          return {
            ...hospital,
            doctor_count: 0
          };
        }
      })
    );
    
    return enhancedHospitals;
  }

  // Create hospital
  async createHospital(hospitalData) {
    return this.requestWithRetry('/hospitals/', {
      method: 'POST',
      body: JSON.stringify(hospitalData),
      timeout: 15000
    });
  }

  // Delete hospital
  async deleteHospital(hospitalId) {
    return this.requestWithRetry(`/hospitals/${hospitalId}`, {
      method: 'DELETE',
      timeout: 10000
    });
  }

  // Get hospital profile
  async getHospitalProfile(hospitalId) {
    return this.requestWithRetry(`/hospitals/profile?hospital_id=${hospitalId}`, {
      method: 'GET',
      timeout: 10000
    });
  }

  // Update hospital profile
  async updateHospitalProfile(hospitalId, updateData) {
    return this.requestWithRetry(`/hospitals/profile?hospital_id=${hospitalId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
      timeout: 15000
    });
  }

  // List all specialties
  async listSpecialties() {
    return this.requestWithRetry('/hospitals/specialities', {
      method: 'GET',
      timeout: 10000
    });
  }

  // Create specialty
  async createSpecialty(specialtyData) {
    return this.requestWithRetry('/hospitals/specialities', {
      method: 'POST',
      body: JSON.stringify(specialtyData),
      timeout: 15000
    });
  }

  // Update specialty
  async updateSpecialty(specialtyId, updateData) {
    return this.requestWithRetry(`/hospitals/specialities/${specialtyId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
      timeout: 15000
    });
  }

  // Delete specialty
  async deleteSpecialty(specialtyId) {
    return this.requestWithRetry(`/hospitals/specialities/${specialtyId}`, {
      method: 'DELETE',
      timeout: 10000
    });
  }

  // Add doctor to hospital
  async addDoctorToHospital(hospitalId, doctorData, specialtyIds = null) {
    const endpoint = `/hospitals/doctors?hospital_id=${hospitalId}`;
    const params = new URLSearchParams();
    if (specialtyIds) {
      specialtyIds.forEach(id => params.append('specialty_ids', id));
    }
    
    const url = specialtyIds ? `${endpoint}&${params.toString()}` : endpoint;
    
    return this.requestWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(doctorData),
      timeout: 15000
    });
  }

  // Update doctor in hospital
  async updateDoctorInHospital(hospitalId, doctorId, updateData, specialtyIds = null) {
    const endpoint = `/hospitals/doctors/${doctorId}?hospital_id=${hospitalId}`;
    const params = new URLSearchParams();
    if (specialtyIds) {
      specialtyIds.forEach(id => params.append('specialty_ids', id));
    }
    
    const url = specialtyIds ? `${endpoint}&${params.toString()}` : endpoint;
    
    return this.requestWithRetry(url, {
      method: 'PUT',
      body: JSON.stringify(updateData),
      timeout: 15000
    });
  }

  // Remove doctor from hospital
  async removeDoctorFromHospital(hospitalId, doctorId) {
    return this.requestWithRetry(`/hospitals/doctors/${doctorId}?hospital_id=${hospitalId}`, {
      method: 'DELETE',
      timeout: 10000
    });
  }

  // List hospital doctors
  async listHospitalDoctors(hospitalId) {
    return this.requestWithRetry(`/hospitals/doctors?hospital_id=${hospitalId}`, {
      method: 'GET',
      timeout: 10000
    });
  }

  // Helper method to transform backend data to frontend format
  transformHospitalData(backendData) {
    return {
      id: backendData.hospital_id,
      name: backendData.hospital_name,
      email: backendData.hospital_email,
      location: backendData.address || 'Not specified',
      phone: backendData.admin_contact || 'Not specified',
      status: 'Active', // Default status since backend doesn't have status field
      color: 'bg-blue-500', // Default color
      specialty: 'Multi-specialty', // Default specialty
      doctors: backendData.doctor_count || 0, // Use real doctor count from API
      consultations: 0, // TODO: Implement consultation count when available
      created_at: backendData.created_at,
      updated_at: backendData.updated_at
    };
  }

  // Helper method to transform frontend data to backend format
  transformToBackendFormat(frontendData) {
    return {
      hospital_name: frontendData.name,
      hospital_email: frontendData.email,
      admin_contact: frontendData.phone,
      address: frontendData.location
    };
  }
}

export const hospitalApiService = new HospitalApiService();
