(function(){
  const statusEl = document.getElementById('statusIndicator');
  if (statusEl) {
    statusEl.dataset.ws = 'disconnected';
  }

  class WebSocketStreamingConversationSession {
    constructor(options = {}) {
      this.wsEndpoint = options.wsEndpoint || 'ws://localhost:8000/api/v1/conversation/stream';
      this.language = options.language || 'en-IN';
      this.provider = (options.provider || 'sarvam').toLowerCase();
      this.isActive = false;
      this.isProcessing = false;

      this.websocket = null;
      this.sessionId = options.sessionId || null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      this.pingInterval = null;
      
      // Restore consultation_id from sessionStorage on page load (survive refresh)
      if (!window.consultationId && sessionStorage.getItem('consultationId')) {
        window.consultationId = parseInt(sessionStorage.getItem('consultationId'));
        console.log('[Init] 🔄 Restored consultation_id from sessionStorage:', window.consultationId);
      }

      this.mediaRecorder = null;
      this.audioChunks = [];
      this.currentAudio = null;
      this.stream = null;
      
      // Voice Agent Mode: Track TTS playback to prevent recording during AI speech
      this.isTTSPlaying = false;
      this.shouldResumeRecordingAfterTTS = false;
      
      this.silenceThreshold = 15;
      this.speechThreshold = 35;
      this.silenceCount = 0;
      this.speechDetected = false;
      this.audioContext = null;
      this.analyser = null;
      this.recordingStartTime = null;
      this.maxRecordingTime = 180000; // 3 minutes max recording
      this.silenceTimeout = 1200; // 1.2 seconds of silence to finalize
      this.silenceTimer = null;
      this.isRecording = false;
      
      // Real-time streaming properties
      this.realtimeChunks = [];
      this.chunkBuffer = [];
      this.bufferSize = 1; // Accumulate 1 chunk (send immediately)
      this.isStreaming = false;
      this.sentFirstHeader = false; // Ensure first send includes WebM header
      this.sendFinalForSarvam = false; // Disable final WebM for Sarvam
      
      this.onSessionStart = options.onSessionStart || (() => {});
      this.onSessionEnd = options.onSessionEnd || (() => {});
      this.onSpeechStart = options.onSpeechStart || (() => {});
      this.onSpeechEnd = options.onSpeechEnd || (() => {});
      this.onTranscript = options.onTranscript || (() => {});
      this.onPartialTranscript = options.onPartialTranscript || (() => {});
      this.onResponse = options.onResponse || (() => {});
      this.onError = options.onError || (() => {});
      this.onStatusUpdate = options.onStatusUpdate || (() => {});
      
      // Dedupe/utterance tracking
      this.lastFinalText = '';
      this.lastFinalAt = 0;
      this.hasShownFinalForCurrentUtterance = false;

      this.initializeAudio();
    }
    
    // Called by UI layer when TTS playback completes or is forced to reset
    onAudioPlaybackComplete() {
      this.isProcessing = false;
      // No additional action needed; UI may choose to restart recording
    }

    // Force stop any audio and reset playback state (used by UI recovery)
    forceResetAudioState() {
      try {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.src = '';
        }
      } catch (e) {
        console.warn('[WebSocket] forceResetAudioState error:', e);
      } finally {
        this.currentAudio = null;
      }
    }
    
    async initializeAudio() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported');
        }
        
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            latency: 0.01
          }
        });
        
        if (this.stream && this.stream.active) {
          this.setupVAD();
          console.log('[WebSocket Streaming] Audio initialized successfully');
        } else {
          throw new Error('Failed to get active audio stream');
        }
        
      } catch (error) {
        console.error('[WebSocket Streaming] Audio initialization failed:', error);
        this.onError(error);
      }
    }
    
    setupVAD() {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.analyser = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(this.stream);
      
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      microphone.connect(this.analyser);
      
      const checkAudioLevel = () => {
        if (!this.isActive) {
          setTimeout(checkAudioLevel, 100);
          return;
        }
        
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        
        if (average > this.speechThreshold && !this.speechDetected && !this.isProcessing && !this.isTTSPlaying) {
          console.log('[VAD] Speech detected, average:', average.toFixed(2), 'Threshold:', this.speechThreshold);
          this.speechDetected = true;
          this.silenceCount = 0;
          this.recordingStartTime = Date.now();
          console.log('[VAD] Starting recording...');
        this.startRecording();
          this.onSpeechStart();
          
        } else if (average < this.silenceThreshold && this.speechDetected && !this.isProcessing && !this.isTTSPlaying) {
          // Start silence timer if not already started
          if (!this.silenceTimer) {
            console.log('[VAD] Silence detected, starting 3-second timer...');
            this.silenceTimer = setTimeout(() => {
              if (this.speechDetected && !this.isProcessing && !this.isTTSPlaying) {
                console.log('[VAD] 3 seconds of silence - finalizing speech');
                this.speechDetected = false;
                this.silenceCount = 0;
                this.recordingStartTime = null;
                this.silenceTimer = null;
                console.log('[VAD] Stopping recording...');
                this.stopRecording();
                // Request server flush to finalize buffered audio ASAP
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                  try {
                    this.websocket.send(JSON.stringify({ type: 'flush' }));
                  } catch (e) {
                    console.warn('[WebSocket] Flush send failed:', e);
                  }
                }
                this.onSpeechEnd();
              }
            }, this.silenceTimeout);
          }
        } else if (this.speechDetected && !this.isProcessing && !this.isTTSPlaying) {
          // Speech detected again, clear silence timer
          if (this.silenceTimer) {
            console.log('[VAD] Speech resumed, clearing silence timer');
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          
          // Check for maximum recording time
          if (this.recordingStartTime && (Date.now() - this.recordingStartTime) > this.maxRecordingTime) {
            console.log('[VAD] Maximum recording time reached, stopping...');
            this.speechDetected = false;
            this.silenceCount = 0;
            this.recordingStartTime = null;
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
            this.stopRecording();
            this.onSpeechEnd();
          }
        }
        
        // Log audio levels occasionally for debugging
        if (Math.random() < 0.01) { // Log 1% of the time
          console.log('[VAD] Audio level:', average.toFixed(2), 'Speech:', this.speechDetected, 'Processing:', this.isProcessing, 'Silence count:', this.silenceCount);
        }
        
        // Debug: Log when we're in speech mode but not recording
        if (this.speechDetected && !this.isProcessing && this.mediaRecorder?.state !== 'recording') {
          console.log('[VAD] Speech detected but not recording, MediaRecorder state:', this.mediaRecorder?.state);
        }
        
        setTimeout(checkAudioLevel, 33); // ~30fps
      };
      
      checkAudioLevel();
    }
    
    async connectWebSocket() {
      return new Promise((resolve, reject) => {
        try {
          // Get JWT token for WebSocket authentication
          const token = localStorage.getItem('access_token');
          let wsUrl = this.wsEndpoint;
          
          if (token) {
            // Add token as query parameter for WebSocket authentication
            const separator = wsUrl.includes('?') ? '&' : '?';
            wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
            console.log('[WebSocket] Connecting with JWT token');
          } else {
            console.warn('[WebSocket] No JWT token found in localStorage');
          }
          
          console.log('[WebSocket] Connecting to:', wsUrl);
          this.websocket = new WebSocket(wsUrl);
          
          this.websocket.onopen = () => {
            console.log('[WebSocket] Connected to streaming conversation');
            this.reconnectAttempts = 0;
            
            // Start ping interval to keep connection alive
            this.pingInterval = setInterval(() => {
              if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify({ type: 'ping' }));
              }
            }, 30000); // Ping every 30 seconds
            
            // Send init with session and prefs to bind WS to app session
            try {
              const initPayload = {
                type: 'init',
                session_id: this.sessionId || (window.getOrCreateSessionId && window.getOrCreateSessionId()),
                language: this.language,
                provider: this.provider
              };
              
              // Restore consultation_id from sessionStorage if page was refreshed
              if (!window.consultationId && sessionStorage.getItem('consultationId')) {
                window.consultationId = parseInt(sessionStorage.getItem('consultationId'));
                console.log('[WebSocket] ✅ Restored consultation_id from sessionStorage:', window.consultationId);
              }
              
              // Add consultation_id if available
              if (window.consultationId) {
                initPayload.consultation_id = window.consultationId;
              }
              this.websocket.send(JSON.stringify(initPayload));
            } catch (e) {
              console.warn('[WebSocket] Failed to send init:', e);
            }
            
            resolve();
          };
          
          this.websocket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log('[WebSocket] Received message:', message);
              
              // Capture db_session_id and consultation_id from connection_established message
              if (message.type === 'connection_established') {
                if (message.db_session_id) {
                  this.dbSessionId = message.db_session_id;
                  console.log('[WebSocket] ✅ Captured db_session_id from init:', this.dbSessionId);
                  // Update global currentSessionDbId
                  window.currentSessionDbId = this.dbSessionId;
                }
                if (message.consultation_id) {
                  this.consultationId = message.consultation_id;
                  console.log('[WebSocket] ✅ Captured consultation_id from init:', this.consultationId);
                  // Update global consultationId if not set
                  if (!window.consultationId) {
                    window.consultationId = this.consultationId;
                  }
                  // Persist to sessionStorage for page refresh survival
                  sessionStorage.setItem('consultationId', this.consultationId.toString());
                  console.log('[WebSocket] 💾 Persisted consultation_id to sessionStorage');
                }
              }
              
              this.handleWebSocketMessage(message);
            } catch (error) {
              console.error('[WebSocket] Message parsing error:', error);
            }
          };
          
          this.websocket.onclose = (event) => {
            console.log('[WebSocket] Connection closed:', event.code);
            
            // Clear ping interval
            if (this.pingInterval) {
              clearInterval(this.pingInterval);
              this.pingInterval = null;
            }
            
            // Only reconnect if session is still active and not a normal closure
            if (this.isActive && event.code !== 1000 && event.code !== 1001) {
              this.reconnect();
            } else if (event.code === 1000) {
              console.log('[WebSocket] Normal closure, not reconnecting');
            }
          };
          
          this.websocket.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            console.error('[WebSocket] Error details:', {
              type: error.type,
              target: error.target,
              readyState: error.target?.readyState,
              url: error.target?.url
            });
            this.onError(new Error('WebSocket connection error'));
            reject(error);
          };
          
        } catch (error) {
          console.error('[WebSocket] Connection failed:', error);
          reject(error);
        }
      });
    }
    
    async handleAIResponseChunk(text, isFinal) {
      // Stream AI response chunks to TTS in real-time
      console.log(`🎙️ [Streaming TTS] Chunk received: "${text.substring(0, 50)}..." (${text.length} chars, final: ${isFinal})`);
      
      try {
        // Build TTS request URL
        const ttsUrl = `/api/v1/tts/stream`;
        
        // Prepare request body
        const requestBody = {
          text: text,
          provider: this.provider,
          language: this.language,
          session_id: this.sessionId,
          consultation_id: window.consultationId,
          session_db_id: this.dbSessionId || window.currentSessionDbId
        };
        
        console.log(`🎙️ [Streaming TTS] Sending chunk to TTS API...`);
        
        // Fetch TTS audio stream
        const response = await fetch(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          console.error(`[Streaming TTS] TTS request failed: ${response.status}`);
          return;
        }
        
        // Stream audio playback
        await this.streamAudioPlayback(response.body, this.provider);
        
        console.log(`🎙️ [Streaming TTS] Chunk playback complete`);
        
      } catch (error) {
        console.error('[Streaming TTS] Error processing chunk:', error);
      }
    }
    
    handleWebSocketMessage(message) {
      switch (message.type) {
        case 'connection_established':
          console.log('[WebSocket] Connection confirmed:', message.message);
          this.onStatusUpdate('✅ WebSocket connected - Ready to speak');
          // Set button to green when ready
          if (this.onStatusUpdate) {
            this.onStatusUpdate('✅ Ready - Speak naturally');
          }
          break;
          
        case 'vad_signal':
          if (message.signal_type === 'START_SPEECH') {
            console.log('[WebSocket] Speech start signal received');
            // Reset per-utterance UI flags
            this.hasShownFinalForCurrentUtterance = false;
          } else if (message.signal_type === 'END_SPEECH') {
            console.log('[WebSocket] Speech end signal received');
          }
          break;
          
        case 'transcript':
          console.log('[WebSocket] Transcript received:', message.transcript);
          this.onTranscript(message.transcript);
          break;
          
        case 'streaming_transcript':
          // Handle real-time streaming transcript (interim)
          console.log('[WebSocket] Streaming transcript received:', message.transcript);
          if (message.transcript) {
            this.onPartialTranscript(message.transcript);
          }
          break;
          
        case 'final_transcript':
          // Handle final comprehensive transcript
          console.log('[WebSocket] Final transcript received:', message.transcript);
          if (message.transcript) {
            // Frontend dedupe: ignore duplicate finals within 3s window or same utterance
            const now = Date.now();
            const current = (message.transcript || '').trim().toLowerCase();
            const last = (this.lastFinalText || '').trim().toLowerCase();
            if (this.hasShownFinalForCurrentUtterance && current && last && current === last && (now - this.lastFinalAt) < 3000) {
              console.log('[WebSocket] Skipping duplicate final on client within window');
              break;
            }
            this.onTranscript(message.transcript);
            this.lastFinalText = message.transcript;
            this.lastFinalAt = now;
            this.hasShownFinalForCurrentUtterance = true;
          }
          break;
        
        case 'ai_response_chunk':
          // Handle streaming AI response chunks - send to TTS immediately
          console.log('[WebSocket] AI response chunk received:', message.text, 'is_final:', message.is_final);
          if (message.text) {
            this.handleAIResponseChunk(message.text, message.is_final);
          }
          break;
          
        case 'response':
          console.log('[WebSocket] Response received:', message.final_response);
          this.onResponse(message.final_response);
          // Generate audio for the response
          this.generateAudioForResponse(message.final_response);
          break;
          
        case 'processing_state':
          console.log('[WebSocket] Processing state:', message.is_processing);
          this.isProcessing = message.is_processing;
          if (message.is_processing) {
            this.onStatusUpdate('🤖 AI is thinking...');
            // Stop any ongoing recording
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
            this.speechDetected = false;
            this.silenceCount = 0;
          } else {
            // Don't update status if audio is currently playing
            if (!this.currentAudio) {
              this.onStatusUpdate('✅ Ready - Speak again');
            }
          }
          break;
          
        case 'error':
          console.error('[WebSocket] Server error:', message.message);
          this.onError(new Error(message.message));
          break;
          
        case 'pong':
          // Heartbeat response
          break;
          
        default:
          console.log('[WebSocket] Unknown message type:', message.type);
      }
    }
    
    async generateAudioForResponse(text) {
      try {
        // Abort any in-flight TTS fetch
        if (this.ttsAbortController) {
          try { this.ttsAbortController.abort(); } catch (_) {}
          this.ttsAbortController = null;
        }
        // Stop any currently playing audio
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio = null;
        }
        
        this.onStatusUpdate('🔊 Generating audio...');
        
        // Use streaming audio playback
        await this.streamAudioPlayback(text);
        
      } catch (error) {
        console.error('[WebSocket] Audio generation error:', error);
        this.onStatusUpdate('✅ Ready - Speak again');
      }
    }
    
    async streamAudioPlayback(text) {
      try {
        // Create abort controller to cancel on next request
        this.ttsAbortController = new AbortController();
        const formData = new FormData();
        formData.append('text', text);
        formData.append('language', this.language);
        formData.append('provider', this.provider);
        
        // Add consultation_id and session_id if available
        if (window.consultationId) {
          formData.append('consultation_id', window.consultationId);
        }
        
        if (this.sessionId) {
          formData.append('session_id', this.sessionId);
        }
        
        if (this.dbSessionId) { // Add dbSessionId for TTS logging
          console.log('[WebSocket] Adding session_db_id to TTS request:', this.dbSessionId);
          formData.append('session_db_id', this.dbSessionId);
        }
        
        // Get JWT token for authentication
        const token = localStorage.getItem('access_token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/v1/tts/stream', {
          method: 'POST',
          headers: headers,
          body: formData,
          signal: this.ttsAbortController.signal
        });
        
        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }
        
        // Stream and play chunks immediately with optimized buffering
        const reader = response.body.getReader();
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const isMp3 = contentType.includes('audio/mpeg') || contentType.includes('mpeg');
        const isWavFramed = contentType.includes('wav') || !isMp3; // Detect Sarvam WAVC format
        const mimeType = isMp3 ? 'audio/mpeg' : 'audio/wav';
        const audioQueue = [];
        const rawChunks = [];
        let coalesceBytes = 0;
        let isPlaying = false;
        let currentAudioIndex = 0;
        let hasStarted = false;
        let bufferTimer = null;
        let streamEnded = false; // Track if stream has finished receiving all chunks
        
        // 🎯 PRODUCTION-GRADE BUFFERING: Optimized for both Deepgram MP3 and Sarvam WAV
        // Deepgram: 16KB chunks = ~100ms of MP3 @ 128kbps = smooth playback, low latency
        // Sarvam: 4KB chunks = ~125ms of WAV @ 16kHz = instant start, ultra-low latency
        const START_BUFFER_SIZE = isMp3 ? 16384 : 4096;   // 16KB MP3 / 4KB WAV for first chunk
        const TARGET_BUFFER_SIZE = isMp3 ? 16384 : 4096;  // 16KB MP3 / 4KB WAV per blob
        const MAX_BUFFER_TIMEOUT = isMp3 ? 30 : 20;       // 30ms MP3 / 20ms WAV timeout
        const MIN_CHUNKS_TO_START = isMp3 ? 2 : 1;        // 2 chunks MP3 / 1 chunk WAV before playback
        
        // 🔇 Voice Agent Mode: Pause recording during TTS
        if (this.isRecording) {
          console.log('🔇 [Voice Agent] Pausing recording - AI is about to speak');
          this.stopRecording();
          this.shouldResumeRecordingAfterTTS = true;
        }
        this.isTTSPlaying = true;
        
        // Clear any pending silence timers to prevent unwanted recording stops
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        
        // Clear any buffered audio chunks to prevent echo
        this.audioChunks = [];
        this.chunkBuffer = [];
        this.realtimeChunks = [];
        
        this.onStatusUpdate('🔊 Generating audio...');
        
        const playNextChunk = () => {
          if (currentAudioIndex >= audioQueue.length || isPlaying) return;
          
          const audioBlob = audioQueue[currentAudioIndex];
          
          // Validate audio chunk before playing
          if (!audioBlob || audioBlob.size === 0) {
            console.warn(`[WebSocket] Skipping empty audio chunk ${currentAudioIndex + 1}`);
            currentAudioIndex++;
            isPlaying = false;
            playNextChunk();
            return;
          }
          
          // Check if this is the last chunk and if it's too small (might be malformed)
          if (currentAudioIndex === audioQueue.length - 1 && audioBlob.size < 1000) {
            console.warn(`[WebSocket] Last chunk is very small (${audioBlob.size} bytes) - might be malformed, skipping`);
            currentAudioIndex++;
            isPlaying = false;
            if (currentAudioIndex >= audioQueue.length) {
              this.onStatusUpdate('✅ Ready - Speak again');
              if (this.currentAudio === audioEl) {
                this.currentAudio = null;
              }
              this.ttsAbortController = null;
            } else {
              playNextChunk();
            }
            return;
          }
          
          const audioUrl = URL.createObjectURL(audioBlob);
          
          this.currentAudio = new Audio();
          const audioEl = this.currentAudio;
          audioEl.src = audioUrl;
          audioEl.preload = 'auto'; // Force immediate loading
          isPlaying = true;
          
          // 🚀 Prefetch next chunk while current is playing (reduces gaps to near-zero)
          if (currentAudioIndex + 1 < audioQueue.length) {
            const nextBlob = audioQueue[currentAudioIndex + 1];
            if (nextBlob && nextBlob.size > 0) {
              const prefetchUrl = URL.createObjectURL(nextBlob);
              const prefetchEl = new Audio(prefetchUrl);
              prefetchEl.preload = 'auto';
              prefetchEl.load(); // Start loading immediately
              // Cleanup after a short delay
              setTimeout(() => {
                URL.revokeObjectURL(prefetchUrl);
              }, 2000);
            }
          }

          audioEl.oncanplay = () => {
            if (currentAudioIndex === 0) {
              this.onStatusUpdate('🔊 Playing response...');
            }
            // Guard against teardown between load and play
            if (!this.currentAudio || audioEl !== this.currentAudio) {
              return;
            }
            audioEl.play().catch(e => {
              console.error('[WebSocket] Audio play failed:', e);
              URL.revokeObjectURL(audioUrl);
              isPlaying = false;
              playNextChunk();
            });
          };

          audioEl.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudioIndex++;
            isPlaying = false;
            
            if (currentAudioIndex < audioQueue.length) {
              // More chunks to play - immediate transition for gapless playback
              playNextChunk();
            } else if (!streamEnded) {
              // All current chunks played, but stream is still receiving more
              console.log(`[WebSocket] Waiting for more chunks... (${currentAudioIndex} played, stream still active)`);
              // Don't mark as complete yet - more chunks may arrive
            } else {
              // All chunks finished AND stream ended - TTS truly complete
              console.log('🎙️ [Voice Agent] TTS playback complete - all chunks played');
              this.isTTSPlaying = false;
              
              // Only update status when ALL chunks are finished
              setTimeout(() => {
                this.onStatusUpdate('✅ Ready - Speak again');
              }, 100);
              if (this.currentAudio === audioEl) {
                this.currentAudio = null;
              }
              // Clear abort controller when finished
              this.ttsAbortController = null;
              
              // 🎙️ Voice Agent Mode: Resume recording after TTS
              if (this.shouldResumeRecordingAfterTTS && this.isActive) {
                console.log('🎙️ [Voice Agent] Resuming recording - AI finished speaking');
                this.shouldResumeRecordingAfterTTS = false;
                // Small delay to ensure audio output is fully stopped
                setTimeout(() => {
                  if (!this.isTTSPlaying && this.isActive && !this.isRecording) {
                    // Reset VAD state for clean start
                    this.speechDetected = false;
                    this.silenceCount = 0;
                    console.log('🎙️ [Voice Agent] Listening for user speech...');
                    this.onStatusUpdate('🎙️ Listening enabled - Ready for user speech');
                  }
                }, 300);
              }
            }
          };

          audioEl.onerror = (e) => {
            console.error(`[WebSocket] Audio error for chunk ${currentAudioIndex + 1}/${audioQueue.length}:`, e);
            console.error(`[WebSocket] Audio blob size: ${audioBlob.size} bytes`);
            console.error(`[WebSocket] Audio blob type: ${audioBlob.type}`);
            URL.revokeObjectURL(audioUrl);
            currentAudioIndex++;
            isPlaying = false;
            
            // If this was the last chunk and it failed, complete the stream
            if (currentAudioIndex >= audioQueue.length) {
              console.log('[WebSocket] Last chunk failed - completing stream');
              this.isTTSPlaying = false;
              this.onStatusUpdate('✅ Ready - Speak again');
              if (this.currentAudio === audioEl) {
                this.currentAudio = null;
              }
              this.ttsAbortController = null;
              
              // 🎙️ Voice Agent Mode: Resume recording after TTS error
              if (this.shouldResumeRecordingAfterTTS && this.isActive) {
                console.log('🎙️ [Voice Agent] Resuming recording after TTS error');
                this.shouldResumeRecordingAfterTTS = false;
                setTimeout(() => {
                  if (!this.isTTSPlaying && this.isActive && !this.isRecording) {
                    this.speechDetected = false;
                    this.silenceCount = 0;
                    console.log('🎙️ [Voice Agent] Listening for user speech...');
                    this.onStatusUpdate('🎙️ Listening enabled - Ready for user speech');
                  }
                }, 300);
              }
            } else {
              playNextChunk();
            }
          };

          audioEl.load();
        };
        
        // Helper to flush coalesced buffer to audioQueue
        const flushBuffer = () => {
          if (rawChunks.length === 0) return;
          const totalLength = coalesceBytes;
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const u8 of rawChunks) {
            combined.set(u8, offset);
            offset += u8.length;
          }
          rawChunks.length = 0;
          coalesceBytes = 0;
          const audioBlob = new Blob([combined], { type: mimeType });
          audioQueue.push(audioBlob);
          
          // Production-grade playback start: buffer 2 chunks for MP3 (smoother), 1 for WAV (faster)
          if (!hasStarted && audioQueue.length >= MIN_CHUNKS_TO_START) {
            hasStarted = true;
            console.log(`[WebSocket] 🎵 Starting playback with ${audioQueue.length} chunks buffered (${isMp3 ? 'MP3' : 'WAV'})`);
            playNextChunk();
          } else if (hasStarted && !isPlaying) {
            playNextChunk();
          }
        };

        // WAVC frame parser for Sarvam TTS
        let frameBuffer = new Uint8Array(0);
        const parseWAVCFrames = (chunk) => {
          // Parse custom WAVC framing: [WAVC][4-byte length][WAV data]
          const frames = [];
          let buffer = new Uint8Array(frameBuffer.length + chunk.length);
          buffer.set(frameBuffer, 0);
          buffer.set(chunk, frameBuffer.length);
          
          let offset = 0;
          while (offset < buffer.length) {
            // Check for WAVC header
            if (offset + 8 > buffer.length) {
              // Not enough data for header, save for next chunk
              frameBuffer = buffer.slice(offset);
              break;
            }
            
            const header = String.fromCharCode(...buffer.slice(offset, offset + 4));
            if (header === 'WAVC') {
              // Read frame length (big-endian 4 bytes)
              const dataView = new DataView(buffer.buffer, buffer.byteOffset + offset + 4, 4);
              const frameLength = dataView.getUint32(0, false); // false = big-endian
              
              if (offset + 8 + frameLength > buffer.length) {
                // Not enough data for complete frame, save for next chunk
                frameBuffer = buffer.slice(offset);
                break;
              }
              
              // Extract WAV frame
              const wavData = buffer.slice(offset + 8, offset + 8 + frameLength);
              frames.push(wavData);
              offset += 8 + frameLength;
            } else {
              // No WAVC header, treat as raw audio (Deepgram MP3)
              frameBuffer = new Uint8Array(0);
              return [chunk];
            }
          }
          
          if (offset >= buffer.length) {
            frameBuffer = new Uint8Array(0);
          }
          
          return frames;
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.length > 0) {
              const u8 = value instanceof Uint8Array ? value : new Uint8Array(value);
              
              // Parse WAVC frames if using Sarvam WAV format
              if (isWavFramed) {
                const frames = parseWAVCFrames(u8);
                for (const frame of frames) {
                  rawChunks.push(frame);
                  coalesceBytes += frame.length;
                  
                  if (coalesceBytes >= TARGET_BUFFER_SIZE) {
                    flushBuffer();
                    if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
                  } else if (!bufferTimer) {
                    bufferTimer = setTimeout(() => { bufferTimer = null; flushBuffer(); }, MAX_BUFFER_TIMEOUT);
                  }
                }
              } else {
                // Direct streaming for MP3 (Deepgram)
                rawChunks.push(u8);
                coalesceBytes += u8.length;
                if (coalesceBytes >= TARGET_BUFFER_SIZE) {
                  flushBuffer();
                  if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
                } else if (!bufferTimer) {
                  bufferTimer = setTimeout(() => { bufferTimer = null; flushBuffer(); }, MAX_BUFFER_TIMEOUT);
                }
              }
            }
          }
        } finally {
          if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
          flushBuffer();
          
          // Mark stream as ended
          streamEnded = true;
          console.log(`[WebSocket] Stream ended. Total chunks: ${audioQueue.length}, Played: ${currentAudioIndex}`);
          
          // If all chunks already played, mark TTS as complete now
          if (currentAudioIndex >= audioQueue.length) {
            console.log('🎙️ [Voice Agent] TTS playback complete - stream ended with all chunks played');
            this.isTTSPlaying = false;
            
            if (audioQueue.length === 0) {
              this.onStatusUpdate('✅ Ready - Speak again');
            } else {
              setTimeout(() => {
                this.onStatusUpdate('✅ Ready - Speak again');
              }, 100);
            }
            
            if (this.currentAudio) {
              this.currentAudio = null;
            }
            this.ttsAbortController = null;
            
            // 🎙️ Voice Agent Mode: Resume recording after TTS
            if (this.shouldResumeRecordingAfterTTS && this.isActive) {
              console.log('🎙️ [Voice Agent] Resuming recording - AI finished speaking');
              this.shouldResumeRecordingAfterTTS = false;
              setTimeout(() => {
                if (!this.isTTSPlaying && this.isActive && !this.isRecording) {
                  this.speechDetected = false;
                  this.silenceCount = 0;
                  console.log('🎙️ [Voice Agent] Listening for user speech...');
                }
              }, 300);
            }
          } else {
            // There are still chunks to play - they will trigger completion in onended
            console.log(`[WebSocket] Stream ended but ${audioQueue.length - currentAudioIndex} chunks still queued for playback`);
            // Start playing if not already playing
            if (!isPlaying && hasStarted) {
              playNextChunk();
            }
          }
        }
        
      } catch (error) {
        console.error('[WebSocket] Audio error:', error);
        this.isTTSPlaying = false;
        this.onStatusUpdate('✅ Ready - Speak again');
        
        // 🎙️ Voice Agent Mode: Resume recording after error
        if (this.shouldResumeRecordingAfterTTS && this.isActive) {
          console.log('🎙️ [Voice Agent] Resuming recording after error');
          this.shouldResumeRecordingAfterTTS = false;
          setTimeout(() => {
            if (!this.isTTSPlaying && this.isActive && !this.isRecording) {
              this.speechDetected = false;
              this.silenceCount = 0;
            }
          }, 300);
        }
      }
    }
    
    
    async reconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.onError(new Error('WebSocket connection failed after multiple attempts'));
        this.isActive = false;
        return;
      }
      
      if (!this.isActive) {
        console.log('[WebSocket] Not active, skipping reconnection');
        return;
      }
      
      this.reconnectAttempts++;
      console.log(`[WebSocket] Reconnecting... attempt ${this.reconnectAttempts}`);
      
      setTimeout(async () => {
        if (!this.isActive) {
          console.log('[WebSocket] Not active during reconnection, aborting');
          return;
        }
        
        try {
          await this.connectWebSocket();
        } catch (error) {
          console.error('[WebSocket] Reconnection failed:', error);
          if (this.isActive) {
            this.reconnect();
          }
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    }
    
    async startSession() {
      if (this.isActive) {
        console.log('[WebSocket] Session already active');
        return;
      }
      
      console.log('[WebSocket] Starting conversation session');
      
      try {
        await this.connectWebSocket();
        
        this.isActive = true;
        this.isProcessing = false;
        this.speechDetected = false;
        this.silenceCount = 0;
        this.isRecording = false;
        this.isStreaming = false;
        this.chunkBuffer = [];
        this.silenceTimer = null;
        this.recordingStartTime = null;
        
        // Clear timers
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        this.onSessionStart();
        this.onStatusUpdate('✅ Ready - Speak naturally');
        
      } catch (error) {
        console.error('[WebSocket] Session start failed:', error);
        this.onError(error);
      }
    }
    
    stopSession() {
      if (!this.isActive) {
        console.log('[WebSocket] Session already inactive');
        return;
      }
      
      console.log('[WebSocket] Stopping conversation session');
      this.isActive = false;
      this.speechDetected = false;
      this.isProcessing = false;
      this.silenceCount = 0;
      this.isRecording = false;
      this.isStreaming = false;
      this.chunkBuffer = [];
      this.recordingStartTime = null;
      
      // Clear timers
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
      
      if (this.websocket) {
        try {
          this.websocket.send(JSON.stringify({ type: 'stop' }));
        } catch (_) {}
        this.websocket.close(1000, 'Session ended');
        this.websocket = null;
      }
      
      // Clear ping interval
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      this.onSessionEnd();
      this.onStatusUpdate('Session ended');
    }
    
    startRecording() {
      console.log('[WebSocket] startRecording called, stream:', !!this.stream, 'isProcessing:', this.isProcessing, 'isRecording:', this.isRecording, 'isTTSPlaying:', this.isTTSPlaying);
      
      // Voice Agent Mode: Block recording during TTS playback
      if (this.isTTSPlaying) {
        console.log('🔇 [Voice Agent] Cannot start recording - AI is speaking');
        this.shouldResumeRecordingAfterTTS = true; // Resume when TTS finishes
        this.onStatusUpdate('🔇 Listening disabled - AI is speaking');
        return;
      }
      
      if (!this.stream || this.isProcessing || this.isRecording) {
        console.log('[WebSocket] Cannot start recording - stream:', !!this.stream, 'isProcessing:', this.isProcessing, 'isRecording:', this.isRecording);
            return;
          }
          
      try {
        this.audioChunks = [];
        this.isRecording = true;
        this.isStreaming = false;
        this.chunkBuffer = [];
        this.realtimeChunks = [];
        this.sentFirstHeader = false;
        
        // Try different audio formats for better compatibility
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
          }
        }
        
        console.log('[WebSocket] Using audio format:', mimeType);
        console.log('[WebSocket] Stream tracks:', this.stream.getTracks().length);
        
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: mimeType,
          audioBitsPerSecond: 128000
        });
        
        this.mediaRecorder.ondataavailable = (event) => {
          console.log('[WebSocket] Data available, size:', event.data.size);
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
            console.log('[WebSocket] Audio chunks:', this.audioChunks.length);
            
            // Send chunks in real-time for streaming processing
            // Do NOT send WebM for Sarvam or Deepgram; both use PCM16 + WAV header
            const prov = (typeof this.provider === 'string' ? this.provider.toLowerCase() : '');
            const isSarvam = prov.includes('sarvam');
            const isDeepgram = prov.includes('deepgram');
            if (!isSarvam && !isDeepgram) {
              this.sendAudioChunkRealTime(event.data);
            }
          }
        };
        
        this.mediaRecorder.onstop = () => {
          console.log('[WebSocket] Recording stopped, processing final audio...');
          this.isRecording = false;
          // Final audio will be sent explicitly via sendFinalAudio()
        };
        
        this.mediaRecorder.onerror = (error) => {
          console.error('[WebSocket] MediaRecorder error:', error);
          this.isRecording = false;
          this.onError(error);
        };
        
        this.mediaRecorder.onstart = () => {
          console.log('[WebSocket] Recording started successfully');
        };
        
        console.log('[WebSocket] Starting MediaRecorder...');
        this.mediaRecorder.start(100);
        // Start PCM streaming for Sarvam and Deepgram interim captions
        try {
          const isSarvam = typeof this.provider === 'string' && this.provider.toLowerCase().includes('sarvam');
          const isDeepgram = typeof this.provider === 'string' && this.provider.toLowerCase().includes('deepgram');
          if ((isSarvam || isDeepgram) && this.audioContext) {
            this.audioContext.resume && this.audioContext.resume();
            const bufferSize = 2048;
            this.pcmProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            this.pcmSource = this.audioContext.createMediaStreamSource(this.stream);
            this.pcmSource.connect(this.pcmProcessor);
            this.pcmProcessor.connect(this.audioContext.destination);
            this.pcmProcessor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const pcm = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) {
                let s = Math.max(-1, Math.min(1, input[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              // Log once in a while to confirm activity
              if (Math.random() < 0.01) console.log('[WebSocket] PCM chunk size:', pcm.byteLength);
              this.sendPcmChunk(pcm);
            };
            console.log('[WebSocket] PCM streaming started (', isSarvam ? 'sarvam' : 'deepgram', ')');
          }
        } catch (e) {
          console.warn('[WebSocket] PCM streaming setup failed:', e);
        }
        this.onStatusUpdate('🎤 Listening...');
        
      } catch (error) {
        console.error('[WebSocket] Recording start failed:', error);
        this.isRecording = false;
        this.onError(error);
      }
    }
    
    stopRecording() {
      console.log('[WebSocket] stopRecording called, MediaRecorder state:', this.mediaRecorder?.state, 'isRecording:', this.isRecording);
      
      // Clear silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.log('[WebSocket] Stopping MediaRecorder...');
        this.mediaRecorder.stop();
        this.onStatusUpdate('⚙️ Processing speech...');
        
        // Send final chunk if streaming
        if (this.isStreaming && this.chunkBuffer.length > 0) {
          this.processChunkBuffer();
        }
        
        // Send final audio for complete processing
        const isSarvam = typeof this.provider === 'string' && this.provider.toLowerCase().includes('sarvam');
        const isDeepgram = typeof this.provider === 'string' && this.provider.toLowerCase().includes('deepgram');
        // If Deepgram already produced a final recently, skip sending final_audio to avoid duplicate
        const now = Date.now();
        const shouldSkipFinal = isDeepgram && this.hasShownFinalForCurrentUtterance && (now - this.lastFinalAt) < 2000;
        if ((!isSarvam || this.sendFinalForSarvam) && !shouldSkipFinal) {
          this.sendFinalAudio();
        } else if (shouldSkipFinal) {
          console.log('[WebSocket] Skipping final_audio send due to recent final (Deepgram)');
        }
      } else {
        console.log('[WebSocket] MediaRecorder not recording, state:', this.mediaRecorder?.state);
        this.isRecording = false;
      }

      // Tear down PCM streaming if active
      if (this.pcmProcessor) {
        try { this.pcmProcessor.disconnect(); } catch (e) {}
        this.pcmProcessor = null;
      }
      if (this.pcmSource) {
        try { this.pcmSource.disconnect(); } catch (e) {}
        this.pcmSource = null;
      }
    }
    
    async sendFinalAudio() {
      try {
        if (this.audioChunks.length === 0) return;
        
        const finalAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Send final audio to WebSocket for complete processing
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          
          if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
              this.websocket.send(JSON.stringify({
                type: 'final_audio',
                audio: base64,
                language: this.language,
                provider: this.provider,
                is_streaming: false
              }));
              console.log('[WebSocket] Final audio sent for complete processing');
            } catch (error) {
              console.error('[WebSocket] Error sending final audio:', error);
            }
          }
        };
        reader.readAsDataURL(finalAudioBlob);
        
      } catch (error) {
        console.error('[WebSocket] Error in final audio processing:', error);
      }
    }
    
    async sendAudioChunkRealTime(audioChunk) {
      try {
        if (!this.isStreaming && this.audioChunks.length >= this.bufferSize) {
          // Start streaming mode
          this.isStreaming = true;
          console.log('[WebSocket] Starting real-time streaming mode');
        }
        
        if (this.isStreaming) {
          // Add to buffer
          this.chunkBuffer.push(audioChunk);
          
          // Process buffer when it has enough chunks
          if (this.chunkBuffer.length >= this.bufferSize) {
            await this.processChunkBuffer();
          }
        }
        
      } catch (error) {
        console.error('[WebSocket] Error in real-time streaming:', error);
      }
    }
    
    async processChunkBuffer() {
      if (this.chunkBuffer.length === 0 || this.isProcessing) return;
      
      try {
        // Only use WebM chunking for non-Sarvam/Deepgram providers
        const prov = (typeof this.provider === 'string' ? this.provider.toLowerCase() : '');
        const isSarvam = prov.includes('sarvam');
        const isDeepgram = prov.includes('deepgram');
        if (isSarvam || isDeepgram) {
          // PCM path sends via sendPcmChunk; skip WebM chunking
          this.chunkBuffer = [];
          return;
        }
        // For the very first send, include initial chunks (with header) to avoid invalid WebM header
        let combinedBlob;
        if (!this.sentFirstHeader) {
          combinedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.sentFirstHeader = true;
        } else {
          // Create a combined chunk from buffer
          combinedBlob = new Blob(this.chunkBuffer, { type: 'audio/webm' });
        }
        
        // Clear buffer
        this.chunkBuffer = [];
        
        // Send to WebSocket for real-time processing
        await this.sendChunkToWebSocket(combinedBlob);
        
      } catch (error) {
        console.error('[WebSocket] Error processing chunk buffer:', error);
      }
    }
    
    async sendChunkToWebSocket(audioBlob) {
      try {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          
          // Send audio chunk via WebSocket for streaming processing
          if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
              this.websocket.send(JSON.stringify({
                type: 'audio_chunk',
                audio: base64,
                language: this.language,
                provider: this.provider,
                is_streaming: true
              }));
              console.log('[WebSocket] Audio chunk sent for real-time processing');
            } catch (error) {
              console.error('[WebSocket] Error sending audio chunk:', error);
            }
          }
        };
        reader.readAsDataURL(audioBlob);
        
      } catch (error) {
        console.error('[WebSocket] Error in chunk processing:', error);
      }
    }

    sendPcmChunk(pcmInt16) {
      try {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        // Only send PCM for Sarvam/Deepgram providers
        const prov = (typeof this.provider === 'string' ? this.provider.toLowerCase() : '');
        const isSarvam = prov.includes('sarvam');
        const isDeepgram = prov.includes('deepgram');
        if (!isSarvam && !isDeepgram) return;
        // Convert Int16Array to base64
        const u8 = new Uint8Array(pcmInt16.buffer);
        let binary = '';
        for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
        const b64 = btoa(binary);
        this.websocket.send(JSON.stringify({
          type: 'audio_chunk',
          audio: b64,
          language: this.language,
          provider: this.provider,
          is_streaming: true,
          encoding: 'pcm',
          sample_rate: 16000
        }));
      } catch (e) {
        console.warn('[WebSocket] PCM chunk send failed:', e);
      }
    }
    
    async processAudio() {
      if (this.audioChunks.length === 0 || this.isProcessing) return;
      
      this.isProcessing = true;
      this.onStatusUpdate('⚙️ Processing speech...');
      
      try {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        console.log('[WebSocket] Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: this.audioChunks.length
        });
        
        // Validate audio blob size
        if (audioBlob.size < 1000) {
          console.warn('[WebSocket] Audio blob too small, might be empty');
          this.onError(new Error('Audio too short, please speak longer'));
          return;
        }
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          
          console.log('[WebSocket] Audio base64 length:', base64.length);
          
          // Send audio data via WebSocket
          if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
              this.websocket.send(JSON.stringify({
                type: 'audio_data',
                audio: base64,
                language: this.language,
                provider: this.provider
              }));
              console.log('[WebSocket] Audio data sent for processing');
            } catch (error) {
              console.error('[WebSocket] Error sending audio data:', error);
              this.onError(new Error('Failed to send audio data'));
            }
          } else {
            console.error('[WebSocket] Connection not ready, state:', this.websocket?.readyState);
            this.onError(new Error('WebSocket connection not ready'));
          }
        };
        reader.readAsDataURL(audioBlob);
        
      } catch (error) {
        console.error('[WebSocket] Audio processing error:', error);
        this.onError(error);
      } finally {
        this.isProcessing = false;
        this.audioChunks = [];
      }
    }
    
    destroy() {
      this.stopSession();
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      if (this.audioContext) {
        this.audioContext.close();
      }
    }
  }

  window.WebSocketStreamingConversationSession = WebSocketStreamingConversationSession;
})();