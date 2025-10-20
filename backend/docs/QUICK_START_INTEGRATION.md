# Quick Start Integration Guide

## 🚀 Get Started in 5 Minutes

This guide will help you quickly set up your Next.js frontend to communicate with the FastAPI backend.

---

## Prerequisites

- ✅ Backend running on `http://localhost:8000`
- ✅ Next.js frontend set up
- ✅ Database seeded with initial data (superadmin user)

---

## Step 1: Install Dependencies

```bash
cd frontend
npm install axios js-cookie react-hot-toast
```

---

## Step 2: Setup Environment Variables

Create `.env.local` in your frontend root:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
```

---

## Step 3: Create API Client

Create `src/services/api.js`:

```javascript
import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = Cookies.get('refresh_token');
      
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/auth/refresh-token`,
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` } }
          );
          
          Cookies.set('access_token', data.access_token, { expires: 7 });
          Cookies.set('refresh_token', data.refresh_token, { expires: 30 });
          
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(originalRequest);
        } catch {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Step 4: Create Auth Service

Create `src/services/authService.js`:

```javascript
import apiClient from './api';
import Cookies from 'js-cookie';

export const authService = {
  async login(email, password) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    Cookies.set('access_token', data.access_token, { expires: 7 });
    Cookies.set('refresh_token', data.refresh_token, { expires: 30 });
    return data;
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      window.location.href = '/login';
    }
  },

  async getCurrentUser() {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  isAuthenticated() {
    return !!Cookies.get('access_token');
  },
};
```

---

## Step 5: Create Auth Context

Create `src/contexts/AuthContext.js`:

```javascript
'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      if (authService.isAuthenticated()) {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    await authService.login(email, password);
    await loadUser();
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## Step 6: Wrap App with AuthProvider

Edit `src/app/layout.js`:

```javascript
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## Step 7: Create Login Page

Create `src/app/login/page.js`:

```javascript
'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Login successful!');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">Sign In</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## Step 8: Create Protected Route Component

Create `src/components/common/ProtectedRoute.jsx`:

```javascript
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated]);

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

---

## Step 9: Create Dashboard (Example)

Create `src/app/dashboard/page.js`:

```javascript
'use client';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/common/ProtectedRoute';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">Dashboard</h1>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">
              Welcome, {user?.email}!
            </h2>
            <p className="text-gray-600">User ID: {user?.user_id}</p>
            <p className="text-gray-600">Role: {user?.role}</p>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

---

## Step 10: Test Your Integration

1. **Start Backend:**
```bash
cd backend
python main.py
```

2. **Start Frontend:**
```bash
cd frontend
npm run dev
```

3. **Test Login:**
   - Navigate to `http://localhost:3000/login`
   - Enter credentials (superadmin user from DB)
   - Should redirect to `/dashboard` on success

4. **Test Protected Route:**
   - Try accessing `/dashboard` without logging in
   - Should redirect to `/login`

5. **Test Logout:**
   - Click logout button
   - Should clear tokens and redirect to login

---

## Common API Calls

### Get Hospital List (Superadmin)

```javascript
import apiClient from '@/services/api';

const hospitals = await apiClient.get('/hospitals/');
console.log(hospitals.data);
```

### Get Doctor Profile

```javascript
const profile = await apiClient.get('/doctors/profile');
console.log(profile.data);
```

### Update Patient Profile

```javascript
const updated = await apiClient.put('/patients/profile', {
  first_name: 'John',
  last_name: 'Doe',
  phone: '+919876543210'
});
```

### Create Hospital (Superadmin)

```javascript
const newHospital = await apiClient.post('/hospitals/', {
  hospital_name: 'New Hospital',
  hospital_email: 'info@newhospital.com',
  admin_contact: '+919999999999',
  address: 'Mumbai, India'
});
```

---

## Role-Based Routing

Create role-specific dashboards:

```javascript
// src/app/page.js
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Redirect based on role
      if (user.role === 'superadmin') {
        router.push('/admin/dashboard');
      } else if (user.role === 'doctor') {
        router.push('/doctorportal/dashboard');
      } else if (user.role === 'patient') {
        router.push('/patientportal/dashboard');
      }
    } else if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  return <div>Loading...</div>;
}
```

---

## Error Handling

Create `src/utils/errorHandler.js`:

```javascript
export function handleApiError(error) {
  if (error.response) {
    const { status, data } = error.response;
    switch (status) {
      case 400: return data.detail || 'Bad request';
      case 401: return 'Unauthorized. Please login again.';
      case 403: return 'You do not have permission to perform this action.';
      case 404: return 'Resource not found.';
      case 422: return data.detail || 'Validation error.';
      case 500: return 'Server error. Please try again later.';
      default: return data.detail || 'An error occurred.';
    }
  } else if (error.request) {
    return 'Network error. Please check your connection.';
  }
  return error.message || 'An unexpected error occurred.';
}
```

**Usage:**

```javascript
import { handleApiError } from '@/utils/errorHandler';
import toast from 'react-hot-toast';

try {
  await apiClient.post('/hospitals/', hospitalData);
  toast.success('Hospital created!');
} catch (error) {
  toast.error(handleApiError(error));
}
```

---

## Next Steps

1. ✅ **Read Full Documentation:**
   - `NEXTJS_BACKEND_INTEGRATION_COMPLETE_GUIDE.md`
   - `DATABASE_SCHEMA_AND_PERMISSIONS_REFERENCE.md`

2. ✅ **Create Service Files:**
   - `src/services/hospitalService.js`
   - `src/services/doctorService.js`
   - `src/services/patientService.js`

3. ✅ **Build UI Components:**
   - Hospital management UI
   - Doctor dashboard
   - Patient portal

4. ✅ **Test All Endpoints:**
   - Use Postman or Thunder Client
   - Test with different user roles

5. ✅ **Implement Permission-Based UI:**
   - Hide/show buttons based on permissions
   - Create role-specific layouts

---

## Troubleshooting

### Issue: CORS Error

**Solution:** Check backend `config.py`:
```python
CORS_ORIGINS = ["http://localhost:3000"]
```

### Issue: Token Not Sent in Request

**Solution:** Check `apiClient` interceptor in `api.js`

### Issue: 401 on Every Request

**Solution:** 
- Check if token is stored in cookies
- Verify token expiry
- Test refresh token endpoint

### Issue: Permission Denied (403)

**Solution:**
- Check user's role in database
- Verify permissions in `user_permissions` table
- Check API endpoint required permissions

---

## Production Deployment

### Backend (.env)
```env
DATABASE_URL=mysql+aiomysql://user:pass@host:3306/dbname
JWT_SECRET=strong-random-production-secret
CORS_ORIGINS=["https://yourfrontend.com"]
ENVIRONMENT=production
DEBUG=False
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.yourbackend.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=production-google-client-id
```

---

## Support

- **Backend Docs:** `http://localhost:8000/docs`
- **Full Integration Guide:** `NEXTJS_BACKEND_INTEGRATION_COMPLETE_GUIDE.md`
- **Database Reference:** `DATABASE_SCHEMA_AND_PERMISSIONS_REFERENCE.md`

---

**You're all set! 🎉**

Your Next.js frontend is now connected to your FastAPI backend with complete authentication and authorization.

**Document Version**: 1.0  
**Last Updated**: October 20, 2025

