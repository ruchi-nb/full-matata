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

  // Check if token is expired
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      // Decode JWT token to check expiration
      const payload = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload));
      
      // Check if exp field exists and if it's expired
      if (decodedPayload.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return decodedPayload.exp < currentTime;
      }
      
      return false; // If no exp field, assume not expired
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // If can't decode, assume expired
    }
  }

  // Create consultation automatically in background
  async createConsultation(doctor, patientId = null, hospitalId = null) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Check if token is expired before making API call
      if (this.isTokenExpired(token)) {
        throw new Error('Authentication failed - Your session has expired');
      }

      // Get current user info from JWT token
      const userData = await this.getCurrentUserInfo();
      if (!userData || !userData.user_id) {
        throw new Error('Unable to identify patient');
      }

      // Extract doctor information
      const doctorUserId = doctor.user_id; // Doctor's user_id from database
      const specialtyId = doctor.specialties && doctor.specialties.length > 0 
        ? doctor.specialties[0].specialty_id 
        : 1; // Use first specialty or default
      
      // Hospital ID should come from patient's associated hospital
      const finalHospitalId = hospitalId || userData.hospital_id || null;

      const consultationData = {
        patient_id: userData.user_id, // Patient's user_id from JWT
        doctor_id: doctorUserId, // Doctor's user_id
        specialty_id: specialtyId,
        hospital_id: finalHospitalId,
        consultation_type: 'online' // Default to online consultation
      };

      console.log('💊 Creating consultation with data:', consultationData);

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
        if (response.status === 401) {
          throw new Error('Authentication failed - Your session has expired');
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create consultation');
      }

      const result = await response.json();

      console.log('✅ Consultation created successfully:', result);

      // Log successful creation
      await this.logAnalyticsEvent('consultation_created', {
        consultation_id: result.consultation_id,
        doctor_id: doctorUserId,
        patient_id: userData.user_id
      });

      return result;
    } catch (error) {
      console.error('❌ Consultation creation error:', error);
      throw error;
    }
  }

  // Get current user information from JWT token
  async getCurrentUserInfo() {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Decode JWT token to get user info
      // JWT structure: header.payload.signature
      const payload = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload));
      
      console.log('👤 Decoded user info from JWT:', decodedPayload);

      // Return user info from JWT payload
      return {
        user_id: decodedPayload.user?.user_id || decodedPayload.user_id,
        username: decodedPayload.user?.username || decodedPayload.username,
        email: decodedPayload.user?.email || decodedPayload.email,
        hospital_id: decodedPayload.hospital_id || decodedPayload.user?.hospital_id,
        role: decodedPayload.user?.global_role?.role_name || decodedPayload.role
      };
    } catch (error) {
      console.error('Failed to get current user info:', error);
      throw new Error('Failed to authenticate user');
    }
  }

  // Get current patient ID from JWT token
  async getCurrentPatientId() {
    try {
      const userInfo = await this.getCurrentUserInfo();
      return userInfo.user_id;
    } catch (error) {
      console.error('Failed to get patient ID:', error);
      throw error;
    }
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
