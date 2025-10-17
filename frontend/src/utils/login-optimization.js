// IMMEDIATE FIX for slow login loading
// Replace your current login function with this optimized version

// 1. Update your LoginPopUp.js component to use this optimized login:

const optimizedLogin = async (credentials) => {
  console.log("🚀 Starting optimized login...");
  const startTime = Date.now();

  try {
    // Step 1: Fast login API call
    const loginResponse = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const loginTime = Date.now() - startTime;
    console.log(`✅ Login API completed in ${loginTime}ms`);

    // Step 2: Store tokens immediately
    if (loginData.access_token && loginData.refresh_token) {
      localStorage.setItem("access_token", loginData.access_token);
      localStorage.setItem("refresh_token", loginData.refresh_token);
      localStorage.setItem("isLoggedIn", "true");
      
      // Extract user data from JWT to avoid additional API call
      try {
        const payload = JSON.parse(atob(loginData.access_token.split('.')[1]));
        const userData = payload.user || payload;
        
        // Store user data from JWT
        localStorage.setItem("user_data", JSON.stringify(userData));
        
        // Extract hospital ID
        const hospitalId = userData.hospital_roles?.[0]?.hospital_id || null;
        if (hospitalId) {
          localStorage.setItem("hospital_id", hospitalId);
        }
        
        console.log("💾 User data stored from JWT");
      } catch (e) {
        console.warn("❌ Failed to parse JWT:", e);
      }
    }

    // Step 3: Redirect immediately (don't wait for profile fetch)
    const totalTime = Date.now() - startTime;
    console.log(`🎉 Optimized login completed in ${totalTime}ms`);
    
    // Redirect to appropriate dashboard
    const userRole = loginData.user?.global_role?.role_name;
    if (userRole && !['superadmin', 'hospital_admin', 'doctor', 'patient'].includes(userRole)) {
      // Custom role - redirect to dynamic dashboard
      window.location.href = '/custom-dashboard';
    } else {
      // Standard role - redirect to existing dashboard
      window.location.href = '/Hospital';
    }

    return loginData;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Login failed after ${totalTime}ms:`, error);
    throw error;
  }
};

// 2. Update your UserContext to use cached data for faster loading:

const useOptimizedUserContext = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        setLoading(true);
        
        // Check for cached user data first
        const cachedUserData = localStorage.getItem("user_data");
        if (cachedUserData) {
          console.log("⚡ Using cached user data for instant loading");
          setUser(JSON.parse(cachedUserData));
          setLoading(false);
          
          // Validate token in background
          setTimeout(() => validateTokenInBackground(), 100);
          return;
        }
        
        // If no cached data, try to fetch profile
        const accessToken = localStorage.getItem("access_token");
        if (accessToken) {
          try {
            const profileResponse = await fetch('http://localhost:8000/auth/profile', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (profileResponse.ok) {
              const profile = await profileResponse.json();
              setUser(profile);
              localStorage.setItem("user_data", JSON.stringify(profile));
            }
          } catch (error) {
            console.warn("Profile fetch failed:", error);
          }
        }
        
      } catch (error) {
        console.error("User initialization failed:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const validateTokenInBackground = async () => {
    try {
      const accessToken = localStorage.getItem("access_token");
      if (accessToken) {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const exp = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        
        // If token expires in less than 5 minutes, refresh it
        if (exp - now < 300) {
          console.log("🔄 Token expires soon, refreshing in background...");
          // Add your token refresh logic here
        }
      }
    } catch (error) {
      console.warn("Background token validation failed:", error);
    }
  };

  return { user, loading, isAuthenticated: !!user };
};

// 3. Quick fix for your current login component:

// Replace your current login function with:
const handleLogin = async (credentials) => {
  try {
    // Show loading immediately
    setIsLoading(true);
    
    // Use optimized login
    await optimizedLogin(credentials);
    
    // Don't wait for additional API calls - redirect immediately
    // The dashboard will load user data from cache
    
  } catch (error) {
    console.error("Login failed:", error);
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};

export { optimizedLogin, useOptimizedUserContext };
