// components/PermissionWrapper.js
import { usePermissions } from '../context/PermissionsContext';

// Basic permission wrapper
export const PermissionWrapper = ({ 
  permission, 
  permissions = [], 
  any = false, 
  all = false,
  fallback = null,
  children 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) return fallback;

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (any && permissions.length) {
    hasAccess = hasAnyPermission(permissions);
  } else if (all && permissions.length) {
    hasAccess = hasAllPermissions(permissions);
  } else if (permissions.length) {
    hasAccess = hasAnyPermission(permissions);
  }

  return hasAccess ? children : fallback;
};

// Hospital role wrapper
export const HospitalRoleWrapper = ({ 
  role, 
  roles = [], 
  hospitalId = null, 
  fallback = null, 
  children 
}) => {
  const { hasRole, currentHospital, isLoading } = usePermissions();

  if (isLoading) return fallback;

  const targetHospitalId = hospitalId || currentHospital?.hospital_id;
  const hasRoleAccess = role ? hasRole(role, targetHospitalId) : 
    roles.some(r => hasRole(r, targetHospitalId));

  return hasRoleAccess ? children : fallback;
};

// Hospital admin wrapper (common pattern)
export const HospitalAdminWrapper = ({ hospitalId, fallback = null, children }) => {
  return (
    <HospitalRoleWrapper 
      role="hospital_admin" 
      hospitalId={hospitalId} 
      fallback={fallback}
    >
      {children}
    </HospitalRoleWrapper>
  );
};