import { request } from './api.js';

// =============================================
// SUPER ADMIN APIs
// =============================================

/**
 * Get superadmin profile
 */
export function getSuperAdminProfile() {
  return request("/superadmin/profile", { method: "GET" });
}

/**
 * Onboard hospital with admin
 */
export function onboardHospitalAdmin(payload) {
  return request("/superadmin/onboard/hospital_admin", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * Create user for hospital (doctor/patient) - Direct API call
 * This function directly calls the superadmin endpoint for creating users
 * @param {number} hospitalId - The hospital ID to create the user for
 * @param {Object} payload - User creation payload
 * @returns {Promise} API response
 */
export function createUserForHospital(hospitalId, payload) {
  if (!hospitalId) {
    throw new Error("hospitalId is required");
  }
  
  return request(`/superadmin/hospitals/${hospitalId}/users`, {
    method: "POST", 
    body: JSON.stringify(payload)
  });
}

/**
 * Create doctor/patient and link to hospital with tenant logic bypass
 * This function creates the user and automatically links them to the hospital
 * bypassing normal tenant restrictions (superadmin only)
 * 
 * @param {Object} payload - User creation payload containing:
 *   - hospital_id: number (required) - Target hospital ID
 *   - user_type: string (required) - 'doctor' or 'patient'
 *   - username: string (optional) - Username, defaults to email local part
 *   - email: string (required) - User email
 *   - password: string (required) - User password (min 8 chars)
 *   - first_name: string (optional) - User first name
 *   - last_name: string (optional) - User last name
 *   - phone: string (optional) - Phone number
 *   - hospital_name: string (optional) - For logging purposes only
 *   - specialty: string (optional) - Doctor specialty (not stored in backend)
 *   - languages: array (optional) - Doctor languages (not stored in backend)
 * 
 * @returns {Promise} API response with created user details
 */
export function createDoctorOrPatient(payload) {
  // Validate required fields
  if (!payload.hospital_id) {
    throw new Error("hospital_id is required in payload");
  }
  
  if (!payload.user_type) {
    throw new Error("user_type is required in payload");
  }
  
  if (!['doctor', 'patient'].includes(payload.user_type)) {
    throw new Error("user_type must be 'doctor' or 'patient'");
  }
  
  if (!payload.email) {
    throw new Error("email is required in payload");
  }
  
  if (!payload.password) {
    throw new Error("password is required in payload");
  }
  
  // Extract hospital_id for URL path
  const hospitalId = payload.hospital_id;
  
  // Remove fields that are not part of the SuperAdminCreateUserIn schema
  // The backend schema only accepts: user_type, username, email, password, first_name, last_name, phone
  const { 
    hospital_id, 
    hospital_name, 
    specialty, 
    languages, 
    ...userPayload 
  } = payload;
  
  console.log(`Creating ${userPayload.user_type} for hospital ${hospitalId}:`, {
    email: userPayload.email,
    username: userPayload.username,
    first_name: userPayload.first_name,
    last_name: userPayload.last_name
  });
  
  return request(`/superadmin/hospitals/${hospitalId}/users`, {
    method: "POST",
    body: JSON.stringify(userPayload)
  });
}

/**
 * Create multiple users for a hospital in batch
 * @param {number} hospitalId - The hospital ID
 * @param {Array} users - Array of user payloads
 * @returns {Promise} Array of API responses
 */
export async function createMultipleUsersForHospital(hospitalId, users) {
  if (!hospitalId) {
    throw new Error("hospitalId is required");
  }
  
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("users array is required and must not be empty");
  }
  
  const results = [];
  const errors = [];
  
  for (let i = 0; i < users.length; i++) {
    try {
      const result = await createUserForHospital(hospitalId, users[i]);
      results.push({ index: i, success: true, data: result });
    } catch (error) {
      errors.push({ index: i, success: false, error: error.message });
    }
  }
  
  return {
    results,
    errors,
    summary: {
      total: users.length,
      successful: results.length,
      failed: errors.length
    }
  };
}

/**
 * Validate user creation payload before sending to API
 * @param {Object} payload - User creation payload
 * @returns {Object} Validation result with isValid and errors
 */
export function validateUserPayload(payload) {
  const errors = [];
  
  // Required fields
  if (!payload.hospital_id) {
    errors.push("hospital_id is required");
  }
  
  if (!payload.user_type) {
    errors.push("user_type is required");
  } else if (!['doctor', 'patient'].includes(payload.user_type)) {
    errors.push("user_type must be 'doctor' or 'patient'");
  }
  
  if (!payload.email) {
    errors.push("email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push("email must be a valid email address");
  }
  
  if (!payload.password) {
    errors.push("password is required");
  } else if (payload.password.length < 8) {
    errors.push("password must be at least 8 characters long");
  }
  
  // Optional field validations
  if (payload.username && payload.username.length < 3) {
    errors.push("username must be at least 3 characters long");
  }
  
  if (payload.phone && !/^[\+]?[0-9\s\-\(\)]+$/.test(payload.phone)) {
    errors.push("phone must be a valid phone number");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if hospital has required tenant roles
 * @param {number} hospitalId - The hospital ID
 * @returns {Promise<boolean>} True if roles exist, false otherwise
 */
export async function checkHospitalTenantRoles(hospitalId) {
  if (!hospitalId) {
    throw new Error("hospitalId is required");
  }
  
  try {
    // Try to create a test user to see if roles exist
    // This is a lightweight check
    const testPayload = {
      user_type: 'doctor',
      email: `test-${Date.now()}@test.com`,
      password: 'TestPass123!',
      username: `test-${Date.now()}`
    };
    
    await request(`/superadmin/hospitals/${hospitalId}/users`, {
      method: "POST",
      body: JSON.stringify(testPayload)
    });
    
    return true; // If successful, roles exist
  } catch (error) {
    if (error.message.includes("Tenant role") && error.message.includes("not found")) {
      return false; // Roles don't exist
    }
    throw error; // Other errors should be thrown
  }
}

/**
 * Create doctor/patient with automatic tenant role creation
 * This function ensures tenant roles exist before creating the user
 * @param {Object} payload - User creation payload
 * @returns {Promise} API response with created user details
 */
export async function createDoctorOrPatientWithRoleCheck(payload) {
  // Validate required fields
  if (!payload.hospital_id) {
    throw new Error("hospital_id is required in payload");
  }
  
  if (!payload.user_type) {
    throw new Error("user_type is required in payload");
  }
  
  if (!['doctor', 'patient'].includes(payload.user_type)) {
    throw new Error("user_type must be 'doctor' or 'patient'");
  }
  
  if (!payload.email) {
    throw new Error("email is required in payload");
  }
  
  if (!payload.password) {
    throw new Error("password is required in payload");
  }
  
  const hospitalId = payload.hospital_id;
  
  try {
    // First, try to create the user directly
    return await createDoctorOrPatient(payload);
  } catch (error) {
    // If tenant role not found, try to ensure roles exist
    if (error.message.includes("Tenant role") && error.message.includes("not found")) {
      console.log(`⚠️ Tenant roles missing for hospital ${hospitalId}, attempting to create them...`);
      
      try {
        await ensureHospitalTenantRoles(hospitalId);
        console.log(`✅ Tenant roles created for hospital ${hospitalId}, retrying user creation...`);
        
        // Retry user creation
        return await createDoctorOrPatient(payload);
      } catch (roleError) {
        console.error(`❌ Failed to create tenant roles for hospital ${hospitalId}:`, roleError);
        throw new Error(`Failed to create tenant roles for hospital ${hospitalId}. Please ensure the hospital is properly onboarded.`);
      }
    }
    
    // Re-throw other errors
    throw error;
  }
}

