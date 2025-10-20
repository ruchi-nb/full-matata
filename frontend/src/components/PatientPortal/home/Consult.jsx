// File: components/PatientPortal/home/Consult.jsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doctors } from '@/data/doctors';
import { useRouter } from 'next/navigation';
import { useEnhancedConversation } from '@/hooks/enhancedUseConversation';
import { Phone, Mic, MicOff, VideoIcon, VideoOff, ArrowLeft } from 'lucide-react';
import consultationService from '@/services/consultationService';

const Consult = ({ doctor, onBack }) => {
  const router = useRouter();
  
  // Enhanced conversation hook
  const {
    connectionState,
    isRecording,
    isProcessing,
    sessionId,
    messages,
    interimTranscript,
    speakerLabels,
    volumeLevel,
    initializeEnhancedSession,
    startEnhancedAudioStreaming,
    stopAudioStreaming,
    updateSessionSettings,
    sendTextMessage: enhancedSendTextMessage,
    disconnect,
    clearConversation,
    error: conversationError
  } = useEnhancedConversation({
  consultationId: doctor?.id,
  enableAnalytics: true,
  defaultLanguage: 'en-IN',
  defaultProvider: 'deepgram',
  autoReconnect: true,
  onError: (error) => {
    console.error('Conversation error:', error);
    
    let errorMessage = 'Connection error';
    if (error.message.includes('WebSocket connection failed')) {
      errorMessage = 'Failed to connect to server. Please check your internet connection.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Connection timeout. Please try again.';
    } else if (error.message.includes('DOM Event')) {
      errorMessage = 'Network connection issue. Please check your connection.';
    } else {
      errorMessage = `Error: ${error.message}`;
    }
    
    updateStatus(errorMessage);
  },
  onConnectionStateChange: (state) => {
    console.log('Connection state changed:', state);
    if (state === 'connected') {
      updateStatus('Connected to server');
    } else if (state === 'connecting') {
      updateStatus('Connecting to server...');
    }
  }
});

  // Local state for UI controls
  const [callStatus, setCallStatus] = useState('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [selectedProvider, setSelectedProvider] = useState('deepgram');
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);
  const [consultationId, setConsultationId] = useState(null);
  const [isCreatingConsultation, setIsCreatingConsultation] = useState(false);

  // Refs
  const callTimerRef = useRef(null);
  const videoRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const streamRef = useRef(null);
  const audioTrackRef = useRef(null);
  const videoTrackRef = useRef(null);

  // Volume indicator component
  const VolumeIndicator = () => (
    <div className="flex items-center gap-2">
      <div className="text-xs text-gray-300">Mic Level:</div>
      <div className="w-20 h-2 bg-gray-600 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 transition-all duration-100"
          style={{ width: `${Math.min(volumeLevel * 100, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-8">
        {Math.round(volumeLevel * 100)}%
      </span>
    </div>
  );

  // Connection status indicator
  const ConnectionStatus = () => {
    const getStatusColor = () => {
      switch (connectionState) {
        case 'connected': return 'bg-green-500';
        case 'connecting': return 'bg-yellow-500';
        case 'disconnected': return 'bg-red-500';
        default: return 'bg-gray-500';
      }
    };

    const getStatusText = () => {
      switch (connectionState) {
        case 'connected': return 'Connected';
        case 'connecting': return 'Connecting...';
        case 'disconnected': return 'Disconnected';
        default: return connectionState;
      }
    };

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-gray-300">{getStatusText()}</span>
        {conversationError && (
          <span className="text-red-400 text-xs">({conversationError.message})</span>
        )}
      </div>
    );
  };

  // Initialize camera and microphone
  const initializeCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      streamRef.current = stream;
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      if (audioTracks.length > 0) {
        audioTrackRef.current = audioTracks[0];
      }
      
      if (videoTracks.length > 0) {
        videoTrackRef.current = videoTracks[0];
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      console.log('Camera initialized - Audio tracks:', audioTracks.length, 'Video tracks:', videoTracks.length);
      updateStatus('Camera and microphone ready');
      return true;
    } catch (err) {
      console.error('Camera initialization error:', err);
      
      // Handle DOM Event objects properly
      let errorMessage = 'Camera/mic access denied - using audio only';
      if (err instanceof Error) {
        errorMessage = `Camera error: ${err.message}`;
      } else if (err.name) { // DOMException
        errorMessage = `Camera error: ${err.name} - ${err.message}`;
      } else if (err.type) { // DOM Event
        errorMessage = `Camera error: ${err.type}`;
      }
      
      updateStatus(errorMessage);
      return false;
    }
  };

  // Create consultation automatically in background
  const createConsultation = async () => {
    if (!doctor?.id) {
      updateStatus('Error: Doctor information not available');
      return null;
    }

    try {
      setIsCreatingConsultation(true);
      updateStatus('Creating consultation session...');
      
      const result = await consultationService.createConsultation(doctor.id);
      
      if (result?.consultation_id) {
        setConsultationId(result.consultation_id);
        updateStatus(`Consultation created successfully (ID: ${result.consultation_id})`);
        return result.consultation_id;
      } else {
        throw new Error('Failed to create consultation');
      }
    } catch (error) {
      console.error('Consultation creation failed:', error);
      updateStatus(`Failed to create consultation: ${error.message}`);
      return null;
    } finally {
      setIsCreatingConsultation(false);
    }
  };

  // Check backend connection
  const checkBackendConnection = async () => {
    try {
      updateStatus('Checking server connection...');
      const isHealthy = await consultationService.healthCheck();
      if (!isHealthy) {
        throw new Error('Server is not responding');
      }
      return true;
    } catch (error) {
      updateStatus('Server is unavailable. Please try again later.');
      throw error;
    }
  };

  // Initialize call with consultation creation
  const initializeCall = async () => {
    updateStatus('Initializing call...');
    
    try {
      // Check backend first
      await checkBackendConnection();
      
      // Create consultation automatically in background
      const consultationId = await createConsultation();
      if (!consultationId) {
        throw new Error('Failed to create consultation');
      }
      
      // Initialize camera
      const cameraSuccess = await initializeCamera();
      
      // Initialize enhanced session with consultation ID
      try {
        await initializeEnhancedSession({
          language: selectedLanguage,
          provider: selectedProvider,
          sessionType: 'speech',
          consultationId: consultationId
        });
        setIsSessionInitialized(true);
        updateStatus('Session initialized - Ready to start');
      } catch (error) {
        console.error('Failed to initialize session:', error);
        updateStatus('Session initialization failed');
      }

      // Start call timer after a brief delay
      setTimeout(() => {
        setCallStatus('connected');
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        
        updateStatus('Call connected - Ready to start streaming');
        
        // Auto-start streaming when call connects
        if (isMicOn) {
          startEnhancedStreaming();
        }
      }, 2000);
    } catch (error) {
      console.error('Call initialization failed:', error);
      updateStatus('Failed to initialize call. Please check your connection.');
    }
  };

  const updateStatus = useCallback((message) => {
    console.log('Status update:', message);
    setStatus(message);
  }, []);

  // Toggle camera - FIXED
  const toggleCamera = () => {
    console.log('Toggling camera, current state:', isCameraOn);
    
    if (videoTrackRef.current) {
      const newState = !videoTrackRef.current.enabled;
      videoTrackRef.current.enabled = newState;
      setIsCameraOn(newState);
      
      console.log('Camera toggled to:', newState);
      updateStatus(`Camera ${newState ? 'enabled' : 'disabled'}`);
      
      // Update video element visibility
      if (videoRef.current) {
        videoRef.current.style.opacity = newState ? '1' : '0.3';
        videoRef.current.style.filter = newState ? 'none' : 'grayscale(100%)';
      }
    } else {
      console.error('No video track found');
      updateStatus('Error: No camera available');
    }
  };

  // Toggle microphone - FIXED
  const toggleMic = () => {
    console.log('Toggling microphone, current state:', isMicOn);
    
    if (audioTrackRef.current) {
      const newState = !audioTrackRef.current.enabled;
      audioTrackRef.current.enabled = newState;
      setIsMicOn(newState);
      
      console.log('Microphone toggled to:', newState);
      updateStatus(`Microphone ${newState ? 'enabled' : 'disabled'}`);
      
      // If we're recording and disabling mic, stop recording
      if (isRecording && !newState) {
        console.log('Stopping audio streaming due to mic disable');
        stopAudioStreaming();
      }
      
      // If enabling mic and not recording, start streaming
      if (newState && !isRecording && isSessionInitialized) {
        console.log('Starting audio streaming due to mic enable');
        startEnhancedStreaming();
      }
    } else {
      console.error('No audio track found');
      updateStatus('Error: No microphone available');
    }
  };

  // Enhanced streaming with better error handling
  const startEnhancedStreaming = async () => {
    if (isRecording) {
      console.log('Already recording, stopping first...');
      await stopAudioStreaming();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!isMicOn) {
      updateStatus('Please enable microphone first');
      return;
    }

    try {
      updateStatus('🎤 Starting enhanced streaming session...');
      
      // Ensure session is initialized
      if (!isSessionInitialized) {
        await initializeEnhancedSession({
          language: selectedLanguage,
          provider: selectedProvider,
          sessionType: 'speech',
          enableDiarization: selectedProvider === 'deepgram',
          enableVAD: true
        });
        setIsSessionInitialized(true);
      }

      // Update session settings
      await updateSessionSettings({
        language: selectedLanguage,
        provider: selectedProvider,
        enableDiarization: selectedProvider === 'deepgram',
        enableVAD: true
      });
      
      await startEnhancedAudioStreaming({
        language: selectedLanguage,
        provider: selectedProvider,
        audio: {
          sampleRate: 16000,
          silenceThreshold: 0.1,
          silenceDuration: 2000
        }
      });
      
      updateStatus('🎤 Enhanced session active - Speak naturally');
    } catch (error) {
      console.error('Failed to start enhanced streaming:', error);
      
      let errorMessage = 'Streaming error';
      if (error instanceof Error) {
        errorMessage = `❌ Streaming error: ${error.message}`;
      } else if (error && error.type) {
        errorMessage = `❌ Streaming error: ${error.type}`;
      } else {
        errorMessage = `❌ Streaming error: ${String(error)}`;
      }
      
      updateStatus(errorMessage);
    }
  };

  const stopStreaming = async () => {
    if (!isRecording) return;

    try {
      await stopAudioStreaming();
      updateStatus('Streaming stopped');
    } catch (error) {
      console.error('Error stopping streaming:', error);
      updateStatus('Error stopping stream');
    }
  };

  // Get language label for display
  const getLanguageLabel = () => {
    const languages = {
      'en-IN': 'English',
      'hi-IN': 'Hindi',
      'bn-IN': 'Bengali',
      'gu-IN': 'Gujarati',
      'kn-IN': 'Kannada',
      'ml-IN': 'Malayalam',
      'mr-IN': 'Marathi',
      'od-IN': 'Odia',
      'pa-IN': 'Punjabi',
      'ta-IN': 'Tamil',
      'te-IN': 'Telugu'
    };
    return languages[selectedLanguage] || 'English';
  };

  // Send text message using enhanced hook
  const sendTextMessage = async () => {
    const text = inputMessage.trim();
    if (!text) return;

    setInputMessage('');
    
    try {
      updateStatus('Sending message...');
      await enhancedSendTextMessage(text, {
        language: selectedLanguage,
        provider: selectedProvider
      });
      updateStatus('Message sent');
    } catch (error) {
      console.error('Error sending text message:', error);
      
      let errorMessage = 'Failed to send message';
      if (error instanceof Error) {
        errorMessage = `Send error: ${error.message}`;
      } else if (error && error.type) {
        errorMessage = `Send error: ${error.type}`;
      }
      
      updateStatus(errorMessage);
    }
  };

  // End call and cleanup
  const endCall = useCallback(async () => {
    setCallStatus('ended');
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    // Stop all services
    stopStreaming();
    stopCamera();
    disconnect();
    
    // End consultation in backend
    if (consultationId) {
      try {
        await consultationService.endConsultation(consultationId);
        console.log('Consultation ended successfully');
      } catch (error) {
        console.error('Failed to end consultation:', error);
      }
    }
    
    updateStatus('Call ended');
  }, [disconnect, consultationId]);

  // Start new session
  const startNewSession = async () => {
    setCallStatus('connected');
    setCallDuration(0);
    clearConversation();
    setIsSessionInitialized(false);
    setConsultationId(null);
    
    try {
      // Create new consultation
      const newConsultationId = await createConsultation();
      if (!newConsultationId) {
        throw new Error('Failed to create new consultation');
      }
      
      await initializeCamera();
      updateStatus('New session started');
      
      // Initialize enhanced session with new consultation ID
      await initializeEnhancedSession({
        language: selectedLanguage,
        provider: selectedProvider,
        sessionType: 'speech',
        consultationId: newConsultationId
      });
      setIsSessionInitialized(true);
      
    } catch (error) {
      console.error('Failed to start new session:', error);
      updateStatus('Failed to start new session');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    audioTrackRef.current = null;
    videoTrackRef.current = null;
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Scroll chat to bottom
  const scrollChatToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, []);

  // Initialize call when component mounts
  useEffect(() => {
    const initializeCall = async () => {
      updateStatus('Initializing call...');
      
      // Initialize camera
      const cameraSuccess = await initializeCamera();
      
      // Initialize enhanced session
      try {
        await initializeEnhancedSession({
          language: selectedLanguage,
          provider: selectedProvider,
          sessionType: 'speech'
        });
        setIsSessionInitialized(true);
        updateStatus('Session initialized - Ready to start');
      } catch (error) {
        console.error('Failed to initialize session:', error);
        updateStatus('Session initialization failed');
      }

      // Start call timer after a brief delay
      setTimeout(() => {
        setCallStatus('connected');
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        
        updateStatus('Call connected - Ready to start streaming');
        
        // Auto-start streaming when call connects
        if (isMicOn) {
          startEnhancedStreaming();
        }
      }, 2000);
    };

    initializeCall();

    return () => {
      // Cleanup on unmount
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      stopCamera();
      disconnect();
    };
  }, []);

  // Update session settings when language/provider changes
  useEffect(() => {
    if (isSessionInitialized && connectionState === 'connected') {
      updateSessionSettings({
        language: selectedLanguage,
        provider: selectedProvider,
        enableDiarization: selectedProvider === 'deepgram'
      });
    }
  }, [selectedLanguage, selectedProvider, connectionState, isSessionInitialized]);

  // Scroll chat when new messages arrive
  useEffect(() => {
    scrollChatToBottom();
  }, [messages, scrollChatToBottom]);

  // Handle conversation errors
  useEffect(() => {
    if (conversationError) {
      updateStatus(`Error: ${conversationError.message}`);
    }
  }, [conversationError]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Enhanced status bar */}
      {/* <div className="bg-gray-800 px-4 py-2 flex justify-between items-center text-xs border-b border-gray-700">
        <ConnectionStatus />
        <VolumeIndicator />
        <div className="text-gray-300 flex items-center gap-2">
          <span>Provider: {selectedProvider}</span>
          <span>•</span>
          <span>Language: {getLanguageLabel()}</span>
          {sessionId && (
            <>
              <span>•</span>
              <span title={sessionId}>Session: {sessionId.substring(0, 8)}...</span>
            </>
          )}
        </div>
      </div> */}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            title="Back to doctors list"
          >
            <ArrowLeft />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Consultation with {doctor?.name}</h1>
            <p className="text-sm text-gray-300">{doctor?.specialty}</p>
          </div>
        </div>
        
        {callStatus === 'connected' && (
          <div className="bg-green-900 text-green-300 py-1 px-3 rounded-full text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>{formatTime(callDuration)}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Video Area */}
        <div className="lg:w-2/3 bg-black relative flex flex-col">
          <div className="flex-1 relative bg-gray-900">
            {/* AI Doctor Video Placeholder */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
              <img 
                src={doctor?.image} 
                alt={doctor?.name}
                className="h-full object-cover opacity-80"
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
                Dr. {doctor?.name} • {doctor?.specialty}
              </div>
            </div>

            {/* User Video */}
            <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg border-2 border-white overflow-hidden shadow-lg">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
                style={{ 
                  opacity: isCameraOn ? 1 : 0.3,
                  filter: isCameraOn ? 'none' : 'grayscale(100%)'
                }}
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                You {isCameraOn ? '📹' : '❌'} {isMicOn ? '🎤' : '❌'}
              </div>
            </div>

            {/* Status Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className={`px-3 py-2 rounded-full text-sm font-medium backdrop-blur-sm ${
                callStatus === 'connected' ? 'bg-green-900 text-green-300' : 
                callStatus === 'connecting' ? 'bg-yellow-900 text-yellow-300' : 
                'bg-red-900 text-red-300'
              }`}>
                {callStatus === 'connected' ? 'Connected' : 
                 callStatus === 'connecting' ? 'Connecting...' : 'Call Ended'}
              </div>
              
              {isProcessing && (
                <div className="bg-blue-900 text-blue-300 px-3 py-2 rounded-full text-sm backdrop-blur-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-blue-300 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  Processing...
                </div>
              )}
            </div>

            {/* System Status */}
            <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm max-w-xs">
              {status}
              {isCreatingConsultation && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-300">Creating consultation...</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 bg-gray-800 border-t border-gray-700">
            <div className="flex flex-wrap gap-4 justify-center">
              <button 
                onClick={toggleMic}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-medium ${
                  isMicOn ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } text-white border-2 ${isMicOn ? 'border-green-400' : 'border-red-400'}`}
                title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                <span>{isMicOn ? 'Mic On' : 'Mic Off'}</span>
              </button>
              
              <button 
                onClick={toggleCamera}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-medium ${
                  isCameraOn ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } text-white border-2 ${isCameraOn ? 'border-green-400' : 'border-red-400'}`}
                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                <span>{isCameraOn ? 'Camera On' : 'Camera Off'}</span>
              </button>
              
              <button 
                onClick={endCall}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all font-medium border-2 border-red-400"
                title="End call"
              >
                <Phone size={20} className="transform rotate-135" />
                <span>End Call</span>
              </button>
            </div>

            {/* Live Transcript */}
            {interimTranscript && (
              <div className="mt-4 p-3 bg-blue-900 bg-opacity-50 rounded-lg border border-blue-700">
                <div className="text-blue-300 text-sm font-medium mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  Live Transcript:
                </div>
                <div className="text-white text-sm">{interimTranscript}</div>
              </div>
            )}

            {/* Speaker Labels */}
            {speakerLabels && (
              <div className="mt-2 p-3 border border-dashed border-gray-600 rounded-lg bg-gray-900">
                <div className="text-gray-300 text-sm font-medium mb-1">Speaker Identification:</div>
                <div className="text-white text-sm whitespace-pre-line">{speakerLabels}</div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Section */}
        <div className="lg:w-[30rem] flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col h-96 lg:h-auto">
          <div className="p-4 border-b border-gray-700 bg-gray-900">
            <h3 className="font-medium text-white text-lg flex items-center gap-2">
              <span>💬 Conversation</span>
              {messages.length > 0 && (
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                  {messages.length}
                </span>
              )}
            </h3>
          </div>
          
          <div 
            ref={chatMessagesRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">💬</div>
                <p>No messages yet</p>
                <p className="text-sm mt-1">Start speaking or type a message to begin</p>
              </div>
            ) : (
              messages.map((message) => (
                <div 
                  key={message.id}
                  className={`p-3 rounded-lg max-w-[85%] animate-fade-in ${
                    message.sender === 'user' 
                      ? 'bg-blue-600 ml-auto text-white' 
                      : message.sender === 'assistant'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm opacity-80 mb-1">
                    {message.sender === 'user' ? 'You' : 
                     message.sender === 'assistant' ? 'Dr. ' + doctor?.name : 'System'}
                  </div>
                  <div className="text-sm">{message.text}</div>
                  {message.timestamp && (
                    <div className="text-xs opacity-60 mt-1 text-right">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-gray-700 bg-gray-800 flex">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
              placeholder="Type your message..."
              className="flex-1 border border-gray-600 bg-gray-700 text-white rounded-l-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
              disabled={!isSessionInitialized}
            />
            <button
              onClick={sendTextMessage}
              disabled={!inputMessage.trim() || !isSessionInitialized}
              className="bg-blue-600 text-white px-4 rounded-r-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Call Ended Screen */}
      {callStatus === 'ended' && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Phone size={32} className="text-red-400 transform rotate-135" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Call Ended</h3>
              <p className="text-gray-300 mb-2">Consultation with Dr. {doctor?.name}</p>
              <p className="text-gray-400 mb-6">Duration: {formatTime(callDuration)}</p>
              <div className="flex gap-3">
                <button
                  onClick={onBack}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Back to Doctors
                </button>
                <button
                  onClick={startNewSession}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  New Consultation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Consult;