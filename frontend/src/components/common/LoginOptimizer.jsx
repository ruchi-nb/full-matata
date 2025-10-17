// Quick fix for slow login loading
// This provides immediate feedback and reduces perceived loading time

import React, { useState } from 'react';

const LoginOptimizer = ({ children, onLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginProgress, setLoginProgress] = useState(0);

  const handleOptimizedLogin = async (credentials) => {
    setIsLoggingIn(true);
    setLoginProgress(10);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setLoginProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Call the actual login function
      const result = await onLogin(credentials);
      
      clearInterval(progressInterval);
      setLoginProgress(100);
      
      // Small delay to show completion
      setTimeout(() => {
        setIsLoggingIn(false);
        setLoginProgress(0);
      }, 300);

      return result;
    } catch (error) {
      setIsLoggingIn(false);
      setLoginProgress(0);
      throw error;
    }
  };

  return (
    <>
      {children}
      
      {/* Loading overlay */}
      {isLoggingIn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Logging in...</h3>
              <p className="text-gray-600 mb-4">Please wait while we authenticate you</p>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loginProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">{loginProgress}% complete</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginOptimizer;
