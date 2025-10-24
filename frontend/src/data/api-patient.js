import { request } from './api.js';
import { normalizePhoneNumber } from '../utils/validation.js';

// =============================================
// PATIENT APIs
// =============================================

/**
 * Get patient profile
 */
export async function getPatientProfile() {
  try {
    const profile = await request("/patients/profile", { method: "GET" });
    
    // Normalize phone number in the response to handle backend validation issues
    if (profile && profile.phone) {
      profile.phone = normalizePhoneNumber(profile.phone);
    }
    
    return profile;
  } catch (error) {
    // If the error is due to phone validation, try to handle it gracefully
    if (error.message && error.message.includes('Invalid Indian phone number')) {
      console.warn("Phone validation error in response, attempting to fetch profile without phone validation");
      
      // Try to get the profile data from the error response if available
      if (error.data && error.data.detail) {
        // Extract the phone number from the error message and normalize it
        const phoneMatch = error.data.detail.match(/input': '([^']+)'/);
        if (phoneMatch) {
          const originalPhone = phoneMatch[1];
          const normalizedPhone = normalizePhoneNumber(originalPhone);
          
          // Return a profile with the normalized phone number
          return {
            user_id: error.data.user_id || null,
            first_name: error.data.first_name || null,
            last_name: error.data.last_name || null,
            phone: normalizedPhone,
            address: error.data.address || null,
            dob: error.data.dob || null,
            gender: error.data.gender || null,
            _phoneNormalized: true
          };
        }
      }
    }
    
    // Re-throw the original error if we can't handle it
    throw error;
  }
}

/**
 * Update patient profile
 */
export function updatePatientProfile(update) {
  console.log("🩺 [PATIENT API] Updating patient profile with data:", update);
  console.log("🩺 [PATIENT API] Phone number being sent:", update.phone);
  
  // Normalize phone number to remove spaces and ensure proper format
  const normalizedPhone = normalizePhoneNumber(update.phone);
  console.log("🩺 [PATIENT API] Normalized phone number:", normalizedPhone);
  
  // Ensure all fields are properly formatted
  const formattedUpdate = {
    first_name: update.first_name || update.firstName || "",
    last_name: update.last_name || update.lastName || "",
    phone: normalizedPhone,
    address: update.address || "",
    dob: update.dob || "",
    gender: update.gender || ""
  };
  
  console.log("🩺 [PATIENT API] Formatted update data:", formattedUpdate);
  
  return request("/patients/profile", { 
    method: "PUT", 
    body: JSON.stringify(formattedUpdate) 
  });
}

/**
 * Register a new patient
 */
export async function registerPatient(payload) {
  console.log("🩺 [PATIENT API] Registering patient with payload:", payload);
  console.log("🩺 [PATIENT API] Patient phone in registration:", payload.phone);
  
  // Normalize phone number before sending to backend
  const normalizedPayload = {
    ...payload,
    phone: normalizePhoneNumber(payload.phone)
  };
  
  console.log("🩺 [PATIENT API] Normalized payload:", normalizedPayload);
  
  try {
    const result = await request("/auth/register/patient", { 
      method: "POST", 
      body: JSON.stringify(normalizedPayload) 
    }, { withAuth: false });
    
    console.log("✅ [PATIENT API] Patient registration successful:", result);
    return result;
  } catch (error) {
    console.error("❌ [PATIENT API] Patient registration failed:", error);
    
    // Enhanced error handling for registration failures
    if (error.status === 400) {
      throw new Error(`Registration failed: ${error.message}`);
    } else if (error.status === 500) {
      throw new Error("Registration failed due to server error. Please try again or contact support.");
    } else if (error.status === 404) {
      throw new Error("Registration endpoint not found. Please contact support.");
    } else {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }
}

/**
 * Get patient consultations
 */
export function getPatientConsultations() { 
  return request("/patients/consultations", { method: "GET" });
}

/**
 * Get hospital specialties available to the patient
 * Patient can only see specialties from their hospital
 */
export function getPatientHospitalSpecialties() {
  console.log("🩺 [PATIENT API] Fetching hospital specialties for patient");
  return request("/patients/specialties", { method: "GET" });
}

/**
 * Get doctors available in the patient's hospital
 * Optionally filter by specialty_id
 * @param {number|null} specialtyId - Optional specialty ID to filter doctors
 */
export function getPatientHospitalDoctors(specialtyId = null) {
  const url = specialtyId 
    ? `/patients/doctors?specialty_id=${specialtyId}` 
    : "/patients/doctors";
  console.log("🩺 [PATIENT API] Fetching hospital doctors:", url);
  return request(url, { method: "GET" });
}

/**
 * Create missing UserDetails record for new patients
 */
export async function createMissingUserDetails(userData) {
  console.log("🩺 [PATIENT API] Creating missing UserDetails record for user:", userData);
  
  // Try to get stored registration data
  let storedData = {};
  try {
    const stored = localStorage.getItem('pending_user_details');
    if (stored) {
      storedData = JSON.parse(stored);
      console.log("🩺 [PATIENT API] Found stored registration data:", storedData);
      // Clear the stored data after using it
      localStorage.removeItem('pending_user_details');
    }
  } catch (e) {
    console.log("🩺 [PATIENT API] No stored registration data found");
  }
  
  try {
    console.log("🩺 [PATIENT API] Sending UserDetails creation request...");
    const result = await request("/patients/patients/profile", { 
      method: "PUT", 
      body: JSON.stringify({
        first_name: storedData.first_name || userData.first_name || userData.username || "User",
        last_name: storedData.last_name || userData.last_name || "",
        phone: storedData.phone || userData.phone || null,
        address: userData.address || null,
        dob: userData.dob || null,
        gender: userData.gender || null
      })
    });
    
    console.log("✅ [PATIENT API] UserDetails record created successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ [PATIENT API] Failed to create UserDetails record:", error);
    throw error;
  }
}

/**
 * Upload patient avatar
 */
export async function uploadPatientAvatar(file) {
  console.log("🩺 [PATIENT API] Uploading patient avatar file:", file.name, file.type, file.size);
  const url = `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}/patients/patients/profile/avatar`;
  const form = new FormData();
  form.append("file", file);
  const headers = {};
  const { getStoredTokens } = await import('./api.js');
  const { accessToken } = getStoredTokens();
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  
  try {
    console.log("🩺 [PATIENT API] Sending avatar upload request...");
    const res = await fetch(url, { method: "POST", body: form, headers, credentials: "include" });
    console.log("🩺 [PATIENT API] Avatar upload response status:", res.status);
    
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json().catch(() => ({})) : await res.text();
    
    if (!res.ok) {
      const message = (data && (data.detail || data.message)) || res.statusText;
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    console.error("❌ [PATIENT API] Avatar upload failed:", error);
    throw error;
  }
}