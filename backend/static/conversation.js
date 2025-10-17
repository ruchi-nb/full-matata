const micBtn = document.getElementById('toggleMic');
const camBtn = document.getElementById('toggleCam');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const userVideo = document.getElementById('userVideo');
const statusIndicator = document.getElementById('statusIndicator');
const languageSelect = document.getElementById('languageSelect');
const providerSelect = document.getElementById('providerSelect');

// Language mappings for different providers
const providerLanguages = {
  'sarvam': [
    { value: 'en-IN', text: 'English' },
    { value: 'hi-IN', text: 'Hindi' },
    { value: 'bn-IN', text: 'Bengali' },
    { value: 'gu-IN', text: 'Gujarati' },
    { value: 'kn-IN', text: 'Kannada' },
    { value: 'ml-IN', text: 'Malayalam' },
    { value: 'mr-IN', text: 'Marathi' },
    { value: 'pa-IN', text: 'Punjabi' },
    { value: 'ta-IN', text: 'Tamil' },
    { value: 'te-IN', text: 'Telugu' }
  ],
  'deepgram': [
    { value: 'multi', text: 'Multi-Language' },
    { value: 'en', text: 'English' },
    { value: 'hi', text: 'Hindi' }
  ]
};

// Update language options based on selected provider
function updateLanguageOptions() {
  const provider = providerSelect.value;
  const languages = providerLanguages[provider] || providerLanguages['deepgram'];
  
  // Clear existing options
  languageSelect.innerHTML = '';
  
  // Add new options
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.value;
    option.textContent = lang.text;
    languageSelect.appendChild(option);
  });
  
  // Set default selection
  if (provider === 'sarvam') {
    languageSelect.value = 'en-IN';
  } else {
    languageSelect.value = 'multi';
  }
}

// Initialize language options
updateLanguageOptions();

// Update language options when provider changes
providerSelect.addEventListener('change', () => {
  updateLanguageOptions();
  
  // Update streaming session if active
  if (streamingSession) {
    streamingSession.provider = providerSelect.value;
    streamingSession.language = languageSelect.value;
  }
});

// Update streaming session language when language changes
languageSelect.addEventListener('change', () => {
  if (streamingSession) {
    streamingSession.language = languageSelect.value;
  }
});
const clearSessionBtn = document.getElementById('clearSession');
const sessionInfoBtn = document.getElementById('sessionInfo');
const forceReadyBtn = document.getElementById('forceReady');
const endConversationBtn = document.getElementById('endConversation');

let micEnabled = false;
let camEnabled = true;
let stream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentAudio = null;
let streamingSession = null;
let isStreamingMode = false;
let currentSessionId = null; // Track current session ID
let currentSessionDbId = null; // Track current database session ID for API logging
let isStartingStreaming = false; // Prevent multiple simultaneous starts
let statusCheckInterval = null;
let lastStatusUpdate = Date.now();
let interimTranscriptBuffer = '';
let isUtteranceActive = false;
let accumulatedTranscript = '';
let lastPartialRaw = '';
let accumulatedParts = [];
let isTTSActive = false; // Flag to prevent status monitoring from interrupting TTS

// Generate or get current session ID
function getOrCreateSessionId() {
  if (!currentSessionId) {
    currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Created new session:', currentSessionId);
  }
  return currentSessionId;
}

// Make function available globally for WebSocket streaming
window.getOrCreateSessionId = getOrCreateSessionId;

// Clear current session
function clearCurrentSession() {
  currentSessionId = null;
  currentSessionDbId = null;
  console.log('Session cleared (including DB session ID)');
}

async function initUserVideo() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    userVideo.srcObject = stream;
    updateStatus('Camera and microphone ready');
  } catch (err) {
    addMessage('system', 'Could not access webcam/mic: ' + err.message);
    updateStatus('Camera/mic access denied');
  }
}
initUserVideo();

function updateStatus(message) {
  statusIndicator.textContent = message;
  lastStatusUpdate = Date.now();
  console.log('Status updated:', message);
  
  // Start status monitoring if we're in a potentially stuck state
  if (message.includes('🔊 Playing response') || message.includes('🔊 Generating audio') || message.includes('🔊 Receiving audio chunks')) {
    startStatusMonitoring();
  } else {
    stopStatusMonitoring();
  }
}

function startStatusMonitoring() {
  if (statusCheckInterval) return; // Already monitoring
  
  console.log('Starting status monitoring');
  statusCheckInterval = setInterval(() => {
    const timeSinceUpdate = Date.now() - lastStatusUpdate;
    const currentStatus = statusIndicator.textContent;
    
    // Different timeouts for different operations
    const isTTSOperation = currentStatus.includes('🔊 Playing response') || 
                          currentStatus.includes('🔊 Generating audio') || 
                          currentStatus.includes('🔊 Receiving audio chunks');
    
    // TTS operations get longer timeout (30 seconds) since they can take time
    const timeoutThreshold = isTTSOperation ? 30000 : 15000;
    
    if (timeSinceUpdate > timeoutThreshold && isTTSOperation) {
      console.log(`TTS operation timeout (${timeoutThreshold/1000}s) - checking if still active`);
      // For TTS, check if audio is actually playing before forcing recovery
      if (!isTTSActive || !currentAudio || currentAudio.paused || currentAudio.ended) {
        console.log('TTS audio is not playing - forcing recovery');
        forceStatusRecovery();
      } else {
        console.log('TTS audio is still playing - extending timeout');
        lastStatusUpdate = Date.now(); // Reset the timer
      }
    } else if (timeSinceUpdate > 15000 && !isTTSOperation) {
      console.log('Non-TTS operation timeout - forcing recovery');
      forceStatusRecovery();
    }
    
    // Absolute maximum timeout (60 seconds) for any operation
    if (timeSinceUpdate > 60000) {
      console.log('Absolute timeout reached - forcing recovery');
      forceStatusRecovery();
    }
  }, 5000); // Check every 5 seconds
}

