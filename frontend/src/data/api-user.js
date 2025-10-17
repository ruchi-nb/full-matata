import { request, getStoredTokens } from './api.js';
import { getPatientProfile } from './api-patient.js';
import { getDoctorProfile } from './api-doctor.js';
import { getHospitalProfile } from './api-hospital-admin.js';
import { getSuperAdminProfile } from './api-superadmin.js';

// =============================================
// USER PROFILE & ROLE DETECTION APIs
// =============================================

/**
 * Enhanced profile function with multi-role detection
 */
export async function getProfile() {
  const tokens = getStoredTokens();
  if (!tokens.accessToken) {
    throw new Error("Not authenticated");
  }
  
  try {
    // Decode JWT to get user info
    const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
    console.log("JWT Payload:", payload);
    
    // Enhanced role detection - TRUST THE JWT!
    const userData = payload.user || payload;
    let roleName = userData.global_role?.role_name || 
                  userData.role_name || 
                  userData.role;
    
    console.log("Detected Role from JWT:", roleName);
    
    // If we have a clear role from JWT, use appropriate endpoint
    if (roleName) {
      console.log(`✅ Using JWT role: ${roleName}`);
      
      switch (roleName) {
        case 'superadmin':
          try {
            const profile = await getSuperAdminProfile();
            return { ...profile, _detectedRole: 'superadmin' };
          } catch (error) {
            console.log("Superadmin profile failed, using JWT data");
            return { ...userData, _detectedRole: 'superadmin' };
          }
          break;
          
        case 'patient':
          try {
            const profile = await getPatientProfile();
            return { ...profile, _detectedRole: 'patient' };
          } catch (error) {
            if (error.status === 404) {
              console.log("Patient profile not found, creating from JWT");
              return {
                user_id: userData.user_id,
                username: userData.username,
                email: userData.email,
                first_name: userData.first_name || userData.username || "User",
                last_name: userData.last_name || "",
                _detectedRole: 'patient',
                _warning: "Patient profile created from JWT - profile endpoint returned 404"
              };
            }
            throw error;
          }
          break;
          
        case 'doctor':
          try {
            const profile = await getDoctorProfile();
            return { ...profile, _detectedRole: 'doctor' };
          } catch (error) {
            console.log("Doctor profile failed, using JWT data");
            return { ...userData, _detectedRole: 'doctor' };
          }
          break;
          
        case 'hospital_admin':
          try {
            // For hospital admin, we need to get the user profile, not hospital profile
            // The JWT already contains the user information we need
            console.log("Hospital admin detected, using JWT data");
            return { 
              ...userData, 
              _detectedRole: 'hospital_admin',
              hospital_id: userData.hospital_roles?.[0]?.hospital_id || userData.hospital_id
            };
          } catch (error) {
            console.log("Hospital admin profile failed, using JWT data");
            return { ...userData, _detectedRole: 'hospital_admin' };
          }
          break;
          
        default:
          console.warn(`Unknown role: ${roleName}, falling back to endpoint detection`);
          // Continue to fallback logic
          break;
      }
    }
    
    // FALLBACK: Only try endpoints if no role in JWT
    console.warn("No role name found in JWT token. Trying to determine role via profile endpoints...");
    
    // Try patient profile first (most common case)
    try {
      console.log("Trying patient profile endpoint...");
      const patientProfile = await getPatientProfile();
      console.log("Successfully got patient profile");
      return {
        ...patientProfile,
        _detectedRole: 'patient'
      };
    } catch (patientError) {
      console.log("Patient profile failed:", patientError.status || patientError.message);
      
      // Try doctor profile
      try {
        console.log("Trying doctor profile endpoint...");
        const doctorProfile = await getDoctorProfile();
        console.log("Successfully got doctor profile");
        return {
          ...doctorProfile,
          _detectedRole: 'doctor'
        };
      } catch (doctorError) {
        console.log("Doctor profile failed:", doctorError.status || doctorError.message);
        
        // Try hospital admin - use JWT data directly
        try {
          console.log("Trying hospital admin profile...");
          if (userData.hospital_roles?.[0]?.hospital_id || userData.hospital_id) {
            console.log("Hospital admin detected in fallback, using JWT data");
            return {
              ...userData,
              _detectedRole: 'hospital_admin',
              hospital_id: userData.hospital_roles?.[0]?.hospital_id || userData.hospital_id
            };
          }
        } catch (hospitalError) {
          console.log("Hospital admin fallback failed:", hospitalError.message);
        }
      }
    }
    
    // If all endpoints failed, create a minimal profile from JWT
    console.warn("All profile endpoints failed, creating minimal profile from JWT");
    return {
      user_id: userData.user_id,
      username: userData.username,
      email: userData.email,
      first_name: userData.first_name || userData.username || "User",
      last_name: userData.last_name || "",
      global_role: userData.global_role,
      hospital_roles: userData.hospital_roles,
      _detectedRole: roleName || 'patient',
      _warning: "Profile created from JWT data - all endpoints failed"
    };
    
  } catch (error) {
    console.error("Critical error in getProfile:", error);
    throw new Error(`Failed to load user profile: ${error.message}`);
  }
}

/**
 * Enhanced profile functions with fallback logic
 */
async function tryProfileEndpoints() {
  console.log("Attempting to determine user role by trying different profile endpoints...");
  
  const endpoints = [
    { name: "patient", fn: getPatientProfile },
    { name: "doctor", fn: getDoctorProfile }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint.name} profile...`);
      const profile = await endpoint.fn();
      console.log(`Successfully got ${endpoint.name} profile`);
      return { ...profile, _detectedRole: endpoint.name };
    } catch (error) {
      console.log(`${endpoint.name} profile failed:`, error.status || error.message);
      
      // If it's a 404 for patient profile, it might be a missing UserDetails record
      if (endpoint.name === "patient" && error.status === 404) {
        console.log("Patient profile 404 - likely missing UserDetails record");
        // We'll handle this in the main getProfile function
      }
    }
  }
  
  console.warn("Could not determine user role from available endpoints");
  throw new Error("Unable to determine user role. Please contact support or try logging in again.");
}