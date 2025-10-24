/**
 * Transcript Service - Frontend API calls for transcript management
 * Handles fetching transcripts with role-based access
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get transcripts for the current patient
 */
export async function getPatientTranscripts(limit = 50) {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/transcripts/patient?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch transcripts');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching patient transcripts:', error);
    throw error;
  }
}

/**
 * Get transcripts for the current doctor
 * @param {number} patientId - Optional: filter by specific patient
 */
export async function getDoctorTranscripts(patientId = null, limit = 50) {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    let url = `${API_BASE_URL}/api/v1/transcripts/doctor?limit=${limit}`;
    if (patientId) {
      url += `&patient_id=${patientId}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch transcripts');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching doctor transcripts:', error);
    throw error;
  }
}

/**
 * Get transcripts for the current hospital admin
 * @param {number} doctorId - Optional: filter by specific doctor
 */
export async function getHospitalAdminTranscripts(doctorId = null, limit = 100) {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    let url = `${API_BASE_URL}/api/v1/transcripts/hospital-admin?limit=${limit}`;
    if (doctorId) {
      url += `&doctor_id=${doctorId}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch transcripts');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching hospital admin transcripts:', error);
    throw error;
  }
}

/**
 * Get a specific consultation transcript by ID
 */
export async function getConsultationTranscript(consultationId) {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/transcripts/consultation/${consultationId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch transcript');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching consultation transcript:', error);
    throw error;
  }
}

/**
 * Get transcript summary/statistics
 */
export async function getTranscriptSummary() {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/transcripts/summary`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch summary');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching transcript summary:', error);
    throw error;
  }
}

/**
 * Export transcript as text (for future use)
 */
export function exportTranscriptAsText(transcript) {
  const { consultation_id, consultation_date, patient, doctor, messages } = transcript;
  
  let text = `CONSULTATION TRANSCRIPT\n`;
  text += `======================\n\n`;
  text += `Consultation ID: ${consultation_id}\n`;
  text += `Date: ${new Date(consultation_date).toLocaleString()}\n`;
  text += `Patient: ${patient.patient_name}\n`;
  text += `Doctor: ${doctor.doctor_name}\n`;
  text += `\n${'='.repeat(50)}\n\n`;
  
  messages.forEach((msg, index) => {
    const sender = msg.sender_type === 'patient' ? 'Patient' : 'Doctor';
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    text += `[${time}] ${sender}:\n${msg.message_text}\n\n`;
  });
  
  return text;
}

/**
 * Download transcript as a file
 */
export function downloadTranscript(transcript, format = 'txt') {
  const text = exportTranscriptAsText(transcript);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `transcript_${transcript.consultation_id}_${Date.now()}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