function stopStatusMonitoring() {
  if (statusCheckInterval) {
    console.log('Stopping status monitoring');
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

function forceStatusRecovery() {
  console.log('Forcing status recovery');
  
  // Check if we're currently in TTS streaming mode
  const isCurrentlyPlayingTTS = currentAudio && !currentAudio.paused && 
    (statusIndicator.textContent.includes('🔊 Playing response') || 
     statusIndicator.textContent.includes('🔊 Generating audio') ||
     statusIndicator.textContent.includes('🔊 Receiving audio chunks'));
  
  if (isCurrentlyPlayingTTS) {
    console.log('TTS is currently playing - allowing it to complete naturally');
    // Don't interrupt TTS playback, just extend the monitoring timeout
    lastStatusUpdate = Date.now(); // Reset the timer
    return;
  }
  
  // Stop any playing audio only if it's not TTS
  if (currentAudio && !isCurrentlyPlayingTTS) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  // Reset status
  if (isStreamingMode) {
    updateStatus('✅ Ready - Speak again');
    micBtn.style.backgroundColor = '#4CAF50';
    if (streamingSession) {
      streamingSession.onAudioPlaybackComplete();
      setTimeout(() => {
        if (isStreamingMode && streamingSession) {
          console.log('Auto-restarting WebSocket STT after forced recovery');
          streamingSession.startRecording();
        }
      }, 500);
    }
  } else {
    updateStatus('✅ Ready');
  }
  
  addMessage('system', 'Status automatically recovered from stuck state');
}

micBtn.addEventListener('click', () => {
  if (!isStreamingMode) {
    startStreamingMode();
  } else {
    stopStreamingMode();
  }
});

function startStreamingMode() {
  if (isStreamingMode) {
    console.log('Streaming mode already active');
    return;
  }
  
  if (isStartingStreaming) {
    console.log('Streaming mode is already starting, please wait...');
    return;
  }
  
  console.log('Starting streaming mode...');
  isStartingStreaming = true;
  isStreamingMode = true;
  micBtn.textContent = '🔴 Starting...';
  micBtn.classList.add('realtime');
  micBtn.disabled = true; // Disable during startup
  
  if (!streamingSession) {
    const sessionId = getOrCreateSessionId();
    console.log('Creating streaming session with ID:', sessionId);
    streamingSession = new WebSocketStreamingConversationSession({
      language: languageSelect.value,
      provider: providerSelect.value,
      sessionId: sessionId,
      
      onSessionStart: () => {
        console.log('WebSocket session started successfully');
        isStartingStreaming = false; // Reset the starting flag
        updateStatus('🎤 Session active - Speak naturally');
        micBtn.textContent = '🔴 Streaming ON';
        micBtn.style.backgroundColor = '#4CAF50';
        micBtn.disabled = false;
      },
      
      onSpeechStart: () => {
        updateStatus('🎤 Listening...');
        micBtn.style.backgroundColor = '#ff8800'; // Orange when recording
        interimTranscriptBuffer = '';
        isUtteranceActive = true;
        accumulatedTranscript = '';
        lastPartialRaw = '';
        accumulatedParts = [];
      },
      
      onSpeechEnd: () => {
        updateStatus('⚙️ Processing speech...');
        micBtn.style.backgroundColor = '#ff4444'; // Red when processing
      },
      
      onPartialTranscript: (partial) => {
        // Merge into a single live caption (replace, not append)
        if (!partial) return;
        const newText = partial.trim();
        const prevText = lastPartialRaw.trim();
        const lastPart = accumulatedParts.length > 0 ? accumulatedParts[accumulatedParts.length - 1] : '';

        // Decide whether this partial is a cumulative refinement of lastPart or a new segment
        const looksCumulative = lastPart && newText.length >= lastPart.length && (
          newText.startsWith(lastPart) ||
          newText.includes(lastPart.slice(0, Math.max(1, Math.floor(lastPart.length * 0.6))))
        );

        if (accumulatedParts.length === 0) {
          accumulatedParts.push(newText);
        } else if (looksCumulative) {
          // Replace last part with refined cumulative text
          accumulatedParts[accumulatedParts.length - 1] = newText;
        } else {
          // New segment: avoid duplicate tail/overlap
          if (!lastPart.endsWith(newText) && !newText.endsWith(lastPart)) {
            accumulatedParts.push(newText);
          }
        }

        lastPartialRaw = newText;
        accumulatedTranscript = accumulatedParts.join(' ').replace(/\s+/g, ' ').trim();
        interimTranscriptBuffer = accumulatedTranscript;
        const langLabel = languageSelect.options[languageSelect.selectedIndex].text;
        const captionId = 'live-caption';
        let el = document.getElementById(captionId);
        if (!el) {
          el = document.createElement('div');
          el.id = captionId;
          el.style.margin = '8px 0';
          el.style.opacity = '0.85';
          chatMessages.appendChild(el);
        }
        el.textContent = `You: ${interimTranscriptBuffer} (${langLabel})`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },

      onTranscript: (finalTranscript) => {
        // Finalize the utterance: replace live caption with a single combined user message
        const langLabel = languageSelect.options[languageSelect.selectedIndex].text;
        const joined = accumulatedParts.join(' ').replace(/\s+/g, ' ').trim();
        const candFinal = (finalTranscript || '').trim();
        const candJoined = joined || accumulatedTranscript || interimTranscriptBuffer || '';
        // Prefer the more complete candidate by length/word-count
        const pick = (a, b) => {
          const aw = (a.match(/\S+/g) || []).length;
          const bw = (b.match(/\S+/g) || []).length;
          if (aw === bw) return a.length >= b.length ? a : b;
          return aw > bw ? a : b;
        };
        const text = pick(candFinal, candJoined).trim();
        const captionEl = document.getElementById('live-caption');
        if (captionEl) captionEl.remove();
        if (text) addMessage('user', `${text} (${langLabel})`);
        interimTranscriptBuffer = '';
        isUtteranceActive = false;
        accumulatedTranscript = '';
        lastPartialRaw = '';
        accumulatedParts = [];
      },
      
      onResponse: (response) => {
        addMessage('doctor', response);
        // TTS is handled inside websocket-streaming-conversation.js (generateAudioForResponse)
      },
      
      onStatusUpdate: (status) => {
        updateStatus(status);
      },
      
      onError: (error) => {
        console.error('Streaming error:', error);
        isStartingStreaming = false; // Reset the starting flag on error
        addMessage('system', 'Speech error: ' + error.message);
        updateStatus('❌ Error - Try again');
        micBtn.textContent = '🎤 Start Recording';
        micBtn.classList.remove('realtime');
        micBtn.style.backgroundColor = '#ff4444'; // Red for error
        micBtn.disabled = false; // Re-enable button on error
        isStreamingMode = false; // Reset streaming mode
        
        // Force reset audio state on error
        if (streamingSession) {
          streamingSession.forceResetAudioState();
          streamingSession = null; // Clear the session
        }
        
        setTimeout(() => {
          updateStatus('✅ Ready');
          micBtn.style.backgroundColor = ''; // Reset button color
        }, 3000);
      }
    });
  }
  
  // Start the session with a timeout
  setTimeout(() => {
    if (streamingSession && isStreamingMode) {
      streamingSession.startSession();
    }
  }, 100);
  
  // Add a timeout to prevent hanging during startup
  setTimeout(() => {
    if (isStartingStreaming) {
      console.log('Streaming startup timeout - resetting state');
      isStartingStreaming = false;
      isStreamingMode = false;
      micBtn.textContent = '🎤 Start Recording';
      micBtn.classList.remove('realtime');
      micBtn.style.backgroundColor = '';
      micBtn.disabled = false;
      updateStatus('Streaming startup timeout - try again');
      if (streamingSession) {
        streamingSession = null;
      }
    }
  }, 10000); // 10 second timeout for startup
}

function stopStreamingMode() {
  if (!isStreamingMode && !isStartingStreaming) {
    console.log('Streaming mode already inactive');
    return;
  }
  
  console.log('Stopping streaming mode...');
  isStreamingMode = false;
  isStartingStreaming = false; // Reset the starting flag
  micBtn.textContent = '🎤 Start Recording';
  micBtn.classList.remove('realtime');
  micBtn.style.backgroundColor = '';
  micBtn.disabled = false;
  updateStatus('Streaming mode disabled');
  
  // Stop any playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  // Stop status monitoring
  stopStatusMonitoring();
  
  if (streamingSession) {
    streamingSession.stopSession();
    streamingSession.forceResetAudioState();
    streamingSession = null; // Clear the session reference
  }
}

async function generateAudioResponse(text, retryCount = 0) {
  const maxRetries = 2;
  
  try {
    updateStatus('🔊 Generating audio...');
    
    // Global timeout fallback - force status update if stuck
    const globalTimeout = setTimeout(() => {
      console.log('Global audio timeout - forcing status update');
      if (isStreamingMode) {
        updateStatus('✅ Ready - Speak again');
        micBtn.style.backgroundColor = '#4CAF50';
        if (streamingSession) {
          streamingSession.onAudioPlaybackComplete();
          setTimeout(() => {
            if (isStreamingMode && streamingSession) {
              console.log('Auto-restarting WebSocket STT after global timeout');
              streamingSession.startRecording();
            }
          }, 500);
        }
      } else {
        updateStatus('✅ Ready');
      }
    }, 30000); // 30 second global timeout (increased to allow for longer audio)
    
    await streamAudioPlayback(text);
    
    // Clear the global timeout if audio completes normally
    clearTimeout(globalTimeout);
  } catch (error) {
    console.error('Audio generation error:', error);
    
    // Retry logic for audio generation failures
    if (retryCount < maxRetries) {
      console.log(`Retrying audio generation (attempt ${retryCount + 1}/${maxRetries})`);
      updateStatus(`🔊 Retrying audio generation... (${retryCount + 1}/${maxRetries})`);
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry with incremented count
      return generateAudioResponse(text, retryCount + 1);
    }
    
    // Max retries reached - give up and reset status
    console.log('Max retries reached for audio generation');
    updateStatus('Audio generation failed - using text response');
    
    // Force status update on error
    if (isStreamingMode) {
      updateStatus('✅ Ready - Speak again');
      micBtn.style.backgroundColor = '#4CAF50';
      if (streamingSession) {
        streamingSession.onAudioPlaybackComplete();
        setTimeout(() => {
          if (isStreamingMode && streamingSession) {
            console.log('Auto-restarting WebSocket STT after audio error');
            streamingSession.startRecording();
          }
        }, 500);
      }
    } else {
      updateStatus('✅ Ready');
    }
    
    // Add a message to inform user about the issue
    addMessage('system', 'Audio generation failed - continuing with text conversation');
  }
}

async function streamAudioPlayback(text) {
  try {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', languageSelect.value);
    formData.append('provider', providerSelect.value);
    
    // Add consultation_id and session_id if available
    if (window.consultationId) {
      formData.append('consultation_id', window.consultationId);
    }
    
    const sessionId = getOrCreateSessionId();
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    
    // Add session_db_id if available for API logging
    if (currentSessionDbId) {
      console.log('Adding session_db_id to TTS request:', currentSessionDbId);
      formData.append('session_db_id', currentSessionDbId);
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
      body: formData 
    });
    
    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const contentType = response.headers.get('content-type') || '';
    const isDeepgram = providerSelect.value.toLowerCase() === 'deepgram';
    
    updateStatus('🔊 Generating audio...');
    
    if (isDeepgram) {
      // Optimized real-time Deepgram audio playback
      isTTSActive = true; // Mark TTS as active
      const rawChunks = [];
      const audioQueue = [];
      let isPlaying = false;
      let currentAudioIndex = 0;
      let streamCompleted = false;
      let streamTimeout = null;
      let bufferTimeout = null;
      let hasStartedPlaying = false;
      let queuedBytes = 0; // bytes of audio currently queued but not yet played
      let underrunCount = 0; // number of times playback had to wait for more data
      let adaptiveBoostApplied = false; // ensure we only boost once per stream
      let chunkCount = 0;
      let lastChunkTime = Date.now();
      
      // Ultra-low latency playback thresholds for Deepgram
      let START_BUFFER_SIZE = 512;   // Start as soon as ~0.5KB is available
      let MIN_BUFFER_SIZE = 256;     // Emit blobs with ~0.25KB minimum
      let MAX_BUFFER_SIZE = 4096;    // Cap per blob to avoid huge buffers
      let BUFFER_TIMEOUT = 0;        // No coalescing delay
      
      const createAudioBuffer = () => {
        if (rawChunks.length === 0) return null;
        
        // Combine raw chunks into a larger buffer
        const totalLength = rawChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of rawChunks) {
          combinedArray.set(chunk, offset);
          offset += chunk.length;
        }
        
        const audioBlob = new Blob([combinedArray], { type: 'audio/mpeg' });
        rawChunks.length = 0; // Clear the raw chunks
        
        console.log(`Created Deepgram audio buffer: ${totalLength} bytes`);
        return audioBlob;
      };
      
      const playNextChunk = () => {
        if (currentAudioIndex >= audioQueue.length || isPlaying) return;
        // Start immediately without waiting for extra buffer
        
        const audioBlob = audioQueue[currentAudioIndex];
        const audioUrl = URL.createObjectURL(audioBlob);
        
        currentAudio = new Audio();
        currentAudio.src = audioUrl;
        isPlaying = true;
        
        currentAudio.preload = 'auto';
        currentAudio.oncanplay = () => {
          if (!hasStartedPlaying) {
            updateStatus('🔊 Playing response...');
            hasStartedPlaying = true;
          }
          currentAudio.play().catch(e => {
            console.error('Deepgram audio play failed:', e);
            handleDeepgramAudioCompletion();
          });
        };
        
        currentAudio.onended = () => {
          console.log(`Deepgram audio buffer ${currentAudioIndex + 1} ended`);
          URL.revokeObjectURL(audioUrl);
          queuedBytes = Math.max(0, queuedBytes - audioBlob.size);
          currentAudioIndex++;
          isPlaying = false;
          
          if (currentAudioIndex < audioQueue.length) {
            playNextChunk();
          } else if (streamCompleted) {
            console.log('All Deepgram audio buffers completed');
            handleDeepgramAudioCompletion();
          } else {
            console.log('Waiting for more Deepgram audio...');
            // Adaptive buffering: if we hit this path, increase thresholds to smooth playback
            underrunCount++;
            if (!adaptiveBoostApplied && underrunCount >= 2) {
              adaptiveBoostApplied = true;
              START_BUFFER_SIZE = 4096;  // ~4KB (still aggressive)
              MIN_BUFFER_SIZE = 2048;    // ~2KB (still aggressive)
              MAX_BUFFER_SIZE = 8192;    // ~8KB (still aggressive)
              BUFFER_TIMEOUT = 50;       // allow a bit more coalescing (still aggressive)
              console.log('Adaptive buffering: increased thresholds for smoother playback');
            }
            // Set a timeout to force completion if no more chunks arrive
            setTimeout(() => {
              if (!streamCompleted && currentAudioIndex >= audioQueue.length) {
                console.log('No more Deepgram audio received - forcing completion');
                streamCompleted = true;
                handleDeepgramAudioCompletion();
              }
            }, 1500); // Wait 1.5 seconds for more audio
          }
        };
        
        currentAudio.onerror = () => {
          console.log(`Deepgram audio buffer ${currentAudioIndex + 1} error`);
          URL.revokeObjectURL(audioUrl);
          currentAudioIndex++;
          isPlaying = false;
          
          if (currentAudioIndex < audioQueue.length) {
            playNextChunk();
          } else if (streamCompleted) {
            console.log('All Deepgram audio buffers completed (with errors)');
            handleDeepgramAudioCompletion();
          } else {
            console.log('Waiting for more Deepgram audio after error...');
            underrunCount++;
            if (!adaptiveBoostApplied && underrunCount >= 2) {
              adaptiveBoostApplied = true;
              START_BUFFER_SIZE = 4096;  // ~4KB (still aggressive)
              MIN_BUFFER_SIZE = 2048;    // ~2KB (still aggressive)
              MAX_BUFFER_SIZE = 8192;    // ~8KB (still aggressive)
              BUFFER_TIMEOUT = 50;       // allow a bit more coalescing (still aggressive)
              console.log('Adaptive buffering after error: increased thresholds');
            }
          }
        };
        
        currentAudio.load();
      };
      
      const processBufferedChunks = () => {
        if (rawChunks.length === 0) return;
        
        const totalSize = rawChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        
        // Create buffer as soon as we have minimal data or stream is completed
        if (totalSize >= MIN_BUFFER_SIZE || streamCompleted) {
          const audioBlob = createAudioBuffer();
          if (audioBlob) {
            audioQueue.push(audioBlob);
            queuedBytes += audioBlob.size;
            
            // Start playing if this is the first buffer and we're not already playing
            if (audioQueue.length === 1 && !isPlaying) {
              playNextChunk();
            }
          }
        }
      };
      
      const scheduleBufferProcessing = () => {
        // No coalescing delay; process immediately
        if (bufferTimeout) {
          clearTimeout(bufferTimeout);
          bufferTimeout = null;
        }
        processBufferedChunks();
      };
      
      // Set up stream timeout
      streamTimeout = setTimeout(() => {
        console.log('Deepgram stream timeout - forcing completion');
        streamCompleted = true;
        processBufferedChunks();
        if (currentAudioIndex >= audioQueue.length) {
          handleDeepgramAudioCompletion();
        }
      }, 20000);
      
      function handleDeepgramAudioCompletion() {
        if (streamTimeout) {
          clearTimeout(streamTimeout);
          streamTimeout = null;
        }
        if (bufferTimeout) {
          clearTimeout(bufferTimeout);
          bufferTimeout = null;
        }
        console.log('Handling Deepgram audio completion');
        if (isStreamingMode) {
          updateStatus('✅ Ready - Speak again');
          micBtn.style.backgroundColor = '#4CAF50';
          if (streamingSession) {
            streamingSession.onAudioPlaybackComplete();
          }
          // Auto-restart WebSocket STT after all audio chunks complete
          setTimeout(() => {
            if (isStreamingMode && streamingSession) {
              console.log('Auto-restarting WebSocket STT after Deepgram audio completion');
              streamingSession.startRecording();
            }
          }, 500);
        } else {
          updateStatus('✅ Ready');
        }
        currentAudio = null;
        isTTSActive = false; // Clear TTS flag
      }
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Deepgram stream completed');
            streamCompleted = true;
            processBufferedChunks(); // Process any remaining chunks
            break;
          }
          
          if (value && value.length > 0) {
            rawChunks.push(value);
            chunkCount++;
            lastChunkTime = Date.now();
            
            // Update status to show we're receiving chunks
            if (rawChunks.length === 1) {
              updateStatus('🔊 Receiving audio chunks...');
            }
            
            const totalSize = rawChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            
            // Process immediately with minimal thresholding for ultra-low latency
            if (totalSize >= MIN_BUFFER_SIZE || chunkCount <= 2) {
              processBufferedChunks();
            } else if (totalSize >= MAX_BUFFER_SIZE) {
              processBufferedChunks();
            } else {
              scheduleBufferProcessing();
            }
          }
        }
        
        // If stream completed and we're not playing, trigger completion
        if (streamCompleted && currentAudioIndex >= audioQueue.length) {
          handleDeepgramAudioCompletion();
        }
        
      } catch (streamError) {
        console.error('Deepgram stream error:', streamError);
        streamCompleted = true;
        processBufferedChunks(); // Process any remaining chunks
        handleDeepgramAudioCompletion();
      }
    } else {
      // Sarvam TTS streaming with zero-delay chunk processing
      isTTSActive = true; // Mark TTS as active
      const audioQueue = [];
      let isPlaying = false;
      let currentAudioIndex = 0;
      let streamCompleted = false;
      let streamTimeout = null;
      let framingBuffer = new Uint8Array(0);
      let hasStartedPlaying = false;
      let chunkCount = 0;
      let processedChunks = new Set();
      let lastProcessedOffset = 0; // Track last processed position to prevent reprocessing
      let isFinalChunkPlaying = false; // Track if we're playing the final chunk
      
      const checkAudioCompletion = () => {
        // Only complete if stream is done, we've processed all chunks, and nothing is playing
        if (streamCompleted && currentAudioIndex >= audioQueue.length && !isPlaying) {
          // Additional check: ensure audio is not still playing
          if (currentAudio && !currentAudio.ended) {
            console.log('Audio still playing - deferring completion check');
            setTimeout(() => {
              checkAudioCompletion();
            }, 200);
            return;
          }
          
          // Extra safety: if we were playing the final chunk, wait a bit more
          if (isFinalChunkPlaying) {
            console.log('Final chunk was playing - waiting extra time for completion');
            setTimeout(() => {
              checkAudioCompletion();
            }, 300);
            return;
          }
          
          console.log('All Sarvam audio chunks completed - calling completion handler');
          handleSarvamAudioCompletion();
        }
      };

      const playNextChunk = () => {
        if (currentAudioIndex >= audioQueue.length || isPlaying) return;
        
        console.log(`Playing Sarvam chunk ${currentAudioIndex + 1}/${audioQueue.length}`);
        const audioBlob = audioQueue[currentAudioIndex];
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Check if this is the final chunk
        isFinalChunkPlaying = (currentAudioIndex === audioQueue.length - 1);
        
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        
        currentAudio = new Audio();
        currentAudio.src = audioUrl;
        isPlaying = true;
        
        currentAudio.oncanplay = () => {
          if (!hasStartedPlaying) {
            updateStatus('🔊 Playing response...');
            hasStartedPlaying = true;
          }
          if (currentAudio && currentAudio.src === audioUrl) {
            currentAudio.play().catch(e => {
              console.error('Sarvam audio play failed:', e);
              isPlaying = false;
              currentAudioIndex++;
              playNextChunk();
            });
          }
        };
        
        currentAudio.onended = () => {
          console.log(`Sarvam chunk ${currentAudioIndex + 1} ended, moving to next chunk`);
          URL.revokeObjectURL(audioUrl);
          currentAudioIndex++;
          isPlaying = false;
          
          if (currentAudioIndex < audioQueue.length) {
            console.log(`Playing next chunk: ${currentAudioIndex + 1}/${audioQueue.length}`);
            playNextChunk();
          } else {
            console.log('All chunks played, checking completion');
            // Check if we should complete after this chunk ends
            checkAudioCompletion();
          }
        };
        
        currentAudio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioIndex++;
          isPlaying = false;
          playNextChunk();
        };
        
        currentAudio.load();
      };
      
      const processFramedChunks = () => {
        let offset = lastProcessedOffset;
        let processedAny = false;
        
        while (framingBuffer.length - offset >= 8) {
          // Scan for 'WAVC' sync header
          if (!(framingBuffer[offset] === 0x57 && // 'W'
                framingBuffer[offset+1] === 0x41 && // 'A'
                framingBuffer[offset+2] === 0x56 && // 'V'
                framingBuffer[offset+3] === 0x43)) { // 'C'
            offset += 1;
            continue;
          }

          // Read length (big-endian)
          const len = ((framingBuffer[offset+4] << 24) |
                     (framingBuffer[offset+5] << 16) |
                     (framingBuffer[offset+6] << 8) |
                     framingBuffer[offset+7]) >>> 0;

          if (framingBuffer.length - offset - 8 < len) {
            break; // wait for more data
          }

          // Extract framed WAV payload
          const wavBytes = framingBuffer.slice(offset + 8, offset + 8 + len);
          
          // Create a unique identifier for this chunk to prevent duplicates
          const chunkId = `${offset}-${len}`;
          
          if (!processedChunks.has(chunkId)) {
            processedChunks.add(chunkId);
            const audioBlob = new Blob([wavBytes], { type: 'audio/wav' });
            audioQueue.push(audioBlob);
            chunkCount++;

            console.log(`Sarvam framed chunk ${chunkCount}: ${len} bytes`);

            if (audioQueue.length === 1) {
              updateStatus('🔊 Receiving audio chunks...');
            }
            
            // Start playing immediately for first chunk
            if (!isPlaying && audioQueue.length === 1) {
              playNextChunk();
            }
            
            // Don't check completion here - let audio finish naturally
          }

          offset += 8 + len;
          processedAny = true;
        }
        
        // Update last processed offset to prevent reprocessing
        lastProcessedOffset = offset;
        
        return processedAny;
      };
      
      function handleSarvamAudioCompletion() {
        if (streamTimeout) {
          clearTimeout(streamTimeout);
          streamTimeout = null;
        }
        console.log('Handling Sarvam audio completion');
        
        // Ensure we don't interrupt if audio is still playing
        if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
          console.log('Audio still playing - deferring completion handling');
          // Wait for audio to actually finish
          currentAudio.addEventListener('ended', () => {
            console.log('Audio actually ended - now completing');
            handleSarvamAudioCompletion();
          }, { once: true });
          return;
        }
        
        // Double-check: if we have audio and it's not ended, wait a bit more
        if (currentAudio && !currentAudio.ended) {
          console.log('Audio exists but not ended - waiting 100ms and retrying');
          setTimeout(() => {
            handleSarvamAudioCompletion();
          }, 100);
          return;
        }
        
        if (isStreamingMode) {
          updateStatus('✅ Ready - Speak again');
          micBtn.style.backgroundColor = '#4CAF50';
          if (streamingSession) {
            streamingSession.onAudioPlaybackComplete();
          }
          setTimeout(() => {
            if (isStreamingMode && streamingSession) {
              console.log('Auto-restarting WebSocket STT after Sarvam audio completion');
              streamingSession.startRecording();
            }
          }, 500);
        } else {
          updateStatus('✅ Ready');
        }
        currentAudio = null;
        isTTSActive = false; // Clear TTS flag
      }
      
      streamTimeout = setTimeout(() => {
        console.log('Sarvam stream timeout - marking stream as completed');
        streamCompleted = true;
        processFramedChunks(); // Process any remaining chunks
        // Let audio finish naturally
      }, 25000);
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Sarvam stream completed');
            streamCompleted = true;
            processFramedChunks(); // Process any remaining chunks
            break;
          }
          
          if (value && value.length > 0) {
            const u8 = value instanceof Uint8Array ? value : new Uint8Array(value);
            
            // Add to framing buffer
            const combined = new Uint8Array(framingBuffer.length + u8.length);
            combined.set(framingBuffer, 0);
            combined.set(u8, framingBuffer.length);
            framingBuffer = combined;
            
            // Process chunks immediately with zero delay
            processFramedChunks();
          }
        }
        
        // Stream completed - let audio finish naturally
        
      } catch (streamError) {
        console.error('Sarvam stream error:', streamError);
        streamCompleted = true;
        processFramedChunks(); // Process any remaining chunks
        // Let audio finish naturally
      }
    }

    
  } catch (error) {
    console.error('Streaming audio error:', error);
    updateStatus('✅ Ready');
    // Reset audio playing state on error
    if (streamingSession) {
      streamingSession.onAudioPlaybackComplete();
    }
  }
}

