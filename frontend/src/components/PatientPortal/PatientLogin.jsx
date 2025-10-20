"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import InvertedGradientButton from '@/components/common/InvertedGradientButton';

const PatientLogin = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: 'admin@hospital.com', // Demo credentials
    password: 'admin123'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      // Verify token is still valid
      fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (response.ok) {
          setIsAuthenticated(true);
          // Redirect to patient portal
          router.push('/patientportal');
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('token_expires_in');
        }
      })
      .catch(() => {
        // Network error, clear tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expires_in');
      });
    }
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Store tokens in localStorage
        localStorage.setItem('access_token', result.access_token);
        localStorage.setItem('refresh_token', result.refresh_token);
        localStorage.setItem('token_expires_in', result.expires_in);
        
        setMessage('✅ Login successful! Redirecting...');
        
        // Redirect to patient portal after short delay
        setTimeout(() => {
          router.push('/patientportal');
        }, 1500);
        
      } else {
        setMessage(`❌ Login failed: ${result.detail || 'Invalid credentials'}`);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setMessage(`❌ Network error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to patient portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center mb-6">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">🏥 Patient Portal</h1>
          <p className="text-blue-100 text-lg">AI-Powered Medical Consultation Platform</p>
        </div>

        {/* Demo Credentials */}
        <div className="bg-blue-500 bg-opacity-20 backdrop-blur-sm rounded-lg p-4 border border-blue-300">
          <h4 className="text-blue-100 font-medium mb-2">Demo Credentials:</h4>
          <div className="text-blue-100 text-sm space-y-1">
            <p><strong>Email:</strong> admin@hospital.com</p>
            <p><strong>Password:</strong> admin123</p>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <InvertedGradientButton
                type="submit"
                color="blue"
                className="w-full cursor-pointer"
                disabled={isLoading}
              >
                <ArrowRight className="w-5 h-5" />
                <span>
                  {isLoading ? 'Logging in...' : '🚀 Login & Start Consultation'}
                </span>
              </InvertedGradientButton>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-200' : 
                message.includes('❌') ? 'bg-red-100 text-red-800 border border-red-200' : 
                'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {message}
              </div>
            )}
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <a href="/auth/register" className="text-blue-600 hover:text-blue-500 font-medium">
                Register here
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-blue-200 text-sm">
            Secure • HIPAA Compliant • AI-Powered Healthcare
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientLogin;
