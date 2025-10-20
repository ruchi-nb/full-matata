// Enhanced API client with robust error handling and fallback logic
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
console.log("API_BASE:", API_BASE);
console.log("NEXT_PUBLIC_API_BASE env:", process.env.NEXT_PUBLIC_API_BASE);

// Token management with better error handling
function getStoredTokens() {
  if (typeof window === "undefined") return { accessToken: "", refreshToken: "" };
  try {
    const accessToken = localStorage.getItem("access_token") || "";
    const refreshToken = localStorage.getItem("refresh_token") || "";
    
    // ⚠️ REMOVE or RELAX this strict validation - it's causing false positives
    // JWT tokens don't always have exactly 3 parts, especially if encoded differently
    // const isValidAccessToken = accessToken && accessToken.split('.').length === 3;
    // const isValidRefreshToken = refreshToken && refreshToken.split('.').length === 3;
    
    // Use more lenient validation - just check if tokens exist and are non-empty
    const isValidAccessToken = accessToken && accessToken.length > 10;
    const isValidRefreshToken = refreshToken && refreshToken.length > 10;
    
    if (accessToken && !isValidAccessToken) {
      console.warn("❌ Invalid access token format detected");
      // Don't automatically clear - this might be a false positive
    }
    
    if (refreshToken && !isValidRefreshToken) {
      console.warn("❌ Invalid refresh token format detected");
      // Don't automatically clear - this might be a false positive
    }
    
    // Only return empty if both are completely missing/invalid
    if (!accessToken && !refreshToken) {
      return { accessToken: "", refreshToken: "" };
    }
    
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("❌ Error reading tokens from localStorage:", error);
    return { accessToken: "", refreshToken: "" };
  }
}

function setStoredTokens(accessToken, refreshToken) {
  if (typeof window === "undefined") return;
  try {
    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
      console.log("💾 Access token stored, length:", accessToken.length);
    }
    if (refreshToken !== undefined) {
      localStorage.setItem("refresh_token", refreshToken);
      console.log("💾 Refresh token stored, length:", refreshToken?.length);
    }
    // Also set isLoggedIn flag
    localStorage.setItem("isLoggedIn", "true");
  } catch (error) {
    console.error("❌ Error storing tokens in localStorage:", error);
  }
}

function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// Health check function
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE}/docs`, { 
      method: "HEAD",
      cache: "no-cache"
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Enhanced request function with better error handling
async function request(path, options = {}, { withAuth = true } = {}) {
  const url = `${API_BASE}${path}`;
  
  // Handle FormData vs JSON content type
  const isFormData = options.body instanceof FormData;
  const headers = isFormData 
    ? { ...(options.headers || {}) } // Don't set Content-Type for FormData
    : { "Content-Type": "application/json", ...(options.headers || {}) };

  if (withAuth) {
    const { accessToken } = getStoredTokens();
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    console.log("Making request to:", url);
    console.log("Request headers:", headers);
    console.log("Request body:", isFormData ? "[FormData]" : options.body);
    
    const fetchOptions = { ...options, headers };
    console.log("Fetch options:", fetchOptions);
    
    const res = await fetch(url, fetchOptions);
    
    console.log("Response status:", res.status);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));
    
    if (res.status === 401 && withAuth) {
      console.log("Token expired, attempting refresh...");
      const ok = await refreshTokens();
      if (ok) {
        const { accessToken } = getStoredTokens();
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const retry = await fetch(url, { ...options, headers, credentials: "include" });
        return handleResponse(retry);
      }
    }
    return handleResponse(res);
  } catch (error) {
    // Only log detailed error info in development
    if (process.env.NODE_ENV === 'development') {
      console.error("Request failed:", error);
      console.error("Request URL:", url);
      console.error("Request options:", options);
    }
    throw new Error(`Network error: ${error.message}`);
  }
}

async function handleResponse(res) {
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();
  
  console.log("Response data:", data);
  console.log("Response ok:", res.ok);
  console.log("Response status:", res.status);
  
  if (!res.ok) {
  let message = res.statusText;

  if (data) {
    if (typeof data === "string") {
      message = data;
    } else if (Array.isArray(data)) {
      // Handle arrays of errors (e.g. validation errors)
      message = data.map(err => err.msg || JSON.stringify(err)).join(", ");
    } else if (data.detail) {
      // Sometimes detail can be a string or array
      if (Array.isArray(data.detail)) {
        message = data.detail.map(d => d.msg || JSON.stringify(d)).join(", ");
      } else if (typeof data.detail === "object") {
        message = data.detail.msg || JSON.stringify(data.detail);
      } else {
        message = data.detail;
      }
    } else if (data.message) {
      message = data.message;
    } else {
      // fallback: stringify entire object
      message = JSON.stringify(data);
    }
  }

  console.log("❌ Error message:", message);
  console.log("❌ Error data:", data);

  const error = new Error(message);
  error.status = res.status;
  error.data = data;
  throw error;
}
  return data;
}

// Token refresh function
// In api.js - Enhance the refresh token function
export async function refreshTokens() {
  const { refreshToken } = getStoredTokens();
  console.log("🔄 Attempting token refresh with refreshToken:", !!refreshToken);
  
  if (!refreshToken) {
    console.log("❌ No refresh token available");
    clearTokens();
    return false;
  }
  
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refreshToken}` 
      },
    });
    
    console.log("🔄 Refresh token response status:", res.status);
    console.log("🔄 Refresh token response headers:", Object.fromEntries(res.headers.entries()));
    
    if (res.ok) {
      const data = await res.json();
      console.log("✅ Token refresh successful, new tokens:", {
        hasAccess: !!data.access_token,
        hasRefresh: !!data.refresh_token
      });
      setStoredTokens(data.access_token, data.refresh_token);
      return true;
    } else {
      const errorText = await res.text();
      console.log("❌ Token refresh failed with status:", res.status, "Response:", errorText);
      clearTokens();
      return false;
    }
  } catch (error) {
    console.error("❌ Token refresh error:", error);
    clearTokens();
    return false;
  }
}

