// Login Performance Diagnostic Tool
// This helps identify what's causing slow login times

import React, { useState, useEffect } from 'react';

const LoginDiagnostic = ({ onLogin }) => {
  const [diagnostics, setDiagnostics] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addDiagnostic = (message, timestamp = Date.now()) => {
    setDiagnostics(prev => [...prev, { message, timestamp, duration: prev.length > 0 ? timestamp - prev[prev.length - 1].timestamp : 0 }]);
  };

  const runDiagnostic = async (credentials) => {
    setIsRunning(true);
    setDiagnostics([]);
    
    const startTime = Date.now();
    addDiagnostic("🚀 Starting login diagnostic", startTime);

    try {
      // Step 1: Check network connectivity
      addDiagnostic("🌐 Checking network connectivity...");
      const networkStart = Date.now();
      try {
        await fetch('http://localhost:8000/api/v1/health', { 
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        });
        addDiagnostic(`✅ Network check completed in ${Date.now() - networkStart}ms`);
      } catch (error) {
        addDiagnostic(`❌ Network check failed: ${error.message}`);
      }

      // Step 2: Test login API
      addDiagnostic("🔐 Testing login API...");
      const loginStart = Date.now();
      
      const loginPromise = onLogin(credentials);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout after 10 seconds')), 10000)
      );
      
      const result = await Promise.race([loginPromise, timeoutPromise]);
      addDiagnostic(`✅ Login API completed in ${Date.now() - loginStart}ms`);

      // Step 3: Check token storage
      addDiagnostic("💾 Checking token storage...");
      const tokenStart = Date.now();
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      addDiagnostic(`✅ Token storage check completed in ${Date.now() - tokenStart}ms`);

      // Step 4: Test profile fetch
      addDiagnostic("👤 Testing profile fetch...");
      const profileStart = Date.now();
      try {
        const profileResponse = await fetch('http://localhost:8000/auth/profile', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          addDiagnostic(`✅ Profile fetch completed in ${Date.now() - profileStart}ms`);
        } else {
          addDiagnostic(`❌ Profile fetch failed: ${profileResponse.status}`);
        }
      } catch (error) {
        addDiagnostic(`❌ Profile fetch error: ${error.message}`);
      }

      // Step 5: Test permissions fetch
      addDiagnostic("🔑 Testing permissions fetch...");
      const permissionsStart = Date.now();
      try {
        const permissionsResponse = await fetch('http://localhost:8000/api/hospital/permissions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (permissionsResponse.ok) {
          const permissions = await permissionsResponse.json();
          addDiagnostic(`✅ Permissions fetch completed in ${Date.now() - permissionsStart}ms`);
        } else {
          addDiagnostic(`❌ Permissions fetch failed: ${permissionsResponse.status}`);
        }
      } catch (error) {
        addDiagnostic(`❌ Permissions fetch error: ${error.message}`);
      }

      const totalTime = Date.now() - startTime;
      addDiagnostic(`🎉 Total diagnostic completed in ${totalTime}ms`);

      return result;

    } catch (error) {
      addDiagnostic(`❌ Diagnostic failed: ${error.message}`);
      throw error;
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Performance Diagnostic</h3>
      
      <div className="space-y-4">
        <button
          onClick={() => runDiagnostic({ email: 'test@example.com', password: 'test123' })}
          disabled={isRunning}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Running Diagnostic...' : 'Run Performance Test'}
        </button>

        {diagnostics.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Diagnostic Results:</h4>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {diagnostics.map((diagnostic, index) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-600">
                    {diagnostic.duration > 0 && `+${diagnostic.duration}ms `}
                  </span>
                  <span className={diagnostic.message.includes('❌') ? 'text-red-600' : 'text-gray-900'}>
                    {diagnostic.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <h4 className="font-medium mb-2">Common Issues & Solutions:</h4>
          <ul className="space-y-1">
            <li>• <strong>Network timeout:</strong> Check if backend server is running</li>
            <li>• <strong>Login API slow:</strong> Check database connection and query performance</li>
            <li>• <strong>Profile fetch slow:</strong> Consider caching user data in JWT</li>
            <li>• <strong>Permissions fetch slow:</strong> Use parallel requests or cache permissions</li>
            <li>• <strong>Token storage slow:</strong> Check localStorage performance</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginDiagnostic;
