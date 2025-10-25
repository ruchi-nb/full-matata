// Patient Service - Handles patient-related API calls
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Get list of doctors that the patient has consulted with
 * Only returns doctors with whom the patient has had at least one consultation
 */
export async function getMyDoctors() {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/patients/my-doctors`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear and redirect
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch doctors');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching my doctors:', error);
    throw error;
  }
}

/**
 * Get all doctors available in the patient's hospital
 * @param {number} specialtyId - Optional: filter by specialty
 */
export async function getHospitalDoctors(specialtyId = null) {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const url = specialtyId 
      ? `${API_BASE_URL}/patients/doctors?specialty_id=${specialtyId}`
      : `${API_BASE_URL}/patients/doctors`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch hospital doctors');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching hospital doctors:', error);
    throw error;
  }
}

/**
 * Get patient's profile
 */
export async function getPatientProfile() {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/patients/profile`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    throw error;
  }
}

/**
 * Get patient's consultations
 */
export async function getPatientConsultations() {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/patients/consultations`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('isLoggedIn');
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch consultations');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching patient consultations:', error);
    throw error;
  }
}

