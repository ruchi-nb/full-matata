"use client";

import { useState, useEffect } from "react";
import RegisterModal from "@/components/Landing/RegisterModal";
import { login, loginWithGoogle } from "@/data/api-auth";
import { getProfile } from "@/data/api-user";
import { getStoredTokens } from "@/data/api";
import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, AlertCircle, X } from "lucide-react";

export default function LoginPopup({ open, onClose, onLogin, onRegisterClick }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const [validationErrors, setValidationErrors] = useState({});

  // State management for modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // ✅ FIX: Define handleClose early to avoid reference errors
  const handleClose = () => {
    if (!loading) {
      setFormData({ email: "", password: "" });
      setError("");
      setValidationErrors({});
      onClose();
    }
  };

  // Open Register Modal (from anywhere)
  const openRegisterModal = () => {
    setIsLoginOpen(false);
    setIsRegisterOpen(true);
  };

  // Open Login Modal (from anywhere)
  const openLoginModal = () => {
    setIsRegisterOpen(false);
    setIsLoginOpen(true);
  };

  // Close Register Modal
  const closeRegisterModal = () => {
    setIsRegisterOpen(false);
  };

  // Close Login Modal
  const closeLoginModal = () => {
    setIsLoginOpen(false);
  };

  // Switch from Login to Register
  const switchToRegister = () => {
    closeLoginModal();
    openRegisterModal();
  };

  // Close modal when clicking overlay (for both modals)
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose(); // ✅ FIX: Use handleClose instead of closeRegisterModal/closeLoginModal
    }
  };

  // Close modal with Escape key (for both modals)
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        handleClose(); // ✅ FIX: Use handleClose instead of closeRegisterModal/closeLoginModal
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);

  // Rest of your functions remain the same...
  const validateForm = () => {
    const errors = {};

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }

    // Clear error message
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError("Please fix the validation errors below");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("🔄 [DEBUG] Starting login process for:", formData.email);
      
      // Step 1: Call login API
      console.log("🔄 [DEBUG] Step 1: Calling login API...");
      const loginResponse = await login({ email: formData.email, password: formData.password });
      console.log("✅ [DEBUG] Login API response:", loginResponse);
      
      // Step 2: Check tokens immediately after login
      console.log("🔄 [DEBUG] Step 2: Checking stored tokens...");
      const tokens = getStoredTokens();
      console.log("🔍 [DEBUG] Tokens after login:", {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        accessTokenLength: tokens.accessToken?.length,
        refreshTokenLength: tokens.refreshToken?.length,
        accessTokenPreview: tokens.accessToken ? tokens.accessToken.substring(0, 20) + '...' : 'none',
        refreshTokenPreview: tokens.refreshToken ? tokens.refreshToken.substring(0, 20) + '...' : 'none'
      });

      // Step 3: Check localStorage directly for extra verification
      if (typeof window !== "undefined") {
        console.log("🔍 [DEBUG] Direct localStorage check:");
        console.log("  - access_token:", localStorage.getItem("access_token")?.substring(0, 20) + '...' || 'not found');
        console.log("  - refresh_token:", localStorage.getItem("refresh_token")?.substring(0, 20) + '...' || 'not found');
        console.log("  - isLoggedIn:", localStorage.getItem("isLoggedIn") || 'not found');
      }

      // Step 4: Get user profile
      console.log("🔄 [DEBUG] Step 3: Fetching user profile...");
      const profile = await getProfile();
      console.log("✅ [DEBUG] Profile fetched successfully:", {
        user_id: profile.user_id,
        email: profile.email,
        _detectedRole: profile._detectedRole,
        global_role: profile.global_role,
        role_name: profile.role_name,
        role: profile.role
      });

      // Step 5: Call onLogin callback
      console.log("🔄 [DEBUG] Step 4: Calling onLogin callback...");
      onLogin && onLogin(profile);
      
      // Step 6: Determine role and redirect
      console.log("🔄 [DEBUG] Step 5: Determining user role...");
      const role = profile._detectedRole || profile.global_role?.role_name || 'patient';
      console.log("🎯 [DEBUG] Final determined role:", role);
      
      let portalPath;
      switch (role) {
        case 'superadmin':
          portalPath = '/admin';
          break;
        case 'hospital_admin':
          portalPath = '/Hospital';
          break;
        case 'doctor':
          portalPath = '/doctorportal';
          break;
        case 'patient':
        default:
          portalPath = '/patientportal';
          break;
      }
      
      console.log("🔄 [DEBUG] Step 6: Redirecting to:", portalPath);
      console.log("🔍 [DEBUG] Current path before redirect:", window.location.pathname);
      
      // Try router first
      router.push(portalPath);
      
      // Fallback in case router doesn't work
      setTimeout(() => {
        if (window.location.pathname !== portalPath) {
          console.log("⚠️ [DEBUG] Router didn't navigate, using window.location fallback");
          window.location.href = portalPath;
        } else {
          console.log("✅ [DEBUG] Router navigation successful!");
        }
      }, 1000);
      
      console.log("🔄 [DEBUG] Step 7: Closing login modal...");
      handleClose(); // ✅ FIX: Use handleClose instead of onClose
      
    } catch (error) {
      console.error("❌ [DEBUG] Login process failed:", error);
      console.error("❌ [DEBUG] Error details:", {
        message: error.message,
        status: error.status,
        data: error.data
      });
      setError(error.message || "Login failed. Please check your credentials and try again.");
    } finally {
      console.log("🔄 [DEBUG] Login process completed, setting loading to false");
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError("");

    try {
      console.log("🔄 [DEBUG] Starting Google login process...");
      console.log("🔍 [DEBUG] Google credential received:", !!credentialResponse.credential);
      
      await loginWithGoogle(credentialResponse.credential);
      
      // Check tokens after Google login
      const tokens = getStoredTokens();
      console.log("🔍 [DEBUG] Tokens after Google login:", {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken
      });
      
      let profile;
      try {
        profile = await getProfile();
        console.log("✅ [DEBUG] Google login successful, profile:", profile);
      } catch (profileError) {
        console.log("⚠️ [DEBUG] Profile fetch failed, using fallback:", profileError.message);
        // Create a basic profile from JWT data as fallback
        const userData = JSON.parse(atob(tokens.accessToken.split('.')[1]));
        profile = {
          user_id: userData.user_id,
          username: userData.username,
          email: userData.email,
          first_name: userData.first_name || userData.username || "User",
          last_name: userData.last_name || "",
          _detectedRole: 'patient',
          _warning: "Profile created from JWT due to backend error"
        };
      }
      
      onLogin && onLogin(profile);
      
      const role = profile._detectedRole || profile.global_role?.role_name || 'patient';
      console.log("🎯 [DEBUG] Google login - User role:", role);
      
      let portalPath;
      switch (role) {
        case 'superadmin':
          portalPath = '/admin';
          break;
        case 'hospital_admin':
          portalPath = '/Hospital';
          break;
        case 'doctor':
          portalPath = '/doctorportal';
          break;
        case 'patient':
        default:
          portalPath = '/patientportal';
          break;
      }
      
      console.log("🔄 [DEBUG] Google login redirecting to:", portalPath);
      router.push(portalPath);
      
      handleClose(); // ✅ FIX: Use handleClose instead of onClose
    } catch (error) {
      console.error("❌ [DEBUG] Google login failed:", error);
      setError(error.message || "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error("Google login error");
    setError("Google login failed. Please try again.");
  };

  // Remove the duplicate handleClose function that was here

  const handleRegisterClick = () => {
    handleClose();
    setIsRegisterOpen(true);
  };

  const handleRegisterClose = () => {
    setIsRegisterOpen(false);
  };

  const handleRegisterSuccess = (profile) => { 
    setIsRegisterOpen(false);
    onLogin && onLogin(profile);
    
    const role = profile._detectedRole || profile.global_role?.role_name || 'patient';
    let portalPath;
    switch (role) {
      case 'superadmin':
        portalPath = '/admin';
        break;
      case 'hospital_admin':
        portalPath = '/Hospital';
        break;
      case 'doctor':
        portalPath = '/doctorportal';
        break;
      case 'patient':
      default:
        portalPath = '/patientportal';
        break;
    }
    
    console.log("Register success, redirecting to:", portalPath);
    router.push(portalPath);
  };

  // Don't render anything if not open
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={handleOverlayClick}>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/30" 
          aria-hidden="true"
          onClick={handleClose}
        />
        
        {/* Modal */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="mx-auto max-w-md w-full bg-white rounded-2xl p-6 shadow-xl relative">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Rest of your JSX remains the same */}
            <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-[#004dd6] to-[#3d85c6] mb-4">
              Welcome Back
            </h2>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-[#004dd6] to-[#3d85c6] text-white rounded-lg hover:from-[#003cb3] hover:to-[#2d6ba3] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
                logo_alignment="left"
                disabled={loading}
              />
            </div>

            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                onClick={switchToRegister}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <RegisterModal
        open={isRegisterOpen}
        onClose={handleRegisterClose}
        onLogin={handleRegisterSuccess}
      />
    </>
  );
}