// Internal API functions for contexts
export const apiInternal = { getStoredTokens, setStoredTokens, clearTokens };

// Named exports for token helpers (used by contexts/UserContext.jsx)
export { getStoredTokens, setStoredTokens, clearTokens };

// Export the base request function for other modules
export { request };

// Temporary debug function - call this in your browser console
export function debugTokens() {
  if (typeof window === "undefined") {
    console.log("❌ This function only works in the browser");
    return;
  }
  
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  
  console.log("🔍 TOKEN DEBUG INFO:");
  console.log("Access Token exists:", !!accessToken);
  console.log("Access Token length:", accessToken?.length);
  console.log("Refresh Token exists:", !!refreshToken);
  console.log("Refresh Token length:", refreshToken?.length);
  console.log("isLoggedIn flag:", isLoggedIn);
  
  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      console.log("Access Token parts:", parts.length);
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log("Access Token payload:", payload);
        
        // Check token expiration
        const exp = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        console.log("Token expiration:", new Date(exp * 1000).toLocaleString());
        console.log("Token is expired:", exp < now);
      } else {
        console.log("⚠️ Access token doesn't have 3 parts - might be malformed");
      }
    } catch (e) {
      console.log("❌ Access Token parse error:", e);
    }
  } else {
    console.log("❌ No access token found in localStorage");
  }
  
  if (refreshToken) {
    try {
      const parts = refreshToken.split('.');
      console.log("Refresh Token parts:", parts.length);
      // Don't try to parse refresh token payload as it might be structured differently
    } catch (e) {
      console.log("❌ Refresh Token parse error:", e);
    }
  } else {
    console.log("❌ No refresh token found in localStorage");
  }
  
  // Check all localStorage items related to auth
  console.log("🔍 All auth-related localStorage items:");
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes('token') || key.includes('auth') || key.includes('login')) {
      const value = localStorage.getItem(key);
      console.log(`  ${key}: ${value ? value.substring(0, 50) + '...' : 'null'}`);
    }
  }
}
// Also add a function to clear and reset auth state
export function resetAuthDebug() {
  if (typeof window === "undefined") return;
  
  console.log("🔄 Resetting auth state...");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("isLoggedIn");
  console.log("✅ Auth state reset complete");
  debugTokens(); // Show the new state
}

// Enhanced token detection for all roles
function getAllPossibleTokens() {
  if (typeof window === "undefined") return { accessToken: "", refreshToken: "" };
  
  try {
    // Check ALL possible token storage keys
    const accessToken =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("admin_access_token") ||
      localStorage.getItem("superadmin_access_token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("accessToken") ||
      "";
    
    const refreshToken =
      localStorage.getItem("refresh_token") ||
      localStorage.getItem("refreshToken") ||
      localStorage.getItem("admin_refresh_token") ||
      localStorage.getItem("superadmin_refresh_token") ||
      sessionStorage.getItem("refresh_token") ||
      sessionStorage.getItem("refreshToken") ||
      "";

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("❌ Error reading tokens from storage:", error);
    return { accessToken: "", refreshToken: "" };
  }
}

export function getHospitalId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hospital_id");
}

export function setHospitalId(hospitalId) {
  if (typeof window === "undefined") return;
  localStorage.setItem("hospital_id", hospitalId);
}

export function clearHospitalId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("hospital_id");
}

// Re-export commonly used functions to fix import errors
export { getAllHospitals, getAllDoctors } from './api-hospital-admin.js';