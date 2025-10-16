// components/ProtectedRoute.js
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { usePermissions } from '../context/PermissionsContext';

const ProtectedRoute = ({ 
  children, 
  requiredPermission, 
  requiredPermissions = [],
  requiredRole,
  redirectTo = '/unauthorized'
}) => {
  const { hasPermission, hasAnyPermission, isRole, isLoading } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    let hasAccess = true;

    if (requiredPermission) {
      hasAccess = hasPermission(requiredPermission);
    } else if (requiredPermissions.length) {
      hasAccess = hasAnyPermission(requiredPermissions);
    } else if (requiredRole) {
      hasAccess = isRole(requiredRole);
    }

    if (!hasAccess) {
      router.replace(redirectTo);
    }
  }, [isLoading, requiredPermission, requiredPermissions, requiredRole, redirectTo]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return children;
};

export default ProtectedRoute;