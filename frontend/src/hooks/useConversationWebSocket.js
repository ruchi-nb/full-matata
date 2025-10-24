"use client";
import { useEffect, useRef, useState, useCallback } from 'react';

export function useConversationWebSocket({
  consultationId,
  provider = 'deepgram',
  language = 'en',
  isTTSPlaying = false, // Track if TTS is playing to pause STT
  onTranscript,
  onPartialTranscript,
  onResponse,
  onStatusUpdate,
  onError,
  onAudioLevel
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // Track if recording is paused for TTS
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const isConnectingRef = useRef(false); // Prevent duplicate connections
  const pcmProcessorRef = useRef(null); // For PCM streaming
  const pcmSourceRef = useRef(null); // For PCM streaming
  
  // VAD (Voice Activity Detection) refs
  const speechDetectedRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const vadCheckIntervalRef = useRef(null);
  const lastAudioLevelRef = useRef(0);
  const lastFlushTimeRef = useRef(0); // Track last flush to prevent duplicates
  const isProcessingResponseRef = useRef(false); // Track if backend is processing
  
  // VAD thresholds (more sensitive for better detection)
  const SPEECH_THRESHOLD = 30; // Audio level above this = speech (lowered for sensitivity)
  const SILENCE_THRESHOLD = 10; // Audio level below this = silence (lowered for sensitivity)
  const SILENCE_DURATION = 1500; // 1.5 seconds of silence to finalize (ms) - slightly longer
  const FLUSH_DEBOUNCE_MS = 3000; // Don't send flush more than once every 3 seconds
  
  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Prevent duplicate connections (React Strict Mode protection)
    if (isConnectingRef.current) {
      console.log('[WebSocket] Connection already in progress, skipping...');
      return;
    }
    
    // Don't connect if already connecting or connected
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocket] Already connected or connecting, skipping...');
      return;
    }
    
    isConnectingRef.current = true;
    
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('[WebSocket] No access token found');
      onError?.(new Error('Authentication required. Please log in again.'));
      return;
    }
    
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const wsUrl = backendUrl.replace('http', 'ws') + '/api/v1/conversation/stream';
    const wsUrlWithToken = `${wsUrl}?token=${encodeURIComponent(token)}`;
    
    console.log('[WebSocket] Connecting to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrlWithToken);
    
    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      setIsConnected(true);
      isConnectingRef.current = false; // Reset connecting flag
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      
      // Send init message
      ws.send(JSON.stringify({
        type: 'init',
        consultation_id: consultationId,
        language,
        provider
      }));
      
      onStatusUpdate?.('Connected - Ready to speak');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Only log non-ping messages to reduce console noise
        if (message.type !== 'ping') {
          console.log('[WebSocket] Message:', message);
        }
        
        switch (message.type) {
          case 'connection_established':
            onStatusUpdate?.('Ready');
            break;
            
          case 'ping':
            // Respond to ping with pong to keep connection alive (silent)
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
            
          case 'vad_signal':
            // Handle Sarvam's VAD signals
            if (message.signal_type === 'END_SPEECH') {
              // Debounce flush signals - only send if enough time has passed and not already processing
              const now = Date.now();
              const timeSinceLastFlush = now - lastFlushTimeRef.current;
              
              if (!isProcessingResponseRef.current && timeSinceLastFlush > FLUSH_DEBOUNCE_MS) {
                console.log('[VAD] Sarvam detected END_SPEECH, sending flush signal...');
                lastFlushTimeRef.current = now;
                isProcessingResponseRef.current = true;
                sendFlushSignal();
              } else {
                console.log('[VAD] Skipping flush (debounced or already processing)');
              }
            } else if (message.signal_type === 'START_SPEECH') {
              // Reset processing flag when new speech starts
              isProcessingResponseRef.current = false;
            }
            break;
            
          case 'streaming_transcript':
            console.log('[STT] Streaming transcript:', message.transcript);
            onPartialTranscript?.(message.transcript);
            break;
            
          case 'final_transcript':
            console.log('[STT] Final transcript:', message.transcript);
            onTranscript?.(message.transcript);
            break;
            
          case 'response':
            onResponse?.(message.final_response);
            // Reset processing flag after receiving response
            isProcessingResponseRef.current = false;
            break;
            
          case 'processing_state':
            if (message.is_processing) {
              onStatusUpdate?.('AI is thinking...');
            } else {
              onStatusUpdate?.('Ready');
            }
            break;
            
          case 'error':
            onError?.(new Error(message.message));
            break;
        }
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
      isConnectingRef.current = false; // Reset connecting flag on error
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error(`[WebSocket] Max reconnection attempts (${maxReconnectAttempts}) reached`);
        onError?.(new Error('WebSocket connection failed. Please check if backend is running.'));
        onStatusUpdate?.('Connection failed');
      }
    };
    
    ws.onclose = (event) => {
      console.log('[WebSocket] Connection closed:', event.code, event.reason);
      setIsConnected(false);
      isConnectingRef.current = false; // Reset connecting flag
      wsRef.current = null;
      
      // Only attempt reconnect if it wasn't a clean close and we haven't exceeded max attempts
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts && consultationId) {
        console.log(`[WebSocket] Will retry... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
        onStatusUpdate?.('Reconnecting...');
        
        // Retry after a delay with exponential backoff
        const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        setTimeout(() => {
          if (consultationId) {
            connectWebSocket();
          }
        }, delay);
      } else {
        onStatusUpdate?.('Disconnected');
      }
    };
    
    wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      onError?.(new Error('Failed to connect to server. Please check your connection.'));
      setIsConnected(false);
      isConnectingRef.current = false; // Reset connecting flag on error
    }
  }, [consultationId, provider, language]);
  
  // Initialize WebSocket only when consultationId is available
  useEffect(() => {
    if (!consultationId) {
      console.log('[WebSocket] No consultationId provided, ensuring WebSocket is closed...');
      // Ensure WebSocket is closed if consultationId becomes null
      if (wsRef.current) {
        console.log('[WebSocket] Closing existing connection...');
        wsRef.current.close(1000, 'Consultation ID removed');
        wsRef.current = null;
        setIsConnected(false);
        isConnectingRef.current = false;
      }
      return;
    }
    
    console.log('[WebSocket] Initializing with consultationId:', consultationId);
    connectWebSocket();
    
    return () => {
      console.log('[WebSocket] Cleaning up connection...');
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
        setIsConnected(false);
        isConnectingRef.current = false;
      }
    };
  }, [consultationId, connectWebSocket]);
  
  // Initialize audio
  const initializeAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;
      
      // Setup audio context for VAD
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      analyserRef.current = audioContextRef.current.createAnalyser();
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current.fftSize = 256;
      microphone.connect(analyserRef.current);
      
      console.log('[Audio] Initialized with VAD');
    } catch (error) {
      console.error('[Audio] Initialization failed:', error);
      onError?.(error);
    }
  }, [onError]);
  
  // VAD: Check audio levels and detect speech/silence
  const checkAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average audio level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    lastAudioLevelRef.current = average;
    
    // Send audio level to UI for visual feedback
    onAudioLevel?.(average);
    
    // Speech detected
    if (average > SPEECH_THRESHOLD && !speechDetectedRef.current) {
      console.log('[VAD] Speech detected, level:', average.toFixed(2));
      speechDetectedRef.current = true;
      
      // Clear any existing silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      onStatusUpdate?.('🎤 Listening - Speaking detected...');
    }
    // Silence detected after speech
    else if (average < SILENCE_THRESHOLD && speechDetectedRef.current) {
      // Start silence timer if not already started
      if (!silenceTimerRef.current) {
        console.log('[VAD] Silence detected, starting timer...');
        silenceTimerRef.current = setTimeout(() => {
          if (speechDetectedRef.current) {
            console.log('[VAD] Silence timeout - finalizing speech');
            speechDetectedRef.current = false;
            silenceTimerRef.current = null;
            
            // Send flush signal to finalize transcription
            sendFlushSignal();
            
            onStatusUpdate?.('Processing...');
          }
        }, SILENCE_DURATION);
      }
    }
    // Speech resumed (cancel silence timer)
    else if (average > SILENCE_THRESHOLD && speechDetectedRef.current && silenceTimerRef.current) {
      console.log('[VAD] Speech resumed, clearing silence timer');
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, [isRecording, onStatusUpdate]);
  
  // Send flush signal to backend to finalize transcription
  const sendFlushSignal = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
      console.log('[VAD] Sending flush signal to finalize transcription');
      wsRef.current.send(JSON.stringify({ type: 'flush' }));
    } catch (e) {
      console.warn('[VAD] Failed to send flush signal:', e);
    }
  }, []);
  
  // Send PCM chunk (defined before startRecording to avoid temporal dead zone)
  const sendPcmChunk = useCallback((pcmInt16) => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      // Convert Int16Array to base64
      const u8 = new Uint8Array(pcmInt16.buffer);
      let binary = '';
      for (let i = 0; i < u8.length; i++) {
        binary += String.fromCharCode(u8[i]);
      }
      const b64 = btoa(binary);
      
      wsRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        audio: b64,
        language,
        provider,
        is_streaming: true,
        encoding: 'pcm',
        sample_rate: 16000
      }));
    } catch (e) {
      console.warn('[PCM] Failed to send PCM chunk:', e);
    }
  }, [language, provider]);
  
  // Send final audio
  const sendFinalAudio = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (audioChunksRef.current.length === 0) return;
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      
      wsRef.current?.send(JSON.stringify({
        type: 'final_audio',
        audio: base64,
        language,
        provider,
        is_streaming: false,
        encoding: 'webm',
        sample_rate: 16000
      }));
      
      console.log('[Audio] Final audio sent');
    };
    
    reader.readAsDataURL(audioBlob);
  }, [language, provider]);
  
  // Start recording
  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      await initializeAudio();
    }
    
    if (!streamRef.current || isRecording) return;
    
    try {
      audioChunksRef.current = [];
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('[Recording] Stopped');
        setIsRecording(false);
        
        // Send final audio
        sendFinalAudio();
        
        // Cleanup PCM streaming
        if (pcmProcessorRef.current) {
          try { pcmProcessorRef.current.disconnect(); } catch (e) {}
          pcmProcessorRef.current = null;
        }
        if (pcmSourceRef.current) {
          try { pcmSourceRef.current.disconnect(); } catch (e) {}
          pcmSourceRef.current = null;
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      // Start VAD interval to monitor audio levels
      console.log('[VAD] Starting voice activity detection...');
      vadCheckIntervalRef.current = setInterval(checkAudioLevel, 100); // Check every 100ms
      speechDetectedRef.current = false; // Reset speech detection
      
      // Start PCM streaming for real-time STT (matches backend implementation)
      try {
        const isSarvam = provider.toLowerCase().includes('sarvam');
        const isDeepgram = provider.toLowerCase().includes('deepgram');
        
        if ((isSarvam || isDeepgram) && audioContextRef.current) {
          console.log('[PCM] Starting PCM streaming for', provider);
          
          // Resume audio context if suspended
          if (audioContextRef.current.resume) {
            audioContextRef.current.resume();
          }
          
          const bufferSize = 2048; // Match backend buffer size
          pcmProcessorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
          pcmSourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
          
          pcmSourceRef.current.connect(pcmProcessorRef.current);
          pcmProcessorRef.current.connect(audioContextRef.current.destination);
          
          pcmProcessorRef.current.onaudioprocess = (e) => {
            // **Skip sending PCM chunks when paused (TTS is playing)**
            if (isPaused) {
              return;
            }
            
            const input = e.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(input.length);
            
            // Convert Float32 to Int16
            for (let i = 0; i < input.length; i++) {
              let s = Math.max(-1, Math.min(1, input[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Send PCM chunk to backend
            sendPcmChunk(pcm);
          };
          
          console.log('[PCM] PCM streaming started for', provider);
        }
      } catch (e) {
        console.warn('[PCM] PCM streaming setup failed:', e);
      }
      
      onStatusUpdate?.('Listening...');
      console.log('[Recording] Started');
    } catch (error) {
      console.error('[Recording] Start failed:', error);
      onError?.(error);
    }
  }, [isRecording, initializeAudio, onStatusUpdate, onError, provider, sendPcmChunk, sendFinalAudio, checkAudioLevel]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      onStatusUpdate?.('Processing...');
    }
    
    // Clear VAD interval and timers
    if (vadCheckIntervalRef.current) {
      clearInterval(vadCheckIntervalRef.current);
      vadCheckIntervalRef.current = null;
      console.log('[VAD] Stopped voice activity detection');
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // Reset VAD state
    speechDetectedRef.current = false;
    lastAudioLevelRef.current = 0;
  }, [onStatusUpdate]);
  
  // Send text message
  const sendTextMessage = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.(new Error('Not connected to server'));
      return;
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'text_message',
      text,
      language,
      provider
    }));
  }, [language, provider, onError]);
  
  // Pause recording (stop sending PCM chunks, but keep mic active)
  const pauseRecording = useCallback(() => {
    console.log('[Recording] Paused (TTS playing)');
    setIsPaused(true);
    
    // Stop VAD checks while paused
    if (vadCheckIntervalRef.current) {
      clearInterval(vadCheckIntervalRef.current);
      vadCheckIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);
  
  // Resume recording (continue sending PCM chunks)
  const resumeRecording = useCallback(() => {
    console.log('[Recording] Resumed (TTS complete)');
    setIsPaused(false);
    
    // Restart VAD checks
    if (isRecording && analyserRef.current) {
      vadCheckIntervalRef.current = setInterval(checkAudioLevel, 100);
    }
  }, [isRecording, checkAudioLevel]);
  
  // Auto-pause/resume when TTS state changes
  useEffect(() => {
    if (isTTSPlaying && isRecording && !isPaused) {
      console.log('[TTS] Auto-pausing STT for TTS playback');
      pauseRecording();
    } else if (!isTTSPlaying && isRecording && isPaused) {
      console.log('[TTS] Auto-resuming STT after TTS playback');
      resumeRecording();
    }
  }, [isTTSPlaying, isRecording, isPaused, pauseRecording, resumeRecording]);
  
  return {
    isConnected,
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    sendTextMessage
  };
}

