// File: hooks/useEnhancedConversation.js
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { enhancedApiService } from '@/services/enhancedApiService';
import { websocketService } from '@/services/websocketService';
import { enhancedAudioService } from '@/services/enhancedAudioService';

export const useEnhancedConversation = (options = {}) => {
  const {
    autoReconnect = true,
    enableAnalytics = true,
    defaultLanguage = 'en-IN',
    defaultProvider = 'sarvam',
    consultationId = null,
    onError = null,
    onConnectionStateChange = null
  } = options;

  // State
  const [connectionState, setConnectionState] = useState('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speakerLabels, setSpeakerLabels] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [servicesStatus, setServicesStatus] = useState({});
  const [connectionMetrics, setConnectionMetrics] = useState({});
  const [error, setError] = useState(null);
  const [audioStats, setAudioStats] = useState({});

  const sessionConfigRef = useRef({});
  const messageHandlersRef = useRef(new Map());
  const reconnectTimeoutRef = useRef(null);
  const audioStatsRef = useRef({
    chunksSent: 0,
    bytesSent: 0,
    startTime: null
  });

  // Connection state effect
  useEffect(() => {
    if (onConnectionStateChange) {
      onConnectionStateChange(connectionState);
    }
  }, [connectionState, onConnectionStateChange]);

  // Error handling effect
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Auto-reconnect effect
  useEffect(() => {
    if (autoReconnect && connectionState === 'disconnected' && sessionId) {
      const timeout = setTimeout(() => {
        console.log('Auto-reconnecting...');
        connectEnhancedWebSocket().catch(console.error);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [autoReconnect, connectionState, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Error handler
  const handleError = useCallback((error, context = '') => {
    console.error(`Error in ${context}:`, error);
    
    let errorObj;
    if (error instanceof Error) {
      errorObj = error;
    } else if (error && error.message) {
      errorObj = new Error(error.message);
    } else if (error && error.type) {
      // DOM Event object
      errorObj = new Error(`DOM Event: ${error.type}`);
    } else {
      // Fallback for any other object type
      errorObj = new Error(String(error));
    }
    
    setError(errorObj);
    
    if (enableAnalytics) {
      enhancedApiService.logEvent('error_occurred', {
        context,
        error: errorObj.message,
        sessionId: sessionId,
        connectionState
      });
    }
  }, [enableAnalytics, sessionId, connectionState]);

  // Initialize enhanced session
  const initializeEnhancedSession = useCallback(async (sessionOptions = {}) => {
    try {
      setError(null);
      const newSessionId = await enhancedApiService.createSession(consultationId, sessionOptions.sessionType);
      setSessionId(newSessionId);
      
      sessionConfigRef.current = {
        sessionId: newSessionId,
        language: sessionOptions.language || defaultLanguage,
        provider: sessionOptions.provider || defaultProvider,
        enableDiarization: sessionOptions.enableDiarization || false,
        enableVAD: sessionOptions.enableVAD !== false,
        sampleRate: sessionOptions.sampleRate || 16000,
        ...sessionOptions
      };

      if (enableAnalytics) {
        enhancedApiService.logEvent('session_created', {
          sessionId: newSessionId,
          ...sessionConfigRef.current
        });
      }

      return newSessionId;
    } catch (error) {
      handleError(error, 'initializeEnhancedSession');
      throw error;
    }
  }, [consultationId, defaultLanguage, defaultProvider, enableAnalytics, handleError]);

  // Register message handler
  const registerMessageHandler = useCallback((messageType, handler) => {
    if (!messageHandlersRef.current.has(messageType)) {
      messageHandlersRef.current.set(messageType, []);
    }
    messageHandlersRef.current.get(messageType).push(handler);
  }, []);

  // Unregister message handler
  const unregisterMessageHandler = useCallback((messageType, handler) => {
    if (messageHandlersRef.current.has(messageType)) {
      const handlers = messageHandlersRef.current.get(messageType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }, []);

  // Enhanced WebSocket connection
  const connectEnhancedWebSocket = useCallback(async (connectOptions = {}) => {
  try {
    setError(null);
    const currentSessionId = sessionId || await initializeEnhancedSession(connectOptions);
    
    setConnectionState('connecting');
    
    // Add connection timeout
    const connectionPromise = websocketService.connect(
      currentSessionId,
      connectOptions.language || sessionConfigRef.current.language,
      connectOptions.provider || sessionConfigRef.current.provider,
      consultationId
    );

    // Add timeout to prevent hanging connections
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });

    await Promise.race([connectionPromise, timeoutPromise]);

    // Set up message handlers
    const messageHandlers = {
      connection_established: (message) => {
        setConnectionState('connected');
        setError(null);
        if (enableAnalytics) {
          enhancedApiService.logEvent('websocket_connected', { 
            sessionId: currentSessionId,
            provider: sessionConfigRef.current.provider
          });
        }
      },

      // ... rest of your message handlers remain the same
      streaming_transcript: (message) => {
        setInterimTranscript(message.transcript);
      },

      final_transcript: (message) => {
        setInterimTranscript('');
        const newMessage = {
          id: `${Date.now()}-${message.utterance_seq || 0}`,
          sender: 'user',
          text: message.transcript,
          utterance_seq: message.utterance_seq,
          timestamp: Date.now(),
          type: 'transcript'
        };
        setMessages(prev => [...prev, newMessage]);
      },

      response: (message) => {
        setIsProcessing(false);
        const newMessage = {
          id: `${Date.now()}-${message.utterance_seq || 0}`,
          sender: 'assistant',
          text: message.final_response,
          metrics: message.metrics,
          utterance_seq: message.utterance_seq,
          timestamp: Date.now(),
          type: 'response'
        };
        setMessages(prev => [...prev, newMessage]);
      },

      diarized_transcript: (message) => {
        setSpeakerLabels(message.labeled);
      },

      processing_state: (message) => {
        setIsProcessing(message.is_processing);
      },

      audio_metrics: (message) => {
        setConnectionMetrics(prev => ({
          ...prev,
          audio: message.metrics
        }));
      },

      connection_metrics: (message) => {
        setConnectionMetrics(prev => ({
          ...prev,
          connection: message.metrics
        }));
      },

      error: (message) => {
        console.error('WebSocket error message:', message);
        setIsProcessing(false);
        handleError(message.error || message, 'websocket_error');
      },

      connection_lost: (message) => {
        setConnectionState('disconnected');
        setIsRecording(false);
        setIsProcessing(false);
        if (!message.intentional) {
          handleError(new Error('Connection lost'), 'websocket_connection_lost');
        }
      }
    };

    // Register all handlers
    Object.entries(messageHandlers).forEach(([type, handler]) => {
      websocketService.on(type, handler);
    });

    // Register custom message handlers
    messageHandlersRef.current.forEach((handlers, type) => {
      handlers.forEach(handler => {
        websocketService.on(type, handler);
      });
    });

    return currentSessionId;
  } catch (error) {
    setConnectionState('disconnected');
    
    // Enhanced error logging for WebSocket connection failures
    console.error('WebSocket connection failed:', error);
    
    let detailedError;
    if (error instanceof Error) {
      detailedError = error;
    } else {
      detailedError = new Error(`WebSocket connection failed: ${String(error)}`);
    }
    
    handleError(detailedError, 'connectEnhancedWebSocket');
    throw detailedError;
  }
}, [sessionId, initializeEnhancedSession, consultationId, enableAnalytics, handleError]);

  // Enhanced audio streaming with volume monitoring
  const startEnhancedAudioStreaming = useCallback(async (streamingOptions = {}) => {
    try {
      setError(null);
      const currentSessionId = await connectEnhancedWebSocket(streamingOptions);
      
      // Initialize audio stats
      audioStatsRef.current = {
        chunksSent: 0,
        bytesSent: 0,
        startTime: Date.now()
      };

      await enhancedAudioService.startEnhancedRecording({
        onDataAvailable: (audioData, stats) => {
          if (websocketService.isConnected()) {
            websocketService.sendAudioChunk(
              audioData,
              streamingOptions.language || sessionConfigRef.current.language,
              streamingOptions.provider || sessionConfigRef.current.provider,
              true
            ).then(() => {
              // Update audio stats
              audioStatsRef.current.chunksSent++;
              audioStatsRef.current.bytesSent += audioData.size;
              
              setAudioStats({
                ...audioStatsRef.current,
                duration: Date.now() - audioStatsRef.current.startTime,
                averageChunkSize: audioStatsRef.current.bytesSent / audioStatsRef.current.chunksSent
              });
            }).catch(error => {
              handleError(error, 'sendAudioChunk');
            });
          }
        },
        onVolumeChange: (volume) => {
          setVolumeLevel(volume);
        },
        onSilenceDetected: () => {
          console.log('Silence detected');
          if (enableAnalytics) {
            enhancedApiService.logEvent('silence_detected', {
              sessionId: currentSessionId,
              duration: audioStatsRef.current.duration
            });
          }
        },
        sampleRate: streamingOptions.sampleRate || sessionConfigRef.current.sampleRate,
        ...streamingOptions.audio
      });

      setIsRecording(true);
      
      if (enableAnalytics) {
        enhancedApiService.logEvent('audio_streaming_started', {
          sessionId: currentSessionId,
          ...streamingOptions,
          audioStats: audioStatsRef.current
        });
      }

      return currentSessionId;
    } catch (error) {
      handleError(error, 'startEnhancedAudioStreaming');
      throw error;
    }
  }, [connectEnhancedWebSocket, enableAnalytics, handleError]);

  // Stop audio streaming
  const stopAudioStreaming = useCallback(async () => {
    try {
      if (isRecording) {
        await enhancedAudioService.stopRecording();
        setIsRecording(false);
        
        if (enableAnalytics && sessionId) {
          enhancedApiService.logEvent('audio_streaming_stopped', {
            sessionId,
            audioStats: audioStatsRef.current
          });
        }
      }
    } catch (error) {
      handleError(error, 'stopAudioStreaming');
    }
  }, [isRecording, sessionId, enableAnalytics, handleError]);

  // Send text message
  const sendTextMessage = useCallback(async (text, messageOptions = {}) => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const options = {
        sessionId: sessionId,
        consultationId: consultationId,
        language: messageOptions.language || sessionConfigRef.current.language,
        provider: messageOptions.provider || sessionConfigRef.current.provider,
        ...messageOptions
      };

      // Add user message to UI immediately
      const userMessage = {
        id: `${Date.now()}-user`,
        sender: 'user',
        text: text,
        timestamp: Date.now(),
        type: 'text'
      };
      setMessages(prev => [...prev, userMessage]);

      if (websocketService.isConnected()) {
        // Use WebSocket if connected
        websocketService.sendTextMessage(text, options.language, options.provider);
      } else {
        // Fallback to HTTP API
        const response = await enhancedApiService.sendTextMessage(text, options);
        
        // Add assistant response
        const assistantMessage = {
          id: `${Date.now()}-assistant`,
          sender: 'assistant',
          text: response.final_response || response.text,
          timestamp: Date.now(),
          type: 'response',
          metrics: response.metrics
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsProcessing(false);
      }

      if (enableAnalytics) {
        enhancedApiService.logEvent('text_message_sent', {
          sessionId,
          textLength: text.length,
          ...options
        });
      }

    } catch (error) {
      setIsProcessing(false);
      handleError(error, 'sendTextMessage');
    }
  }, [sessionId, consultationId, enableAnalytics, handleError]);

  // Enhanced session management
  const updateSessionSettings = useCallback(async (newSettings) => {
    try {
      const oldSettings = { ...sessionConfigRef.current };
      sessionConfigRef.current = { ...sessionConfigRef.current, ...newSettings };
      
      // If language or provider changed and we're connected, reinitialize connection
      if ((newSettings.language || newSettings.provider) && connectionState === 'connected') {
        await disconnect();
        await connectEnhancedWebSocket(newSettings);
      }

      if (enableAnalytics) {
        enhancedApiService.logEvent('session_settings_updated', {
          sessionId,
          oldSettings,
          newSettings: sessionConfigRef.current
        });
      }
    } catch (error) {
      handleError(error, 'updateSessionSettings');
    }
  }, [sessionId, connectionState, connectEnhancedWebSocket, enableAnalytics, handleError]);

  // Service status monitoring
  const checkServicesStatus = useCallback(async () => {
    try {
      const status = await enhancedApiService.getServicesStatus();
      setServicesStatus(status);
      return status;
    } catch (error) {
      handleError(error, 'checkServicesStatus');
      return {};
    }
  }, [handleError]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setInterimTranscript('');
    setSpeakerLabels('');
    setError(null);
  }, []);

  // Disconnect everything
  const disconnect = useCallback(async () => {
    try {
      await stopAudioStreaming();
      websocketService.disconnect();
      enhancedAudioService.enhancedCleanup();
      setConnectionState('disconnected');
      setIsProcessing(false);
      
      if (enableAnalytics && sessionId) {
        enhancedApiService.logEvent('session_disconnected', {
          sessionId,
          connectionState,
          messagesCount: messages.length,
          audioStats: audioStatsRef.current
        });
      }
    } catch (error) {
      handleError(error, 'disconnect');
    }
  }, [stopAudioStreaming, sessionId, messages.length, enableAnalytics, handleError]);

  // Retry connection
  const retryConnection = useCallback(async () => {
    try {
      setError(null);
      await disconnect();
      await connectEnhancedWebSocket();
    } catch (error) {
      handleError(error, 'retryConnection');
    }
  }, [disconnect, connectEnhancedWebSocket, handleError]);

  // Memoized return value
  const hookValue = useMemo(() => ({
    // State
    connectionState,
    isRecording,
    isProcessing,
    sessionId,
    messages,
    interimTranscript,
    speakerLabels,
    volumeLevel,
    servicesStatus,
    connectionMetrics,
    audioStats,
    error,
    sessionConfig: sessionConfigRef.current,
    
    // Enhanced Methods
    initializeEnhancedSession,
    connectEnhancedWebSocket,
    startEnhancedAudioStreaming,
    stopAudioStreaming,
    updateSessionSettings,
    checkServicesStatus,
    sendTextMessage,
    enhancedSTT: enhancedApiService.enhancedSTT.bind(enhancedApiService),
    enhancedTTS: enhancedApiService.enhancedTTS.bind(enhancedApiService),
    
    // Message Handling
    registerMessageHandler,
    unregisterMessageHandler,
    
    // Utility Methods
    flushAudio: websocketService.sendFlushSignal.bind(websocketService),
    clearSession: enhancedApiService.clearSession.bind(enhancedApiService),
    clearConversation,
    disconnect,
    retryConnection,
    
    // Setters
    setMessages,
    setInterimTranscript,
    setSpeakerLabels,
    setError
  }), [
    connectionState,
    isRecording,
    isProcessing,
    sessionId,
    messages,
    interimTranscript,
    speakerLabels,
    volumeLevel,
    servicesStatus,
    connectionMetrics,
    audioStats,
    error,
    initializeEnhancedSession,
    connectEnhancedWebSocket,
    startEnhancedAudioStreaming,
    stopAudioStreaming,
    updateSessionSettings,
    checkServicesStatus,
    sendTextMessage,
    registerMessageHandler,
    unregisterMessageHandler,
    clearConversation,
    disconnect,
    retryConnection
  ]);

  return hookValue;
};