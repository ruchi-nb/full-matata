"use client";
import { useEffect, useRef, useState, useCallback } from 'react';

export function useConversationWebSocket({
  consultationId,
  provider = 'deepgram',
  language = 'en',
  onTranscript,
  onPartialTranscript,
  onResponse,
  onStatusUpdate,
  onError
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  
  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Don't connect if already connecting or connected
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocket] Already connected or connecting, skipping...');
      return;
    }
    
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
        console.log('[WebSocket] Message:', message);
        
        switch (message.type) {
          case 'connection_established':
            onStatusUpdate?.('Ready');
            break;
            
          case 'streaming_transcript':
            onPartialTranscript?.(message.transcript);
            break;
            
          case 'final_transcript':
            onTranscript?.(message.transcript);
            break;
            
          case 'response':
            onResponse?.(message.final_response);
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
    }
  }, [consultationId, provider, language, onTranscript, onPartialTranscript, onResponse, onStatusUpdate, onError]);
  
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
      }
    };
  }, [consultationId, connectWebSocket]);
  
  // Initialize audio
  const initializeAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup audio context for VAD
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      analyserRef.current = audioContextRef.current.createAnalyser();
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current.fftSize = 256;
      microphone.connect(analyserRef.current);
      
      console.log('[Audio] Initialized');
    } catch (error) {
      console.error('[Audio] Initialization failed:', error);
      onError?.(error);
    }
  }, [onError]);
  
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
          
          // Send PCM chunks for real-time processing
          sendAudioChunk(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('[Recording] Stopped');
        setIsRecording(false);
        
        // Send final audio
        sendFinalAudio();
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      onStatusUpdate?.('Listening...');
      
      console.log('[Recording] Started');
    } catch (error) {
      console.error('[Recording] Start failed:', error);
      onError?.(error);
    }
  }, [isRecording, initializeAudio, onStatusUpdate, onError]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      onStatusUpdate?.('Processing...');
    }
  }, [onStatusUpdate]);
  
  // Send audio chunk
  const sendAudioChunk = useCallback((audioBlob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      
      // Extract PCM data
      const audioContext = audioContextRef.current;
      if (audioContext) {
        audioBlob.arrayBuffer().then(buffer => {
          audioContext.decodeAudioData(buffer).then(audioBuffer => {
            const pcmData = audioBuffer.getChannelData(0);
            const pcm16 = new Int16Array(pcmData.length);
            
            for (let i = 0; i < pcmData.length; i++) {
              const s = Math.max(-1, Math.min(1, pcmData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to base64
            const uint8 = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const pcmBase64 = btoa(binary);
            
            wsRef.current?.send(JSON.stringify({
              type: 'audio_chunk',
              audio: pcmBase64,
              language,
              provider,
              is_streaming: true,
              encoding: 'pcm',
              sample_rate: 16000
            }));
          });
        });
      }
    };
    reader.readAsDataURL(audioBlob);
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
        is_streaming: false
      }));
      
      console.log('[Audio] Final audio sent');
    };
    
    reader.readAsDataURL(audioBlob);
  }, [language, provider]);
  
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
  
  return {
    isConnected,
    isRecording,
    startRecording,
    stopRecording,
    sendTextMessage
  };
}