async function playAudioChunks(chunks, audioContext) {
  try {
    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedArray = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Create audio blob and play
    const audioBlob = new Blob([combinedArray], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    currentAudio = new Audio();
    currentAudio.src = audioUrl;
    
    currentAudio.oncanplay = () => {
      currentAudio.play().catch(e => {
        console.error('Audio play failed:', e);
        updateStatus('Audio playback failed');
      });
    };
    
    currentAudio.onended = () => {
      console.log('Fallback audio playback ended');
      if (isStreamingMode) {
        updateStatus('✅ Ready - Speak again');
        micBtn.style.backgroundColor = '#4CAF50';
        if (streamingSession) {
          streamingSession.onAudioPlaybackComplete();
        }
        // Auto-restart WebSocket STT after fallback audio ends
        setTimeout(() => {
          if (isStreamingMode && streamingSession) {
            console.log('Auto-restarting WebSocket STT after fallback audio completion');
            streamingSession.startRecording();
          }
        }, 500);
      } else {
        updateStatus('✅ Ready');
      }
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };
    
    currentAudio.onerror = (e) => {
      console.error('Fallback audio error:', e);
      updateStatus('Audio playback failed');
      if (isStreamingMode && streamingSession) {
        streamingSession.onAudioPlaybackComplete();
        // Auto-restart WebSocket STT after fallback audio error
        setTimeout(() => {
          if (isStreamingMode && streamingSession) {
            console.log('Auto-restarting WebSocket STT after fallback audio error');
            streamingSession.startRecording();
          }
        }, 500);
      }
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };
    
    currentAudio.load();
    
  } catch (error) {
    console.error('Audio playback error:', error);
    updateStatus('✅ Ready');
  }
}

async function fallbackAudioPlayback(text) {
  try {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', languageSelect.value);
    
    // Get JWT token for authentication
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch('/api/v1/tts/stream', {
      method: 'POST',
      headers: headers,
      body: formData
    });
    
    if (response.ok) {
      const audioBlob = await response.blob();
      if (audioBlob.size > 0) {
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio();
        
        currentAudio.oncanplaythrough = () => {
          updateStatus('🔊 Playing response...');
          currentAudio.play().catch(e => {
            console.error('Audio play failed:', e);
            updateStatus('Audio playback failed');
          });
        };
        
        currentAudio.onended = () => {
          console.log('Fallback audio playback ended');
          if (isStreamingMode) {
            updateStatus('✅ Ready - Speak again');
            micBtn.style.backgroundColor = '#4CAF50';
            if (streamingSession) {
              streamingSession.onAudioPlaybackComplete();
            }
            // Auto-restart WebSocket STT after fallback audio ends
            setTimeout(() => {
              if (isStreamingMode && streamingSession) {
                console.log('Auto-restarting WebSocket STT after fallback audio completion');
                streamingSession.startRecording();
              }
            }, 500);
          } else {
            updateStatus('✅ Ready');
          }
          URL.revokeObjectURL(audioUrl);
        };
        
        currentAudio.src = audioUrl;
        currentAudio.load();
      }
    }
  } catch (error) {
    console.error('Fallback audio error:', error);
    updateStatus('✅ Ready');
  }
}

// Legacy manual recording functions (kept for fallback)
async function startRecording() {
  if (!stream) {
    addMessage('system', 'Please allow camera and microphone access first');
    return;
  }

  try {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      await processSpeech(audioBlob);
    };
    
    mediaRecorder.start();
    isRecording = true;
    micBtn.textContent = '⏹️ Stop Recording';
    micBtn.classList.add('recording');
    updateStatus('Recording... Click to stop');
  } catch (error) {
    addMessage('system', 'Recording failed: ' + error.message);
    updateStatus('Recording failed');
  }
}

