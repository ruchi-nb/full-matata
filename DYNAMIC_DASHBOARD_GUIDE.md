# Dynamic Dashboard Template System

## Overview

This dynamic dashboard template system automatically generates custom user interfaces based on the permissions assigned to hospital users. When a user logs in, they are redirected to a personalized dashboard that only shows the modules and features they have access to.

## Features

### 🎯 **Permission-Based Module Generation**
- Automatically shows/hides modules based on user permissions
- Three main modules: Patient Management, Doctor Management, Reports & Analytics
- Each module adapts its functionality based on specific permissions

### 🔐 **Granular Permission Control**
- **Patient Management**: create, update, delete, view
- **Doctor Management**: create, update, delete, view  
- **Reports & Analytics**: view

### 🎨 **Dynamic UI Components**
- Responsive sidebar that shows only available modules
- Permission-based action buttons (create, edit, delete)
- Real-time permission status indicators
- Adaptive navigation based on user access level

### 📊 **Smart Analytics**
- Permission-aware data fetching
- Module-specific statistics
- Real-time permission summaries

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dynamic Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │   Header        │  │        Main Content             │   │
│  │ - User Info     │  │  ┌─────────────────────────────┐ │   │
│  │ - Module Count  │  │  │    Active Module           │ │   │
│  │ - Access Level  │  │  │  (Patient/Doctor/Reports)  │ │   │
│  └─────────────────┘  │  └─────────────────────────────┘ │   │
│  ┌─────────────────┐  └─────────────────────────────────┘   │
│  │   Sidebar       │                                        │
│  │ - Available     │                                        │
│  │   Modules       │                                        │
│  │ - Permission    │                                        │
│  │   Summary       │                                        │
│  │ - Quick Actions │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Permission Categories

### 1. Patient Management Module
```javascript
permissions: ['patient.create', 'patient.update', 'patient.delete', 'patient.view']
```

**Features:**
- Patient list with search and filtering
- Create new patients (if `patient.create` permission)
- Edit patient information (if `patient.update` permission)
- Delete patients (if `patient.delete` permission)
- View patient details (if `patient.view` permission)

### 2. Doctor Management Module
```javascript
permissions: ['doctor.create', 'doctor.update', 'doctor.delete', 'doctor.view']
```

**Features:**
- Doctor list with specialty filtering
- Create new doctors (if `doctor.create` permission)
- Edit doctor profiles (if `doctor.update` permission)
- Delete doctors (if `doctor.delete` permission)
- View doctor details (if `doctor.view` permission)
- Specialty and experience tracking

### 3. Reports & Analytics Module
```javascript
permissions: ['reports.view']
```

**Features:**
- Analytics dashboard with key metrics
- Report generation and download
- Period-based filtering (7d, 30d, 90d, 1y)
- Revenue and performance tracking

## Implementation Guide

### 1. Frontend Setup

#### Install Dependencies
```bash
npm install lucide-react
```

#### Add to Main App
```javascript
// In your main app routing
import CustomUserDashboard from '@/app/custom-dashboard/page';

// Add route
<Route path="/custom-dashboard" component={CustomUserDashboard} />
```

#### Update User Context
```javascript
// Ensure your UserContext provides:
- user: user object with permissions
- isAuthenticated: boolean
- isLoading: boolean
```

### 2. Backend Setup

#### Add Router to Main App
```python
# In main.py
from routes.dynamic_dashboard_router import router as dynamic_dashboard_router

app.include_router(dynamic_dashboard_router)
```

#### Database Permissions
Ensure these permissions exist in your `permission_master` table:
```sql
INSERT INTO permission_master (permission_name, description) VALUES
('patient.create', 'Create new patients'),
('patient.update', 'Update patient information'),
('patient.delete', 'Delete patients'),
('patient.view', 'View patient information'),
('doctor.create', 'Create new doctors'),
('doctor.update', 'Update doctor information'),
('doctor.delete', 'Delete doctors'),
('doctor.view', 'View doctor information'),
('reports.view', 'View reports and analytics');
```

### 3. Permission Assignment

#### For Custom Roles
```python
# When creating custom roles, assign permissions
permissions_to_assign = ['patient.view', 'doctor.view', 'reports.view']
await assign_permissions_to_hospital_role(db, hospital_id, role_id, permissions_to_assign)
```

#### Example Role Configurations

**Nurse Role:**
```javascript
permissions: ['patient.view', 'patient.update', 'doctor.view']
```

**Receptionist Role:**
```javascript
permissions: ['patient.create', 'patient.view', 'doctor.view']
```

**Lab Technician Role:**
```javascript
permissions: ['patient.view', 'reports.view']
```

**Manager Role:**
```javascript
permissions: ['patient.create', 'patient.update', 'patient.delete', 'patient.view',
              'doctor.create', 'doctor.update', 'doctor.delete', 'doctor.view',
              'reports.view']
```

## Usage Examples

### 1. Basic Implementation
```javascript
// User logs in and gets redirected to custom dashboard
// Dashboard automatically shows only modules they have access to

// Example: User with only patient.view permission
// - Shows Patient Management module
// - Hides Doctor Management and Reports modules
// - Only shows "View" actions in patient list
```

