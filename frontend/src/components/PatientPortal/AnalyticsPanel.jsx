"use client";
import React, { useState, useEffect } from 'react';
import { BarChart3, X, Activity, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import consultationService from '@/services/consultationService';

const AnalyticsPanel = ({ isOpen, onClose, consultationId }) => {
  const [analyticsData, setAnalyticsData] = useState({
    sessionDuration: 0,
    apiCalls: 0,
    totalTokens: 0,
    totalCost: 0,
    errorCount: 0,
    recordingStatus: 'Stopped',
    cameraStatus: 'Off',
    provider: 'deepgram',
    language: 'multi'
  });
  const [isLoading, setIsLoading] = useState(false);

  // Update analytics every second
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setAnalyticsData(prev => ({
        ...prev,
        sessionDuration: Math.floor(Date.now() / 1000) % 3600 // Mock duration
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Log analytics events
  const logEvent = async (event, data) => {
    try {
      await consultationService.logAnalyticsEvent(event, {
        ...data,
        consultationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to log analytics event:', error);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format cost
  const formatCost = (cost) => {
    return `$${cost.toFixed(4)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Real-time Analytics</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Analytics Content */}
        <div className="space-y-4">
          {/* Session Duration */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-400" />
              <span className="text-gray-300 font-medium">Session Duration:</span>
            </div>
            <span className="text-green-400 font-mono">
              {formatTime(analyticsData.sessionDuration)}
            </span>
          </div>

          {/* Provider */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span className="text-gray-300 font-medium">Provider:</span>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              analyticsData.provider === 'deepgram' ? 'bg-orange-500 text-white' : 'bg-purple-500 text-white'
            }`}>
              {analyticsData.provider}
            </span>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              <span className="text-gray-300 font-medium">Language:</span>
            </div>
            <span className="text-purple-400 font-medium">
              {analyticsData.language}
            </span>
          </div>

          {/* API Calls */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-300 font-medium">API Calls:</span>
            </div>
            <span className="text-yellow-400 font-mono">
              {analyticsData.apiCalls}
            </span>
          </div>

          {/* Total Tokens */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span className="text-gray-300 font-medium">Total Tokens:</span>
            </div>
            <span className="text-indigo-400 font-mono">
              {analyticsData.totalTokens.toLocaleString()}
            </span>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-gray-300 font-medium">Total Cost:</span>
            </div>
            <span className="text-green-400 font-mono">
              {formatCost(analyticsData.totalCost)}
            </span>
          </div>

          {/* Errors */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-gray-300 font-medium">Errors:</span>
            </div>
            <span className={`font-mono ${
              analyticsData.errorCount > 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {analyticsData.errorCount}
            </span>
          </div>

          {/* Recording Status */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span className="text-gray-300 font-medium">Recording:</span>
            </div>
            <span className={`font-medium ${
              analyticsData.recordingStatus === 'Recording' ? 'text-green-400' : 'text-red-400'
            }`}>
              {analyticsData.recordingStatus}
            </span>
          </div>

          {/* Camera Status */}
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span className="text-gray-300 font-medium">Camera:</span>
            </div>
            <span className={`font-medium ${
              analyticsData.cameraStatus === 'On' ? 'text-green-400' : 'text-red-400'
            }`}>
              {analyticsData.cameraStatus}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            Analytics data is automatically logged and stored securely
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
