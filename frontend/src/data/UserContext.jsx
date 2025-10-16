"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, logout as apiLogout } from "@/data/api-auth";
import { getProfile } from "@/data/api-user";
import { refreshTokens, getStoredTokens, clearTokens } from "@/data/api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Enhanced token detection for all roles including super-admin
  const getAllPossibleTokens = useCallback(() => {
    if (typeof window === "undefined") return { accessToken: "", refreshToken: "" };
    
    try {
      // Check ALL possible token storage keys used by different roles
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

      console.log("🔄 Token search results:", {
        accessTokenKeys: {
          access_token: localStorage.getItem("access_token"),
          accessToken: localStorage.getItem("accessToken"),
          admin_access_token: localStorage.getItem("admin_access_token"),
          superadmin_access_token: localStorage.getItem("superadmin_access_token"),
        },
        refreshTokenKeys: {
          refresh_token: localStorage.getItem("refresh_token"),
          refreshToken: localStorage.getItem("refreshToken"),
          admin_refresh_token: localStorage.getItem("admin_refresh_token"),
          superadmin_refresh_token: localStorage.getItem("superadmin_refresh_token"),
        },
        finalAccessToken: accessToken ? `[${accessToken.length} chars]` : "empty",
        finalRefreshToken: refreshToken ? `[${refreshToken.length} chars]` : "empty"
      });

      return { accessToken, refreshToken };
    } catch (error) {
      console.error("❌ Error reading tokens from localStorage:", error);
      return { accessToken: "", refreshToken: "" };
    }
  }, []);

  // Clear all possible token variations
  const clearAllTokens = useCallback(() => {
    if (typeof window === "undefined") return;
    
    try {
      const tokensToClear = [
        "access_token", "accessToken", "admin_access_token", "superadmin_access_token",
        "refresh_token", "refreshToken", "admin_refresh_token", "superadmin_refresh_token"
      ];
      
      tokensToClear.forEach(token => {
        localStorage.removeItem(token);
        sessionStorage.removeItem(token);
      });
      
      console.log("🧹 Cleared all possible token storage locations");
    } catch (error) {
      console.error("❌ Error clearing tokens:", error);
    }
  }, []);

  // Initialize user on mount - SINGLE useEffect
  useEffect(() => {
    const initializeUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use enhanced token check
        const tokens = getAllPossibleTokens();
        console.log("🔍 Initializing user - tokens found:", {
          hasAccessToken: !!tokens.accessToken,
          hasRefreshToken: !!tokens.refreshToken,
          accessTokenLength: tokens.accessToken?.length,
          refreshTokenLength: tokens.refreshToken?.length
        });
        
        // Strategy 1: Try refresh if we have a refresh token AND access token is expired
        if (tokens.refreshToken && tokens.accessToken) {
          // Check if access token is expired before trying refresh
          try {
            const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
            const exp = payload.exp;
            const now = Math.floor(Date.now() / 1000);
            const isExpired = exp < now;
            
            console.log("🔄 Access token expiration check:", {
              expiresAt: new Date(exp * 1000).toLocaleString(),
              isExpired: isExpired,
              timeUntilExpiry: exp - now
            });
            
            if (isExpired) {
              console.log("🔄 Access token expired, attempting refresh...");
              const refreshed = await refreshTokens();
              console.log("🔄 Token refresh result:", refreshed);
              
              if (refreshed) {
                console.log("✅ Tokens refreshed successfully");
                const profile = await getProfile();
                setUser(profile);
                console.log("✅ User profile loaded:", profile);
                setLoading(false);
                return;
              } else {
                console.log("❌ Token refresh failed");
                clearAllTokens();
              }
            } else {
              console.log("✅ Access token still valid, skipping refresh");
            }
          } catch (tokenError) {
            console.log("❌ Error checking token expiration:", tokenError);
            // If we can't parse the token, try refresh anyway
            console.log("🔄 Attempting token refresh due to parse error...");
            const refreshed = await refreshTokens();
            if (refreshed) {
              const profile = await getProfile();
              setUser(profile);
              setLoading(false);
              return;
            } else {
              clearAllTokens();
            }
          }
        } else if (tokens.refreshToken && !tokens.accessToken) {
          console.log("🔄 Only refresh token available, attempting refresh...");
          const refreshed = await refreshTokens();
          if (refreshed) {
            const profile = await getProfile();
            setUser(profile);
            setLoading(false);
            return;
          } else {
            clearAllTokens();
          }
        } else {
          console.log("🔄 No refresh token available, skipping refresh");
        }
        
        // Strategy 2: Try direct profile fetch with existing access token
        if (tokens.accessToken) {
          console.log("🔄 Attempting to use existing access token");
          try {
            const profile = await getProfile();
            setUser(profile);
            console.log("✅ User profile loaded with existing token:", profile);
            setLoading(false);
            return;
          } catch (profileError) {
            console.log("❌ Existing token invalid:", profileError.message);
            // Token is invalid, clear all possible tokens
            clearAllTokens();
          }
        }
        
        // If we get here, no valid authentication exists
        console.log("❌ No valid authentication found");
        setUser(null);
        
      } catch (e) {
        console.error("❌ Failed to initialize user:", e);
        setError(e.message);
        setUser(null);
        clearAllTokens();
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, [getAllPossibleTokens, clearAllTokens]);

  // Get user role helper
  const getUserRole = useCallback(() => {
    if (!user) {
      console.log("❌ getUserRole: No user data");
      return null;
    }
    
    console.log("🔍 Role Detection Analysis:", {
      hasDetectedRole: !!user._detectedRole,
      detectedRole: user._detectedRole,
      hasGlobalRole: !!user.global_role,
      globalRoleName: user.global_role?.role_name,
      hasRoleName: !!user.role_name,
      roleName: user.role_name,
      hasRole: !!user.role,
      role: user.role,
      hasHospitalId: !!user.hospital_id,
      hospitalId: user.hospital_id,
      hasSpecialties: !!user.specialties,
      specialties: user.specialties
    });
    
    // Priority 1: Check if role was detected from endpoint fallback
    if (user._detectedRole) {
      console.log("🔍 Using _detectedRole:", user._detectedRole);
      return user._detectedRole;
    }
    
    // Priority 2: Check JWT superadmin role first
    if (user.global_role?.role_name === 'superadmin') {
      console.log("🔍 Using global_role.role_name (superadmin):", user.global_role.role_name);
      return 'superadmin';
    }
    
    // Priority 3: Check other JWT roles
    if (user.global_role?.role_name) {
      console.log("🔍 Using global_role.role_name:", user.global_role.role_name);
      return user.global_role.role_name;
    }
    
    // Priority 4: Check direct role properties
    if (user.role_name) {
      console.log("🔍 Using role_name:", user.role_name);
      return user.role_name;
    }
    
    if (user.role) {
      console.log("🔍 Using role:", user.role);
      return user.role;
    }
    
    console.log("🔍 No clear role found, using fallback detection");
    // Fallback role detection based on available data
    if (user.hospital_id) return 'hospital_admin';
    if (user.specialties) return 'doctor';
    return 'patient';
  }, [user]);

  // Check if user has specific role
  const hasRole = useCallback((role) => {
    return getUserRole() === role;
  }, [getUserRole]);

  // Enhanced login function with better error handling
  const login = async ({ email, password }) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Attempting login for:", email);
      await apiLogin({ email, password });
      
      console.log("Login successful, fetching profile...");
      const profile = await getProfile();
      console.log("Profile fetched:", profile);
      
      setUser(profile);
      return profile;
    } catch (error) {
      console.error("Login failed:", error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Enhanced logout function
  const logout = async () => {
    try {
      setLoading(true);
      await apiLogout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setError(null);
      clearAllTokens();
      setLoading(false);
    }
  };

  // Update user function
  const updateUser = (newUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...newUserData
    }));
  };

  // Clear error function
  const clearError = () => {
    setError(null);
  };

  // Get user permissions helper
  const getUserPermissions = useCallback(() => {
    if (!user) return [];
    
    // Extract permissions from user object
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.flatMap(p => p.permissions || []);
    }
    
    return [];
  }, [user]);

  // Check if user has specific permission
  const hasPermission = useCallback((permission) => {
    const permissions = getUserPermissions();
    return permissions.includes(permission);
  }, [getUserPermissions]);

  // Get hospital ID for hospital admin users
  const getHospitalId = useCallback(() => {
    if (!user) return null;
    
    // Check if hospital_id is directly available
    if (user.hospital_id) return user.hospital_id;
    
    // Check hospital_roles array
    if (user.hospital_roles && user.hospital_roles.length > 0) {
      return user.hospital_roles[0].hospital_id;
    }
    
    return null;
  }, [user]);

  // Get user display name
  const getUserDisplayName = useCallback(() => {
    if (!user) return "Guest";
    
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    
    if (user.first_name) return user.first_name;
    if (user.username) return user.username;
    if (user.email) return user.email.split('@')[0];
    
    return "User";
  }, [user]);

  // Get user avatar URL
  const getUserAvatar = useCallback(() => {
    if (!user) return "/images/man.png";
    
    if (user.avatar_url) return user.avatar_url;
    
    // Default avatar based on gender
    if (user.gender === 'female') return "/images/woman.png";
    return "/images/man.png";
  }, [user]);

  // Check if user is authenticated
  const isAuthenticated = useCallback(() => {
    return user !== null;
  }, [user]);

  // Get user ID
  const getUserId = useCallback(() => {
    return user?.user_id || user?.id || null;
  }, [user]);

  const value = {
    // State
    user,
    loading,
    error,
    
    // Actions
    login,
    logout,
    updateUser,
    clearError,
    
    // Helpers
    getUserRole,
    hasRole,
    getUserPermissions,
    hasPermission,
    getHospitalId,
    getUserDisplayName,
    getUserAvatar,
    isAuthenticated,
    getUserId,
    
    // Role checks
    isPatient: () => hasRole('patient'),
    isDoctor: () => hasRole('doctor'),
    isHospitalAdmin: () => hasRole('hospital_admin'),
    isSuperAdmin: () => hasRole('superadmin'),
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider> 
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

// Export the context for advanced usage
export { UserContext };