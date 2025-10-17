// Optimized login process to reduce loading time
// This file provides faster login with better error handling

import { request } from './api.js';

// =============================================
// OPTIMIZED AUTHENTICATION APIs
// =============================================

/**
 * Fast login user with minimal API calls
 */
export async function fastLogin({ email, password }) {
  console.log("🚀 Fast login attempt for:", email);
  const startTime = Date.now();

  try {
    const response = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }, { withAuth: false });

    const loginTime = Date.now() - startTime;
    console.log(`✅ Login completed in ${loginTime}ms`);

    // Store tokens immediately
    if (response.access_token && response.refresh_token) {
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", response.access_token);
        localStorage.setItem("refresh_token", response.refresh_token);
        localStorage.setItem("isLoggedIn", "true");
        
        // Extract user info from JWT to avoid additional API call
        try {
          const payload = JSON.parse(atob(response.access_token.split('.')[1]));
          const userData = payload.user || payload;
          
          // Store user data from JWT
          localStorage.setItem("user_data", JSON.stringify(userData));
          
          // Extract hospital ID
          const hospitalId = userData.hospital_roles?.[0]?.hospital_id || null;
          if (hospitalId) {
            localStorage.setItem("hospital_id", hospitalId);
            console.log("🏥 Hospital ID stored:", hospitalId);
          }
          
          console.log("💾 User data stored from JWT:", userData);
        } catch (e) {
          console.warn("❌ Failed to parse JWT:", e);
        }
      }
    }

    return {
      ...response,
      loginTime,
      userData: response.user || null
    };
  } catch (error) {
    const loginTime = Date.now() - startTime;
    console.error(`❌ Login failed after ${loginTime}ms:`, error);
    throw error;
  }
}

/**
 * Get user profile with timeout
 */
export async function getProfileWithTimeout(timeoutMs = 5000) {
  console.log("🔄 Fetching profile with timeout...");
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await request("/auth/profile", {
      method: "GET",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const profileTime = Date.now() - startTime;
    console.log(`✅ Profile fetched in ${profileTime}ms`);
    
    return response;
  } catch (error) {
    const profileTime = Date.now() - startTime;
    if (error.name === 'AbortError') {
      console.error(`⏰ Profile fetch timed out after ${profileTime}ms`);
      throw new Error('Profile fetch timed out');
    }
    console.error(`❌ Profile fetch failed after ${profileTime}ms:`, error);
    throw error;
  }
}

/**
 * Get user permissions with timeout
 */
export async function getUserPermissionsWithTimeout(timeoutMs = 3000) {
  console.log("🔄 Fetching permissions with timeout...");
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await request("/api/hospital/permissions", {
      method: "GET",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const permissionsTime = Date.now() - startTime;
    console.log(`✅ Permissions fetched in ${permissionsTime}ms`);
    
    return response.permissions || [];
  } catch (error) {
    const permissionsTime = Date.now() - startTime;
    if (error.name === 'AbortError') {
      console.error(`⏰ Permissions fetch timed out after ${permissionsTime}ms`);
      return []; // Return empty array instead of throwing
    }
    console.error(`❌ Permissions fetch failed after ${permissionsTime}ms:`, error);
    return []; // Return empty array instead of throwing
  }
}

/**
 * Optimized login with parallel data fetching
 */
export async function optimizedLogin({ email, password }) {
  console.log("🚀 Starting optimized login for:", email);
  const totalStartTime = Date.now();

  try {
    // Step 1: Fast login
    const loginResult = await fastLogin({ email, password });
    
    // Step 2: Parallel data fetching (don't wait for profile if permissions are more important)
    const [profileResult, permissionsResult] = await Promise.allSettled([
      getProfileWithTimeout(3000), // 3 second timeout
      getUserPermissionsWithTimeout(2000) // 2 second timeout
    ]);
    
    const totalTime = Date.now() - totalStartTime;
    console.log(`🎉 Optimized login completed in ${totalTime}ms`);
    
    // Use profile data if available, otherwise use JWT data
    const userData = profileResult.status === 'fulfilled' 
      ? profileResult.value 
      : loginResult.userData;
    
    const permissions = permissionsResult.status === 'fulfilled' 
      ? permissionsResult.value 
      : [];
    
    return {
      user: userData,
      permissions,
      loginTime: loginResult.loginTime,
      totalTime,
      profileSuccess: profileResult.status === 'fulfilled',
      permissionsSuccess: permissionsResult.status === 'fulfilled'
    };
    
  } catch (error) {
    const totalTime = Date.now() - totalStartTime;
    console.error(`❌ Optimized login failed after ${totalTime}ms:`, error);
    throw error;
  }
}

/**
 * Check if user has cached data to avoid API calls
 */
export function getCachedUserData() {
  if (typeof window === "undefined") return null;
  
  try {
    const userData = localStorage.getItem("user_data");
    const permissions = localStorage.getItem("user_permissions");
    
    if (userData) {
      return {
        user: JSON.parse(userData),
        permissions: permissions ? JSON.parse(permissions) : [],
        fromCache: true
      };
    }
  } catch (error) {
    console.warn("❌ Failed to read cached user data:", error);
  }
  
  return null;
}

/**
 * Cache user data for faster subsequent loads
 */
export function cacheUserData(user, permissions = []) {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem("user_data", JSON.stringify(user));
    localStorage.setItem("user_permissions", JSON.stringify(permissions));
    console.log("💾 User data cached for faster loading");
  } catch (error) {
    console.warn("❌ Failed to cache user data:", error);
  }
}

/**
 * Clear cached user data
 */
export function clearCachedUserData() {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem("user_data");
    localStorage.removeItem("user_permissions");
    console.log("🧹 Cached user data cleared");
  } catch (error) {
    console.warn("❌ Failed to clear cached user data:", error);
  }
}

export default {
  fastLogin,
  getProfileWithTimeout,
  getUserPermissionsWithTimeout,
  optimizedLogin,
  getCachedUserData,
  cacheUserData,
  clearCachedUserData
};