async function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    micBtn.textContent = '🎤 Start Recording';
    micBtn.classList.remove('recording');
    updateStatus('Processing speech...');
    
    try {
      await fetch('/api/v1/conversation/cancel', {
        method: 'POST'
      });
    } catch (error) {
      console.log('Cancel request failed:', error);
    }
  }
}

async function processSpeech(audioBlob) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const sessionId = getOrCreateSessionId();
    console.log('Using session ID for speech:', sessionId);
    console.log('Current global session ID:', currentSessionId);
    console.log('Current DB session ID:', currentSessionDbId);
    
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.wav');
    formData.append('language', languageSelect.value);
    formData.append('session_id', sessionId);
    // Add consultation_id if available
    if (window.consultationId) {
      formData.append('consultation_id', window.consultationId);
    }
    
    // Add session_db_id if available
    if (currentSessionDbId) {
      console.log('Adding session_db_id to speech form:', currentSessionDbId);
      formData.append('session_db_id', currentSessionDbId);
    }
    
    updateStatus('Converting speech to text...');
    
    // Get JWT token for authentication
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch('/api/v1/conversation/speech', {
      method: 'POST',
      headers: headers,
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Debug: Log the entire response
    console.log('📥 Speech API Response:', JSON.stringify(data));
    
    // Capture session_db_id from response for subsequent requests (always update if provided)
    if (data.session_db_id) {
      currentSessionDbId = data.session_db_id;
      console.log('✅ Captured session_db_id from speech response:', currentSessionDbId);
    } else {
      console.warn('⚠️ No session_db_id in speech response! Response keys:', Object.keys(data));
    }
    
    addMessage('user', `${data.transcribed_text} (${languageSelect.options[languageSelect.selectedIndex].text})`);
    addMessage('doctor', data.final_response);
    
    updateStatus('Generating audio response...');
    
    // Generate audio using the new streaming TTS
    generateAudioResponse(data.final_response);
    
    updateStatus('Ready');
    
  } catch (error) {
    console.error('Speech processing error:', error);
    addMessage('system', 'Speech processing failed: ' + error.message);
    updateStatus('Speech processing failed');
  }
}

