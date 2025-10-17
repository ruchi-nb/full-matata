'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/data/UserContext';
import DynamicDashboard from '@/components/DynamicDashboard/DynamicDashboard';
import LoadingSpinner from '@/components/DynamicDashboard/LoadingSpinner';

const CustomUserDashboard = () => {
  const { user, isAuthenticated, isLoading } = useUser();
  const router = useRouter();

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  // Show loading while user data is being fetched
  if (!user) {
    return <LoadingSpinner message="Loading user data..." />;
  }

  // Render the dynamic dashboard
  return <DynamicDashboard />;
};

export default CustomUserDashboard;
