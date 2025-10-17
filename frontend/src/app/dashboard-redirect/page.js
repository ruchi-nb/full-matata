'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/data/UserContext';

const DynamicDashboardRedirect = () => {
  const { user, isAuthenticated, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Check if user has custom role (not standard roles)
        const userRole = user?.global_role?.role_name;
        const isCustomRole = userRole && !['superadmin', 'hospital_admin', 'doctor', 'patient'].includes(userRole);
        
        if (isCustomRole) {
          // Redirect to custom dashboard for custom roles
          router.push('/custom-dashboard');
        } else {
          // Redirect to standard dashboard for standard roles
          router.push('/Hospital');
        }
      } else {
        // Redirect to login if not authenticated
        router.push('/login');
      }
    }
  }, [isAuthenticated, user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Determining your dashboard access...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default DynamicDashboardRedirect;