camBtn.addEventListener('click', () => {
  if (stream) {
    camEnabled = !camEnabled;
    stream.getVideoTracks().forEach(track => track.enabled = camEnabled);
    camBtn.textContent = camEnabled ? '📷 Camera On' : '🚫 Camera Off';
  }
});

function addMessage(sender, text) {
  const div = document.createElement('div');
  div.className = `chat-message ${sender}`;
  
  const senderNames = {
    'user': 'You',
    'doctor': 'Doctor',
    'system': 'System'
  };
  
  div.innerHTML = `<strong>${senderNames[sender]}:</strong> ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  addMessage('user', text);
  chatInput.value = '';
  updateStatus('Processing text...');
  
  try {
    const sessionId = getOrCreateSessionId();
    console.log('Using session ID for text:', sessionId);
    console.log('Current global session ID:', currentSessionId);
    console.log('Current DB session ID:', currentSessionDbId);
    
    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', languageSelect.value);
    formData.append('session_id', sessionId);
    // If the text is a trivial greeting/ack, hint backend to skip RAG
    if (isTrivialUtterance(text)) {
      formData.append('use_rag', 'false');
    }
    // Add consultation_id if available
    console.log('window.consultationId:', window.consultationId);
    if (window.consultationId) {
      console.log('Adding consultation_id to form:', window.consultationId);
      formData.append('consultation_id', window.consultationId);
    } else {
      console.log('No consultation_id available');
    }
    
    // Add session_db_id if available
    if (currentSessionDbId) {
      console.log('Adding session_db_id to form:', currentSessionDbId);
      formData.append('session_db_id', currentSessionDbId);
    }
    
    // Get JWT token for authentication
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch('/api/v1/conversation/text', {
      method: 'POST',
      headers: headers,
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Debug: Log the entire response
    console.log('📥 Text API Response:', JSON.stringify(data));
    
    // Capture session_db_id from response for subsequent requests (always update if provided)
    if (data.session_db_id) {
      currentSessionDbId = data.session_db_id;
      console.log('✅ Captured session_db_id from response:', currentSessionDbId);
    } else {
      console.warn('⚠️ No session_db_id in response! Response keys:', Object.keys(data));
    }
    
    addMessage('doctor', data.final_response);
    // Generate audio for text responses
    generateAudioResponse(data.final_response);
    updateStatus('Ready');
    
  } catch (error) {
    console.error('Text processing error:', error);
    addMessage('system', 'Error processing your message: ' + error.message);
    updateStatus('Text processing failed');
  }
});
// Simple client-side trivial utterance detector to hint backend
function isTrivialUtterance(t) {
  if (!t) return true;
  const s = String(t).trim().toLowerCase();
  if (s.length <= 2) return true;
  const trivial = new Set([
    'ok','okay','okk','k','kk','hmm','hmmm','h','hii','hi','hello','hey','yo','sup',
    'thanks','thankyou','thank you','cool','nice','great','fine','good','awesome','sure',
    'yup','yeah','nope','no','yes','hahaha','haha','lol','hbd','bye','goodbye','tc','hru'
  ]);
  const parts = s.split(/\s+/);
  if (parts.length === 1 && trivial.has(parts[0])) return true;
  const shortPhrases = new Set(['okay doctor','ok doctor','hello doctor','hi doctor']);
  if (shortPhrases.has(s)) return true;
  return false;
}

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});

addMessage('system', 'Welcome to Virtual Doctor! Select your language and speak or type your questions.');

// Display current session ID
function updateSessionDisplay() {
  const sessionId = getOrCreateSessionId();
  console.log('Current session ID:', sessionId);
  // You can add a visual indicator in the UI if needed
}

// Initialize session display
updateSessionDisplay();

// Session management event handlers
clearSessionBtn.addEventListener('click', async () => {
  if (currentSessionId) {
    try {
      const formData = new FormData();
      formData.append('session_id', currentSessionId);
      
      const response = await fetch('/api/v1/conversation/clear-session', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        clearCurrentSession();
        addMessage('system', 'Session cleared. Starting fresh conversation.');
        updateStatus('New session started');
      } else {
        addMessage('system', 'Failed to clear session on server.');
      }
    } catch (error) {
      console.error('Error clearing session:', error);
      addMessage('system', 'Error clearing session: ' + error.message);
    }
  } else {
    addMessage('system', 'No active session to clear.');
  }
});

sessionInfoBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/v1/conversation/session-info');
    const data = await response.json();
    
    if (data.status === 'success') {
      const info = data.data;
      let message = `Total Sessions: ${info.total_sessions}\n`;
      message += `Current Session: ${currentSessionId || 'None'}\n\n`;
      
      if (info.sessions.length > 0) {
        message += 'Active Sessions:\n';
        info.sessions.forEach(session => {
          message += `- ${session.session_id}: ${session.message_count} messages, ${session.age_seconds}s old\n`;
        });
      }
      
      addMessage('system', message);
    } else {
      addMessage('system', 'Failed to get session info.');
    }
  } catch (error) {
    console.error('Error getting session info:', error);
    addMessage('system', 'Error getting session info: ' + error.message);
  }
});

// Force Ready button - manually reset status if stuck (guard if element missing)
if (forceReadyBtn) {
  forceReadyBtn.addEventListener('click', () => {
    console.log('Force Ready button clicked');
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    // Reset status
    if (isStreamingMode) {
      updateStatus('✅ Ready - Speak again');
      micBtn.style.backgroundColor = '#4CAF50';
      if (streamingSession) {
        streamingSession.onAudioPlaybackComplete();
        setTimeout(() => {
          if (isStreamingMode && streamingSession) {
            console.log('Auto-restarting WebSocket STT after force ready');
            streamingSession.startRecording();
          }
        }, 500);
      }
    } else {
      updateStatus('✅ Ready');
    }
    addMessage('system', 'Status manually reset to Ready');
  });
}

// Add test function for debugging
window.testRecording = function() {
  if (streamingSession) {
    console.log('Manual recording test triggered');
    streamingSession.startRecording();
    setTimeout(() => {
      streamingSession.stopRecording();
    }, 3000);
  }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopStatusMonitoring();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (streamingSession) {
    streamingSession.stopSession();
  }
});

// End conversation: stop streaming, download transcript, clear session (guard if element missing)
if (endConversationBtn) endConversationBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to end the conversation? You will be redirected to a thank you page where you can download your transcript.')) {
    try {
      // Stop any active streaming or audio
      if (isStreamingMode || isStartingStreaming) {
        try { stopStreamingMode(); } catch (_) {}
      }
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      const sessionId = currentSessionId || getOrCreateSessionId();
      updateStatus('Preparing transcript...');

      // End the session in the database first
      try {
        const token = localStorage.getItem('access_token');
        const headers = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/v1/conversation/end-session', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            session_db_id: currentSessionDbId,
            consultation_id: window.consultationId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Session ended successfully:', result);
        }
      } catch (e) {
        console.warn('Failed to end session in database:', e);
      }

      // Note: Transcript download is now handled on the thank you page
      console.log('Transcript will be available for download on the thank you page');

      // Clear session on server and close DB session (best-effort)
      try {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        if (window.consultationId) formData.append('consultation_id', window.consultationId);
        if (typeof currentSessionDbId !== 'undefined' && currentSessionDbId !== null) {
          formData.append('session_db_id', String(currentSessionDbId));
        }
        const resp = await fetch('/api/v1/conversation/clear-session', { method: 'POST', body: formData });
        console.log('Clear-session response status:', resp.status);
      } catch (e) {
        console.warn('Failed to clear session on server', e);
      }

      // Clear local session
      clearCurrentSession();
      addMessage('system', 'Conversation ended. Redirecting to thank you page...');
      updateStatus('✅ Session ended');

      // Calculate session duration
      const sessionStartTime = window.sessionStartTime || Date.now() - 60000; // Fallback to 1 minute if not tracked
      const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = `${minutes}m ${seconds}s`;

      // Redirect to thank you page with session details
      const thankYouUrl = new URL('/api/v1/thank-you', window.location.origin);
      thankYouUrl.searchParams.set('consultation_id', window.consultationId || '');
      thankYouUrl.searchParams.set('session_id', sessionId || '');
      thankYouUrl.searchParams.set('duration', durationText);
      
      console.log('Redirecting to:', thankYouUrl.toString());

      // Small delay to show the success message
      setTimeout(() => {
        window.location.href = thankYouUrl.toString();
      }, 2000);

    } catch (error) {
      console.error('End conversation error:', error);
      addMessage('system', 'Failed to end conversation: ' + (error?.message || error));
      updateStatus('❌ Failed to end');
    }
  }
});