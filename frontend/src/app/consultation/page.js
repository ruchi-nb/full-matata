"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send } from 'lucide-react';
import consultationService from '@/services/consultationService';
import { useConversationWebSocket } from '@/hooks/useConversationWebSocket';

// Language mapping helper - converts short codes to provider-specific codes
const normalizeLanguage = (lang, provider) => {
  // If already in correct format (has country code), return as is
  if (lang.includes('-')) return lang;
  
  // Map short codes to Sarvam format (with country code)
  if (provider === 'sarvam') {
    const sarvamMap = {
      'en': 'en-IN',
      'hi': 'hi-IN',
      'bn': 'bn-IN',
      'gu': 'gu-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'mr': 'mr-IN',
      'pa': 'pa-IN',
      'ta': 'ta-IN',
      'te': 'te-IN'
    };
    return sarvamMap[lang] || 'en-IN';
  }
  
  // Deepgram uses simple codes
  return lang;
};

export default function ConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL params
  const doctorUserId = searchParams.get('doctor_id');
  const providerParam = searchParams.get('provider') || 'deepgram';
  const languageParam = searchParams.get('language') || 'en';
  
  // Normalize language based on provider
  const normalizedLanguage = normalizeLanguage(languageParam, providerParam);
  
  // State
  const [doctor, setDoctor] = useState(null);
  const [consultationId, setConsultationId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [provider, setProvider] = useState(providerParam);
  const [language, setLanguage] = useState(normalizedLanguage);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isStreamingMode, setIsStreamingMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // For VAD visual feedback
  const [isTTSPlaying, setIsTTSPlaying] = useState(false); // Track TTS playback state
  
  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const hasShownConnectedMessageRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const audioElementRef = useRef(null); // Track current TTS audio element
  
  // Debug: Track consultation ID state changes
  useEffect(() => {
    console.log('🆔 [State] consultationId changed to:', consultationId);
  }, [consultationId]);
  
  // WebSocket hook - only connects when streaming mode is active
  const wsConsultationId = isStreamingMode ? consultationId : null;
  
  // Debug: Log when consultation ID changes for WebSocket
  useEffect(() => {
    console.log('[Page] WebSocket consultationId:', wsConsultationId, 'isStreamingMode:', isStreamingMode, 'actual consultationId:', consultationId);
  }, [wsConsultationId, isStreamingMode, consultationId]);
  
  const {
    isConnected,
    isRecording,
    startRecording,
    stopRecording,
    sendTextMessage,
    pauseRecording,
    resumeRecording
  } = useConversationWebSocket({
    consultationId: wsConsultationId,
    provider,
    language,
    isTTSPlaying, // Pass TTS state to hook
    onTranscript: (transcript) => {
      addMessage('user', `${transcript} (${getLanguageLabel()})`);
      setPartialTranscript('');
    },
    onPartialTranscript: (partial) => {
      setPartialTranscript(partial);
    },
    onResponse: (response) => {
      addMessage('doctor', response);
      // Play TTS for doctor's response
      playTTS(response);
    },
    onStatusUpdate: (newStatus) => {
      setStatus(newStatus);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      addMessage('system', '❌ Connection error: ' + error.message);
      setIsStreamingMode(false);
      hasShownConnectedMessageRef.current = false; // Reset on error
    },
    onAudioLevel: (level) => {
      setAudioLevel(level); // Update audio level for VAD visual feedback
    }
  });
  
  // Notify when WebSocket connects (only once per session) and start recording
  useEffect(() => {
    if (isConnected && isStreamingMode && !hasShownConnectedMessageRef.current) {
      addMessage('system', '✅ Voice mode active! Starting microphone...');
      setStatus('Voice Mode - Ready');
      hasShownConnectedMessageRef.current = true;
      
      // Automatically start recording when voice mode is active and connected
      if (!isRecording) {
        console.log('🎤 Auto-starting recording in voice mode...');
        startRecording().then(() => {
          addMessage('system', '🎤 Listening... Speak now!');
          setStatus('Voice Mode - Listening');
        }).catch((error) => {
          console.error('Failed to start recording:', error);
          addMessage('system', '❌ Failed to access microphone: ' + error.message);
          setIsStreamingMode(false); // Fall back to text mode
        });
      }
    } else if (!isConnected && !isStreamingMode) {
      // Reset flag when disconnected
      hasShownConnectedMessageRef.current = false;
    }
  }, [isConnected, isStreamingMode, isRecording, startRecording]);
  
  // Initialize on mount (prevent double initialization in dev mode)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeConsultation();
      initUserVideo();
    }
    return () => {
      cleanupResources();
    };
  }, [doctorUserId]);
  
  const initializeConsultation = async () => {
    setIsLoading(true);
    setStatus('Initializing...');
    try {
      const selectedDoctor = JSON.parse(sessionStorage.getItem('selectedDoctor') || 'null');
      if (!selectedDoctor || selectedDoctor.user_id !== parseInt(doctorUserId)) {
        console.error('Doctor data not found in session storage.');
        router.push('/patientportal');
        return;
      }
      setDoctor(selectedDoctor);

      const result = await consultationService.createConsultation(selectedDoctor);
      if (result?.consultation_id) {
        console.log('🆔 Setting consultation ID:', result.consultation_id);
        setConsultationId(result.consultation_id);
        // Store in window for backend compatibility
        window.consultationId = result.consultation_id;
        addMessage('system', `✅ Welcome to Virtual Doctor! Consultation ID: ${result.consultation_id}`);
        addMessage('system', '💬 Text Mode: Type your message and press Send');
        addMessage('system', '🎤 Voice Mode: Click "Voice Mode" button to enable speech-to-text');
        setStatus('Ready - Text Mode');
      } else {
        throw new Error('Failed to create consultation session.');
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Consultation initialization failed:', error);
      
      // Check if it's an authentication error (token expired)
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || 
          errorMsg.includes('authentication') || errorMsg.includes('expired')) {
        addMessage('system', '❌ Your session has expired. Redirecting to login...');
        setStatus('Session Expired');
        // Clear expired token and redirect to login after 2 seconds
        setTimeout(() => {
          localStorage.removeItem('access_token');
          router.push('/login');
        }, 2000);
      } else {
        addMessage('system', `❌ Error: ${error.message}`);
        setStatus('Initialization Failed');
      }
      
      setIsLoading(false);
    }
  };
  
  const initUserVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
      addMessage('system', 'Camera and microphone ready');
    } catch (err) {
      console.warn('Could not access webcam/mic:', err.message);
      addMessage('system', 'Camera/mic not available (will use audio only mode)');
      setIsCameraOn(false);
      // Try audio-only as fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = audioStream;
        addMessage('system', 'Microphone ready (audio only)');
      } catch (audioErr) {
        console.warn('Could not access microphone:', audioErr.message);
        addMessage('system', 'No audio devices available. You can still type messages.');
      }
    }
  };
  
  const cleanupResources = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  const addMessage = (sender, text) => {
    setMessages((prevMessages) => [...prevMessages, { sender, text, timestamp: new Date() }]);
  };
  
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, partialTranscript]);
  
  const getLanguageLabel = () => {
    const langMap = {
      'en': 'English',
      'hi': 'Hindi',
      'multi': 'Multi-Language',
      'en-IN': 'English (India)',
      'hi-IN': 'Hindi',
      'bn-IN': 'Bengali',
      'gu-IN': 'Gujarati',
      'kn-IN': 'Kannada',
      'ml-IN': 'Malayalam',
      'mr-IN': 'Marathi',
      'pa-IN': 'Punjabi',
      'ta-IN': 'Tamil',
      'te-IN': 'Telugu'
    };
    return langMap[language] || language;
  };

  // Play TTS for doctor's response
  const playTTS = useCallback(async (text) => {
    if (!text || !consultationId) return;
    
    try {
      console.log('[TTS] Playing response:', text.substring(0, 50) + '...');
      
      // **PAUSE STT RECORDING DURING TTS PLAYBACK**
      // This prevents the microphone from capturing the doctor's voice from speakers
      const wasRecording = isRecording;
      if (wasRecording && pauseRecording) {
        console.log('[TTS] 🔇 Pausing STT recording to prevent echo...');
        pauseRecording();
      }
      setIsTTSPlaying(true);
      
      // Try both token keys (access_token for backend template, token for Next.js)
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
      
      // Use FormData like the backend template does
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', language);
      formData.append('provider', provider);
      formData.append('consultation_id', consultationId);
      formData.append('session_id', `session-${Date.now()}`);
      if (provider === 'sarvam') {
        formData.append('speaker', 'meera');
      }
      
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE}/api/v1/tts/stream`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        console.error('[TTS] Failed:', response.status, response.statusText);
        // Resume recording on error
        setIsTTSPlaying(false);
        if (wasRecording && resumeRecording) {
          console.log('[TTS] 🎤 Resuming STT recording after error...');
          resumeRecording();
        }
        return;
      }

      // Get audio blob from response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Store reference to cancel if needed
      audioElementRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        console.log('[TTS] ✅ Playback complete');
        setIsTTSPlaying(false);
        audioElementRef.current = null;
        
        // **RESUME STT RECORDING AFTER TTS COMPLETES**
        if (wasRecording && resumeRecording && isStreamingMode) {
          console.log('[TTS] 🎤 Resuming STT recording...');
          resumeRecording();
        }
      };
      
      audio.onerror = (error) => {
        console.error('[TTS] Playback error:', error);
        URL.revokeObjectURL(audioUrl);
        setIsTTSPlaying(false);
        audioElementRef.current = null;
        
        // Resume recording on error
        if (wasRecording && resumeRecording && isStreamingMode) {
          console.log('[TTS] 🎤 Resuming STT recording after playback error...');
          resumeRecording();
        }
      };
      
      await audio.play();
      console.log('[TTS] 🔊 Started playback');
    } catch (error) {
      console.error('[TTS] Error:', error);
      setIsTTSPlaying(false);
      audioElementRef.current = null;
      
      // Resume recording on error
      if (isRecording && resumeRecording && isStreamingMode) {
        console.log('[TTS] 🎤 Resuming STT recording after error...');
        resumeRecording();
      }
    }
  }, [consultationId, language, provider, isRecording, isStreamingMode, pauseRecording, resumeRecording]);
  
  // Toggle streaming mode (mimic conversation.js startStreamingMode/stopStreamingMode)
  const toggleStreamingMode = () => {
    if (!isStreamingMode) {
      startStreamingMode();
    } else {
      stopStreamingMode();
    }
  };
  
  const startStreamingMode = () => {
    if (!consultationId) {
      addMessage('system', 'Please wait for consultation to initialize');
      return;
    }
    
    console.log('Starting voice mode with STT streaming...');
    setIsStreamingMode(true);
    addMessage('system', '🎤 Activating voice mode... WebSocket connecting for speech-to-text.');
    setStatus('Voice Mode - Connecting...');
  };
  
  const stopStreamingMode = () => {
    console.log('Stopping voice mode, switching to text mode...');
    
    // Stop recording if active
    if (isRecording) {
      console.log('🛑 Stopping recording...');
      stopRecording();
    }
    
    setIsStreamingMode(false);
    setStatus('Ready - Text Mode');
    addMessage('system', '💬 Switched to text mode. Type your message below.');
  };
  
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
        addMessage('system', `Camera ${videoTrack.enabled ? 'on' : 'off'}`);
      }
    }
  };
  
  const handleClearSession = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      setMessages([]);
      setPartialTranscript('');
      addMessage('system', 'Session cleared. Starting fresh conversation.');
      setStatus('New session started');
    }
  };
  
  const handleEndConversation = async () => {
    if (confirm('Are you sure you want to end the consultation?')) {
      if (isStreamingMode) {
        stopStreamingMode();
      }
      
      cleanupResources();
      
      setStatus('Ending session...');
      try {
        if (consultationId) {
          await consultationService.endConsultation(consultationId);
          addMessage('system', 'Consultation ended successfully. Redirecting...');
        } else {
          addMessage('system', 'Redirecting to patient portal...');
        }
        setTimeout(() => {
          router.push('/patientportal');
        }, 1500);
      } catch (error) {
        console.error('Failed to end consultation:', error);
        addMessage('system', `Warning: ${error.message}. Redirecting anyway...`);
        // Redirect even if end consultation fails
        setTimeout(() => {
          router.push('/patientportal');
        }, 2000);
      }
    }
  };
  
  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text) return;

    // For text mode: send directly via REST API (no WebSocket needed)
    if (!isStreamingMode) {
      addMessage('user', text);
      setInputMessage('');
      setStatus('Sending...');
      
      try {
        // Send text message via REST API using FormData
        const formData = new FormData();
        formData.append('text', text);
        formData.append('consultation_id', consultationId);
        formData.append('language', language);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversation/text`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          },
          body: formData
        });

        if (!response.ok) {
          if (response.status === 401) {
            addMessage('system', '❌ Session expired. Redirecting to login...');
            setTimeout(() => {
              localStorage.removeItem('access_token');
              router.push('/login');
            }, 2000);
            return;
          }
          throw new Error('Failed to send message');
        }

        const result = await response.json();
        console.log('📥 Text API response:', result);
        const doctorResponse = result.final_response || result.response || result.message || 'No response received';
        addMessage('doctor', doctorResponse);
        // Play TTS for text mode response too
        playTTS(doctorResponse);
        setStatus('Ready - Text Mode');
      } catch (error) {
        console.error('Error sending text message:', error);
        addMessage('system', '❌ Failed to send message. Please try again.');
        setStatus('Error');
      }
      return;
    }
    
    // For voice mode: send via WebSocket
    if (!isConnected) {
      addMessage('system', 'WebSocket not connected. Please wait for "● Connected" status before sending messages.');
      return;
    }

    addMessage('user', text);
    setInputMessage('');
    sendTextMessage(text);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center text-white text-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading consultation...</p>
        </div>
      </div>
    );
  }
  
  if (!doctor) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center text-red-500 text-xl">
        <div className="text-center">
          <p className="mb-4">Error: Doctor information not available.</p>
          <button
            onClick={() => router.push('/patientportal')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Patient Portal
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#111] text-white flex overflow-hidden">
      {/* Video Area */}
      <div className="relative flex-1 flex justify-center items-center bg-black overflow-hidden">
        {/* AI Placeholder */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#667eea] to-[#764ba2]">
          <div className="absolute inset-0 flex items-center justify-center text-white text-4xl font-bold">
            🤖 Virtual Doctor
          </div>
        </div>
        
        {/* User Video */}
        {isCameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-[30px] right-5 w-[265px] h-[200px] rounded-xl border-3 border-[#667eea] shadow-2xl z-10 object-cover bg-black"
          ></video>
        ) : (
          <div className="absolute bottom-[30px] right-5 w-[265px] h-[200px] rounded-xl border-3 border-[#667eea] shadow-2xl z-10 bg-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-2">📹</div>
              <div className="text-sm">Camera Off</div>
            </div>
          </div>
        )}
        
        {/* Language Selector */}
        <div className="absolute top-5 left-5 bg-black/80 backdrop-blur-lg p-3 rounded-lg border border-white/10 z-30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="provider-select" className="text-sm text-white">Provider:</label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setProvider(newProvider);
                  // Update language to match new provider format
                  const currentLangBase = language.split('-')[0]; // Get base language code
                  const normalizedLang = normalizeLanguage(currentLangBase, newProvider);
                  setLanguage(normalizedLang);
                }}
                className="bg-[#333] text-white border border-[#555] px-2 py-1 rounded text-sm"
                disabled={isStreamingMode}
              >
                <option value="deepgram">Deepgram (English optimized)</option>
                <option value="sarvam">Sarvam (Indic languages)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label htmlFor="language-select" className="text-sm text-white">Language:</label>
              <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#333] text-white border border-[#555] px-2 py-1 rounded text-sm"
                disabled={isStreamingMode}
              >
                {provider === 'deepgram' ? (
                  <>
                    <option value="en">English</option>
                    <option value="multi">Multi-Language (Auto-detect)</option>
                    <option value="hi">Hindi</option>
                  </>
                ) : (
                  <>
                    <option value="en-IN">English</option>
                    <option value="hi-IN">Hindi</option>
                    <option value="bn-IN">Bengali</option>
                    <option value="gu-IN">Gujarati</option>
                    <option value="kn-IN">Kannada</option>
                    <option value="ml-IN">Malayalam</option>
                    <option value="mr-IN">Marathi</option>
                    <option value="pa-IN">Punjabi</option>
                    <option value="ta-IN">Tamil</option>
                    <option value="te-IN">Telugu</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className="absolute bottom-[100px] left-5 bg-black/80 backdrop-blur-lg px-5 py-3 rounded-lg border border-white/20 z-30 min-w-[200px] text-center">
          <p className="text-white font-medium">{status}</p>
          {isStreamingMode && isConnected && isRecording && isTTSPlaying && (
            <p className="text-orange-400 text-xs mt-1">⏸ Paused (TTS playing)</p>
          )}
          {isStreamingMode && isConnected && isRecording && !isTTSPlaying && (
            <p className="text-red-400 text-xs mt-1 animate-pulse">● Recording</p>
          )}
          {isStreamingMode && isConnected && !isRecording && (
            <p className="text-green-400 text-xs mt-1">● Connected</p>
          )}
          {isStreamingMode && !isConnected && (
            <p className="text-yellow-400 text-xs mt-1 animate-pulse">○ Connecting...</p>
          )}
        </div>
        
        {/* Controls */}
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-4 flex-wrap justify-center z-30 max-w-[90%]">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={toggleStreamingMode}
              className={`px-14 py-3 rounded text-white text-lg transition-all duration-300 ${
                isStreamingMode && isRecording
                  ? 'bg-red-600/80 hover:bg-red-700/80 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : isStreamingMode
                  ? 'bg-orange-600/80 hover:bg-orange-700/80 border border-orange-400'
                  : 'bg-black/40 hover:bg-white/20 border border-gray-400'
              }`}
              disabled={!consultationId}
              title={isStreamingMode ? 'Stop voice mode (click to switch to text)' : 'Start voice mode with STT streaming'}
            >
              {isStreamingMode && isRecording ? '🎤 Listening...' : isStreamingMode ? '🎤 Voice ON (Stop)' : '🎤 Voice Mode'}
            </button>
            
            {/* Audio Level Meter (VAD Visual Feedback) */}
            {isStreamingMode && isRecording && (
              <div className="w-full bg-gray-800/80 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ${
                    audioLevel > 30 ? 'bg-green-500' : audioLevel > 10 ? 'bg-yellow-500' : 'bg-gray-600'
                  }`}
                  style={{ width: `${Math.min(100, (audioLevel / 80) * 100)}%` }}
                  title={`Audio level: ${audioLevel.toFixed(0)}`}
                />
              </div>
            )}
          </div>
          
          <button
            onClick={toggleCamera}
            className="px-14 py-3 rounded bg-black/40 hover:bg-white/20 border border-gray-400 text-white text-lg transition-all"
          >
            {isCameraOn ? '📷 Camera On' : '🚫 Camera Off'}
          </button>
          
          <button
            onClick={handleClearSession}
            className="px-14 py-3 rounded bg-black/40 hover:bg-white/20 border border-gray-400 text-white text-lg transition-all"
          >
            New Session
          </button>
          
          <button
            onClick={handleEndConversation}
            className="px-14 py-3 rounded bg-[#b71c1c] hover:bg-[#8b0000] text-white text-lg transition-all"
          >
            🛑 End Session
          </button>
        </div>
      </div>
      
      {/* Chat Section */}
      <div className="w-[300px] bg-[#1a1a1a] flex flex-col border-l-2 border-[#333]">
        {/* Chat Messages */}
        <div ref={chatMessagesRef} className="flex-1 overflow-y-auto p-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-3 p-2 rounded-lg break-words ${
                msg.sender === 'user'
                  ? 'bg-[#0078d7]'
                  : msg.sender === 'doctor'
                  ? 'bg-[#28a745]'
                  : 'bg-[#6c757d] text-xs'
              }`}
            >
              <strong>
                {msg.sender === 'user' ? 'You' : msg.sender === 'doctor' ? 'Doctor' : 'System'}:
              </strong>{' '}
              {msg.text}
            </div>
          ))}
          
          {/* Live Partial Transcript */}
          {partialTranscript && (
            <div className="mb-3 p-2 rounded-lg break-words bg-blue-500/50 animate-pulse">
              <strong>You (speaking...):</strong> {partialTranscript} ({getLanguageLabel()})
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <div className="border-t-2 border-[#333]">
          {/* Mode Indicator */}
          <div className={`px-3 py-1 text-xs font-semibold ${
            isStreamingMode 
              ? 'bg-red-900/30 text-red-400' 
              : 'bg-blue-900/30 text-blue-400'
          }`}>
            {isStreamingMode ? '🎤 Voice Mode Active' : '💬 Text Mode Active'}
          </div>
          
          <div className="flex">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isStreamingMode ? "Type or speak..." : "Type your message..."}
              className="flex-1 p-3 border-none bg-[#222] text-white outline-none"
            />
            <button
              onClick={handleSendMessage}
              className="px-4 border-none bg-[#0078d7] hover:bg-[#005fa3] text-white cursor-pointer transition-colors"
              disabled={!inputMessage.trim()}
              title={isStreamingMode ? "Send via WebSocket (Voice Mode)" : "Send via REST API (Text Mode)"}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
