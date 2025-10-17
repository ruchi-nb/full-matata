import { request } from './api.js';

// =============================================
// AUTHENTICATION APIs
// =============================================

/**
 * Login user 
 */
export async function login({ email, password }) {
  console.log("🔐 Attempting login for:", email);

  const response = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }, { withAuth: false });

  console.log("✅ Login successful, response:", response);

  // Store tokens and isLoggedIn flag
  if (response.access_token && response.refresh_token) {
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      localStorage.setItem("isLoggedIn", "true");
      console.log("💾 Tokens stored in localStorage");

      // Parse JWT to get hospital_id if exists
      try {
        const payload = JSON.parse(atob(response.access_token.split('.')[1]));
        // JWT structure: { user: { hospital_roles: [...] }, ... }
        const userData = payload.user || payload;
        const hospitalId = userData.hospital_roles?.[0]?.hospital_id || null;
        if (hospitalId) {
          localStorage.setItem("hospital_id", hospitalId);
          console.log("🏥 Hospital ID stored:", hospitalId);
        } else {
          console.log("⚠️ No hospital ID found in JWT");
          console.log("JWT payload structure:", payload);
        }
      } catch (e) {
        console.warn("❌ Failed to parse JWT for hospital ID:", e);
      }
    }
  }

  return response;
}


/**
 * Login with Google OAuth
 */
export async function loginWithGoogle(credential) {
  console.log("🔐 Attempting Google login with credential:", credential);

  const response = await request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential })
  }, { withAuth: false });

  console.log("✅ Google login successful, response:", response);

  // Store tokens and isLoggedIn flag
  if (response.access_token && response.refresh_token) {
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      localStorage.setItem("isLoggedIn", "true");
      console.log("💾 Tokens stored in localStorage");

      // Parse JWT to get hospital_id if exists
      try {
        const payload = JSON.parse(atob(response.access_token.split('.')[1]));
        const userData = payload.user || payload;
        const hospitalId = userData.hospital_roles?.[0]?.hospital_id || null;
        if (hospitalId) {
          localStorage.setItem("hospital_id", hospitalId);
          console.log("🏥 Hospital ID stored:", hospitalId);
        } else {
          console.log("⚠️ No hospital ID found in JWT");
        }
      } catch (e) {
        console.warn("❌ Failed to parse JWT for hospital ID:", e);
      }
    }
  }

  return response;
}

/**
 * Logout user
 */
export async function logout() {
  console.log("🚪 Attempting logout");
  
  try {
    const response = await request("/auth/logout", {
      method: "POST"
    });
    
    // Clear tokens and hospital_id regardless of API response
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("admin_access_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("superadmin_access_token");
      localStorage.removeItem("superadmin_refresh_token");
      localStorage.removeItem("hospital_id"); // <-- clear hospital ID
      localStorage.removeItem("isLoggedIn");
      console.log("🧹 All tokens and hospital ID cleared from localStorage");
    }
    
    return response;
  } catch (error) {
    console.error("❌ Logout error:", error);
    // Still clear tokens and hospital_id even if API call fails
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("admin_access_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("superadmin_access_token");
      localStorage.removeItem("superadmin_refresh_token");
      localStorage.removeItem("hospital_id"); // <-- clear hospital ID
      localStorage.removeItem("isLoggedIn");
      console.log("🧹 Tokens and hospital ID cleared despite API error");
    }
    throw error;
  }
}

/**
 * Register new user
 */
export async function register(userData) {
  console.log("📝 Attempting registration for:", userData.email);
  
  const response = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify(userData)
  }, { withAuth: false });
  
  console.log("✅ Registration successful");
  return response;
}

/**
 * Request password reset
 */
export async function forgotPassword(email) {
  console.log("🔑 Requesting password reset for:", email);
  
  const response = await request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  }, { withAuth: false });
  
  console.log("✅ Password reset email sent");
  return response;
}

/**
 * Reset password with token
 */
export async function resetPassword(token, newPassword) {
  console.log("🔄 Resetting password with token");
  
  const response = await request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword })
  }, { withAuth: false });
  
  console.log("✅ Password reset successful");
  return response;
}

/**
 * Verify email
 */
export async function verifyEmail(token) {
  console.log("📧 Verifying email with token");
  
  const response = await request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token })
  }, { withAuth: false });
  
  console.log("✅ Email verification successful");
  return response;
}