"use client";

import React from 'react';
import { useUser } from '@/data/UserContext';
import { useHospitalId } from '@/hooks/useHospitalId';

const HospitalAccessDebug = () => {
  const { user, loading, error } = useUser();
  const { hospitalId, hasHospitalAccess } = useHospitalId();

  if (loading) {
    return <div className="p-4 bg-yellow-100 rounded">Loading user data...</div>;
  }

  return (
    <div className="p-6 bg-gray-100 rounded-lg space-y-4">
      <h2 className="text-xl font-bold">Hospital Access Debug</h2>
      
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-300 rounded">
          <h3 className="font-semibold text-red-800">Error:</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {/* User Data */}
      <div className="p-4 bg-blue-100 border border-blue-300 rounded">
        <h3 className="font-semibold text-blue-800">User Data:</h3>
        <pre className="text-sm text-blue-700 mt-2 overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      
      {/* Hospital Access */}
      <div className="p-4 bg-green-100 border border-green-300 rounded">
        <h3 className="font-semibold text-green-800">Hospital Access:</h3>
        <div className="text-sm text-green-700 mt-2 space-y-1">
          <p><strong>Has Hospital Access:</strong> {hasHospitalAccess ? '✅ Yes' : '❌ No'}</p>
          <p><strong>Hospital ID:</strong> {hospitalId || 'None'}</p>
          <p><strong>User Hospital ID:</strong> {user?.hospital_id || 'None'}</p>
          <p><strong>Hospital Roles:</strong> {user?.hospital_roles ? JSON.stringify(user.hospital_roles) : 'None'}</p>
        </div>
      </div>
      
      {/* Role Information */}
      <div className="p-4 bg-purple-100 border border-purple-300 rounded">
        <h3 className="font-semibold text-purple-800">Role Information:</h3>
        <div className="text-sm text-purple-700 mt-2 space-y-1">
          <p><strong>Global Role:</strong> {user?.global_role?.role_name || 'None'}</p>
          <p><strong>Role Name:</strong> {user?.role_name || 'None'}</p>
          <p><strong>Role:</strong> {user?.role || 'None'}</p>
          <p><strong>Detected Role:</strong> {user?._detectedRole || 'None'}</p>
        </div>
      </div>
      
      {/* Recommendations */}
      <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
        <h3 className="font-semibold text-yellow-800">Recommendations:</h3>
        <div className="text-sm text-yellow-700 mt-2">
          {!user ? (
            <p>❌ <strong>No user data:</strong> User is not logged in. Please log in first.</p>
          ) : !hasHospitalAccess ? (
            <div>
              <p>❌ <strong>No hospital access:</strong> User doesn't have hospital admin privileges.</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check if user has <code>hospital_id</code> field</li>
                <li>Check if user has <code>hospital_roles</code> array with valid hospital_id</li>
                <li>Verify user role is <code>hospital_admin</code> or has appropriate permissions</li>
              </ul>
            </div>
          ) : (
            <p>✅ <strong>Hospital access confirmed:</strong> User can add doctors.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HospitalAccessDebug;
