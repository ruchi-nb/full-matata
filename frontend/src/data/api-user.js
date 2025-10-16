import { request, getStoredTokens } from './api.js';
import { getPatientProfile } from './api-patient.js';
import { getDoctorProfile } from './api-doctor.js';
import { getHospitalProfile, getMyHospitalId } from './api-hospital-admin.js';
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
            console.log("User data structure:", userData);
            console.log("Hospital roles:", userData.hospital_roles);
            console.log("Direct hospital_id:", userData.hospital_id);
            
            // Try multiple ways to extract hospital_id
            let hospitalId = null;
            if (userData.hospital_roles && userData.hospital_roles.length > 0) {
              hospitalId = userData.hospital_roles[0].hospital_id;
            } else if (userData.hospital_id) {
              hospitalId = userData.hospital_id;
            } else if (userData.hospital_role_id) {
              // Sometimes hospital_id might be stored as hospital_role_id
              hospitalId = userData.hospital_role_id;
            }
            
            console.log("Extracted hospital_id:", hospitalId);
            
            // If no hospital_id in JWT, try to get it from the hospital admin profile API
            if (!hospitalId) {
              console.log("No hospital_id in JWT, attempting to fetch from hospital admin API");
              try {
                const hospitalIdResponse = await getMyHospitalId();
                console.log("Hospital ID response:", hospitalIdResponse);
                hospitalId = hospitalIdResponse?.hospital_id;
                console.log("Hospital ID from API:", hospitalId);
              } catch (apiError) {
                console.log("Failed to get hospital ID from API:", apiError);
              }
            }
            
            return { 
              ...userData, 
              _detectedRole: 'hospital_admin',
              hospital_id: hospitalId
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
          console.log("Fallback - User data structure:", userData);
          console.log("Fallback - Hospital roles:", userData.hospital_roles);
          console.log("Fallback - Direct hospital_id:", userData.hospital_id);
          
          // Try multiple ways to extract hospital_id
          let hospitalId = null;
          if (userData.hospital_roles && userData.hospital_roles.length > 0) {
            hospitalId = userData.hospital_roles[0].hospital_id;
          } else if (userData.hospital_id) {
            hospitalId = userData.hospital_id;
          } else if (userData.hospital_role_id) {
            hospitalId = userData.hospital_role_id;
          }
          
          if (hospitalId) {
            console.log("Hospital admin detected in fallback, using JWT data");
            console.log("Fallback - Extracted hospital_id:", hospitalId);
            return {
              ...userData,
              _detectedRole: 'hospital_admin',
              hospital_id: hospitalId
            };
          } else {
            // Try to get hospital ID from API
            console.log("No hospital_id in JWT fallback, attempting to fetch from API");
            try {
              const hospitalIdResponse = await getMyHospitalId();
              console.log("Fallback - Hospital ID response:", hospitalIdResponse);
              hospitalId = hospitalIdResponse?.hospital_id;
              console.log("Fallback - Hospital ID from API:", hospitalId);
              
              if (hospitalId) {
                return {
                  ...userData,
                  _detectedRole: 'hospital_admin',
                  hospital_id: hospitalId
                };
              }
            } catch (apiError) {
              console.log("Fallback - Failed to get hospital ID from API:", apiError);
            }
          }
        } catch (hospitalError) {
          console.log("Hospital admin fallback failed:", hospitalError.message);
        }
      }
    }
    
    // If all endpoints failed, create a minimal profile from JWT
    console.warn("All profile endpoints failed, creating minimal profile from JWT");
    
    // Try to extract hospital_id for hospital admin users
    let hospitalId = null;
    if (userData.hospital_roles && userData.hospital_roles.length > 0) {
      hospitalId = userData.hospital_roles[0].hospital_id;
    } else if (userData.hospital_id) {
      hospitalId = userData.hospital_id;
    } else if (userData.hospital_role_id) {
      hospitalId = userData.hospital_role_id;
    }
    
    console.log("Minimal profile - Extracted hospital_id:", hospitalId);
    
    return {
      user_id: userData.user_id,
      username: userData.username,
      email: userData.email,
      first_name: userData.first_name || userData.username || "User",
      last_name: userData.last_name || "",
      global_role: userData.global_role,
      hospital_roles: userData.hospital_roles,
      hospital_id: hospitalId,
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