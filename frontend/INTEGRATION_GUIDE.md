# Frontend-Backend Integration Guide

## Overview

This guide documents the complete frontend integration solution that handles all backend issues and provides robust error handling, fallback logic, and enhanced user experience.

## Key Features

### 🔧 **Robust API Client**
- Enhanced error handling with detailed logging
- Automatic token refresh with fallback logic
- Dynamic role detection when JWT tokens are incomplete
- Comprehensive request/response handling

### 🛡️ **Error Handling & Fallbacks**
- Graceful degradation when backend endpoints fail
- Automatic role detection through endpoint testing
- User-friendly error messages
- Development vs production error display

### 👤 **Enhanced User Context**
- Complete user state management
- Role-based helper functions
- Permission checking utilities
- Automatic profile loading and caching

### 🔐 **Authentication Flow**
- Secure login/logout with token management
- Google OAuth integration
- Automatic role-based routing
- Session persistence

## File Structure

```
frontend/src/
├── data/
│   ├── api.js                 # Enhanced API client
│   └── UserContext.jsx        # User state management
├── components/
│   ├── common/
│   │   ├── ErrorBoundary.jsx  # Error handling
│   │   ├── LoadingSpinner.jsx # Loading states
│   │   └── StatusIndicator.jsx # Connection status
│   └── Landing/
│       ├── LoginPopUp.js      # Enhanced login
│       └── RegisterModal.jsx  # Enhanced registration
└── app/
    └── layout.js              # Updated with providers
```

## Key Components

### 1. Enhanced API Client (`api.js`)

**Features:**
- Dynamic profile routing based on user roles
- Fallback endpoint detection when JWT is incomplete
- Comprehensive error handling and logging
- Token refresh with automatic retry

**Key Functions:**
```javascript
// Dynamic profile function with fallback logic
export async function getProfile()

// Enhanced registration with validation
export async function registerPatient(payload)

// Role-specific profile functions
export function getPatientProfile()
export function getDoctorProfile()
export function getHospitalProfile(hospitalId)
```

### 2. User Context (`UserContext.jsx`)

**Features:**
- Complete user state management
- Role detection and helper functions
- Permission checking utilities
- Automatic profile loading

**Key Functions:**
```javascript
// Role helpers
getUserRole()
hasRole(role)
isPatient() / isDoctor() / isHospitalAdmin()

// Permission helpers
getUserPermissions()
hasPermission(permission)

// User info helpers
getUserDisplayName()
getUserAvatar()
getHospitalId()
```

### 3. Enhanced Login (`LoginPopUp.js`)

**Features:**
- Form validation with real-time feedback
- Google OAuth integration
- Automatic role-based routing
- Enhanced error handling

### 4. Enhanced Registration (`RegisterModal.jsx`)

**Features:**
- Comprehensive form validation
- Real-time error feedback
- Auto-login after successful registration
- Role-based routing

## Backend Issue Handling

### 1. Missing UserDetails Records
**Problem:** Users exist in `users` table but not in `user_details` table
**Solution:** Frontend automatically detects this and provides clear error messages

### 2. Incomplete JWT Tokens
**Problem:** JWT tokens missing role information
**Solution:** Dynamic endpoint testing to determine user role

### 3. Registration Failures
**Problem:** Backend registration process fails
**Solution:** Enhanced error handling with specific error messages

### 4. Database Connection Issues
**Problem:** Backend database connectivity problems
**Solution:** Graceful error handling with user-friendly messages

## Usage Examples

### Basic Authentication
```javascript
import { useUser } from '@/data/UserContext';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useUser();
  
  if (!isAuthenticated()) {
    return <LoginForm onLogin={login} />;
  }
  
  return <Dashboard user={user} />;
}
```

### Role-Based Rendering
```javascript
function Dashboard() {
  const { isPatient, isDoctor, isHospitalAdmin } = useUser();
  
  return (
    <div>
      {isPatient() && <PatientDashboard />}
      {isDoctor() && <DoctorDashboard />}
      {isHospitalAdmin() && <HospitalDashboard />}
    </div>
  );
}
```

### Permission Checking
```javascript
function AdminPanel() {
  const { hasPermission } = useUser();
  
  if (!hasPermission('admin.users.manage')) {
    return <AccessDenied />;
  }
  
  return <UserManagement />;
}
```

## Error Handling

### Development Mode
- Detailed error messages with stack traces
- Console logging for debugging
- Error boundary with technical details

### Production Mode
- User-friendly error messages
- Graceful fallbacks
- Minimal technical details exposed

## Configuration

### Environment Variables
```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

### Google OAuth Setup
1. Configure Google OAuth in Google Cloud Console
2. Add authorized redirect URIs
3. Set client ID in environment variables

## Testing

### Manual Testing Checklist
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Google OAuth login
- [ ] User registration
- [ ] Role-based routing
- [ ] Token refresh
- [ ] Logout functionality
- [ ] Error handling scenarios

### Error Scenarios to Test
- [ ] Network connectivity issues
- [ ] Backend server down
- [ ] Invalid JWT tokens
- [ ] Missing user roles
- [ ] Database connection failures

## Troubleshooting

### Common Issues

1. **"getProfile is not defined" Error**
   - Solution: Ensure proper imports in components

2. **"Not found" Error on Login**
   - Solution: Check if UserDetails record exists for user

3. **Registration Failures**
   - Solution: Check backend logs and database state

4. **Role Detection Issues**
   - Solution: Check JWT token structure and backend role setup

### Debug Mode
Enable debug logging by checking browser console for detailed information about:
- JWT token structure
- API request/response details
- Role detection process
- Error stack traces

## Performance Considerations

- Token refresh happens automatically in background
- User context is cached to prevent unnecessary API calls
- Error boundaries prevent entire app crashes
- Loading states provide smooth user experience

## Security Features

- Secure token storage in localStorage
- Automatic token refresh
- CSRF protection with credentials: include
- Input validation and sanitization
- XSS protection in error messages

## Future Enhancements

- [ ] Offline support with service workers
- [ ] Real-time notifications
- [ ] Advanced caching strategies
- [ ] Performance monitoring
- [ ] A/B testing framework
