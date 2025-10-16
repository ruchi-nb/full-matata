"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/data/UserContext';
import { useHospitalId } from '@/hooks/useHospitalId';
import { LifeLine } from 'react-loading-indicators';

const HospitalProtectedRoute = ({ children }) => {
  const { user, loading } = useUser();
  const { hasHospitalAccess } = useHospitalId();
  const router = useRouter();

  useEffect(() => {
    // Only redirect after loading is complete
    if (!loading) {
      if (!user) {
        router.push('/landing');
      } else if (!hasHospitalAccess) {
        router.push('/landing');
      }
    }
  }, [loading, user, hasHospitalAccess, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#e6eef8]">
        <div className="text-center">
          <LifeLine color="#3b82f6" size="large" text="Loading..." textColor="#6b7280" />
        </div>
      </div>
    );
  }

  // Show error messages while redirecting
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#e6eef8]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">Authentication Required</h2>
          <p className="text-red-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!hasHospitalAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#e6eef8]">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Access Denied</h2>
          <p className="text-yellow-600 mb-4">You don't have hospital administrator privileges.</p>
          <p className="text-sm text-yellow-500">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and has hospital access
  return children;
};

export default HospitalProtectedRoute;