### 2. Custom Role Creation
```javascript
// Hospital admin creates a custom role
const customRole = {
  role_name: "nurse",
  description: "Nursing staff role",
  permissions: ["patient.view", "patient.update", "doctor.view"]
};

// User assigned to this role will see:
// - Patient Management module (view + update actions)
// - Doctor Management module (view only)
// - Reports module hidden
```

### 3. Permission Updates
```javascript
// Admin updates role permissions
// Dashboard automatically refreshes to show/hide features
// No code changes needed - fully dynamic
```

## API Endpoints

### Authentication & Permissions
- `GET /api/hospital/permissions` - Get user permissions
- `GET /api/auth/permissions` - Alternative permission endpoint

### Patient Management
- `GET /api/hospital/patients` - List patients
- `POST /api/hospital/patients` - Create patient
- `PUT /api/hospital/patients/{id}` - Update patient
- `DELETE /api/hospital/patients/{id}` - Delete patient

### Doctor Management
- `GET /api/hospital/doctors` - List doctors
- `POST /api/hospital/doctors` - Create doctor
- `PUT /api/hospital/doctors/{id}` - Update doctor
- `DELETE /api/hospital/doctors/{id}` - Delete doctor

### Reports & Analytics
- `GET /api/hospital/reports` - List reports
- `GET /api/hospital/analytics` - Get analytics data

## Security Features

### 1. Permission Validation
- Every API endpoint checks user permissions
- Frontend hides unauthorized actions
- Backend enforces permission checks

### 2. Hospital Isolation
- Users only see data from their assigned hospital
- Cross-hospital access prevented
- Role permissions scoped to hospital

### 3. JWT Authentication
- All requests require valid JWT token
- Automatic token refresh handling
- Secure permission caching

## Customization Options

### 1. Adding New Modules
```javascript
// Add new permission category
const permissionCategories = {
  // ... existing categories
  inventory: {
    name: 'Inventory Management',
    icon: '📦',
    color: 'orange',
    permissions: ['inventory.create', 'inventory.update', 'inventory.delete', 'inventory.view']
  }
};
```

### 2. Customizing UI
```javascript
// Modify module appearance
const getModuleColor = (moduleKey) => {
  const colors = {
    patient: 'blue',
    doctor: 'green', 
    reports: 'purple',
    inventory: 'orange' // New module color
  };
  return colors[moduleKey] || 'gray';
};
```

### 3. Adding New Permissions
```sql
-- Add new permission to database
INSERT INTO permission_master (permission_name, description) VALUES
('inventory.create', 'Create inventory items'),
('inventory.update', 'Update inventory items'),
('inventory.delete', 'Delete inventory items'),
('inventory.view', 'View inventory items');
```

## Testing

### 1. Permission Testing
```javascript
// Test different permission combinations
const testCases = [
  { permissions: ['patient.view'], expectedModules: ['patient'] },
  { permissions: ['patient.view', 'doctor.view'], expectedModules: ['patient', 'doctor'] },
  { permissions: ['reports.view'], expectedModules: ['reports'] },
  { permissions: [], expectedModules: [] }
];
```

### 2. UI Testing
```javascript
// Test module visibility
expect(screen.getByText('Patient Management')).toBeInTheDocument();
expect(screen.queryByText('Doctor Management')).not.toBeInTheDocument();
```

## Deployment

### 1. Environment Variables
```bash
# Add to .env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_DASHBOARD_ENABLED=true
```

### 2. Build Configuration
```javascript
// In next.config.js
module.exports = {
  env: {
    CUSTOM_DASHBOARD_ENABLED: process.env.REACT_APP_DASHBOARD_ENABLED === 'true'
  }
};
```

## Troubleshooting

### Common Issues

1. **Module Not Showing**
   - Check if user has required permissions
   - Verify permission names match exactly
   - Check browser console for errors

2. **API Permission Errors**
   - Ensure JWT token is valid
   - Check user hospital association
   - Verify permission assignment in database

3. **UI Not Updating**
   - Clear browser cache
   - Check React state updates
   - Verify permission context updates

### Debug Commands
```sql
-- Check user permissions
SELECT p.permission_name 
FROM permission_master p
JOIN hospital_role_permission hrp ON p.permission_id = hrp.permission_id
JOIN hospital_user_roles hur ON hrp.hospital_role_id = hur.hospital_role_id
WHERE hur.user_id = ? AND hur.hospital_id = ?;
```

## Future Enhancements

### 1. Advanced Features
- Real-time permission updates
- Module-specific themes
- Custom dashboard layouts
- Permission inheritance

### 2. Analytics
- Permission usage tracking
- Module access analytics
- User behavior insights

### 3. Integration
- SSO integration
- External permission providers
- Multi-tenant support

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Contact system administrator
4. Submit issue with detailed logs

---

This dynamic dashboard system provides a flexible, secure, and user-friendly way to manage hospital operations with granular permission control. The template automatically adapts to each user's role and permissions, ensuring they only see and can access the features they're authorized to use.
