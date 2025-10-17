// Consultation Service - Handles backend API integration for consultations
class ConsultationService {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  // Get authentication token
  getAuthToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  // Create consultation automatically in background
  async createConsultation(doctorId, patientId = null, specialtyId = null, hospitalId = null) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // If patientId is not provided, try to get it from user context or use default
      const finalPatientId = patientId || await this.getCurrentPatientId();
      
      // If specialtyId is not provided, try to infer from doctor
      const finalSpecialtyId = specialtyId || await this.getDoctorSpecialty(doctorId);

      const consultationData = {
        patient_id: finalPatientId,
        doctor_id: doctorId,
        specialty_id: finalSpecialtyId,
        hospital_id: hospitalId,
        consultation_type: 'online', // Default to online consultation
        audio_provider: 'deepgram', // Default to deepgram
        language: 'multi' // Default to multi-language
      };

      // Log analytics event
      await this.logAnalyticsEvent('consultation_form_submit', consultationData);

      const response = await fetch(`${this.baseURL}/api/v1/consultation/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(consultationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create consultation');
      }

      const result = await response.json();

      // Log successful creation
      await this.logAnalyticsEvent('consultation_created', {
        consultation_id: result.consultation_id,
        doctor_id: doctorId,
        patient_id: finalPatientId
      });

      return result;
    } catch (error) {
      console.error('Consultation creation error:', error);
      throw error;
    }
  }

  // Get current patient ID from user context or token
  async getCurrentPatientId() {
    try {
      const token = this.getAuthToken();
      if (!token) return 12; // Default patient ID

      // Try to get patient info from /auth/me endpoint
      const response = await fetch(`${this.baseURL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        return userData.id || 12; // Use user ID as patient ID
      }

      return 12; // Default fallback
    } catch (error) {
      console.warn('Could not get current patient ID:', error);
      return 12; // Default fallback
    }
  }

  // Get doctor specialty (this would typically come from doctor data)
  async getDoctorSpecialty(doctorId) {
    // This is a simplified version - in a real app, you'd fetch from doctor API
    // For now, return a default specialty ID
    return 1; // Default specialty ID
  }

  // Log analytics events
  async logAnalyticsEvent(event, data) {
    try {
      const token = this.getAuthToken();
      if (!token) return;

      await fetch(`${this.baseURL}/api/v1/analytics/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.warn('Failed to log analytics event:', error);
    }
  }

  // Get consultation details
  async getConsultation(consultationId) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.baseURL}/api/v1/consultation/${consultationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consultation');
      }

      return await response.json();
    } catch (error) {
      console.error('Get consultation error:', error);
      throw error;
    }
  }

  // Get patient's consultation history
  async getPatientConsultations(patientId = null) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const finalPatientId = patientId || await this.getCurrentPatientId();

      const response = await fetch(`${this.baseURL}/api/v1/consultation/patient/${finalPatientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consultations');
      }

      return await response.json();
    } catch (error) {
      console.error('Get patient consultations error:', error);
      throw error;
    }
  }

  // End consultation
  async endConsultation(consultationId) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.baseURL}/api/v1/consultation/${consultationId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to end consultation');
      }

      return await response.json();
    } catch (error) {
      console.error('End consultation error:', error);
      throw error;
    }
  }

  // Get consultation transcript
  async getConsultationTranscript(consultationId) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${this.baseURL}/api/v1/consultation/${consultationId}/transcript`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transcript');
      }

      return await response.json();
    } catch (error) {
      console.error('Get transcript error:', error);
      throw error;
    }
  }

  // Health check for backend connection
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const consultationService = new ConsultationService();

export default consultationService;
