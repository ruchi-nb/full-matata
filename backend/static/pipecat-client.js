/**
 * Pipecat WebSocket Client
 * Ultra-low latency streaming conversation client
 */

class PipecatClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.sessionId = null;
        this.provider = 'deepgram';
        this.language = 'en';
        this.useRag = true;
        this.consultationId = window.consultationId || null;
        
        // Performance tracking
        this.messageCount = 0;
        this.errors = 0;
        this.lastLatency = 0;
        this.avgLatency = 0;
        this.firstAudioLatency = 0;
        this.latencies = [];
        this.requestStartTime = null;
        this.firstResponseTime = null;
        
        // Recording
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        
        // Audio queue for sequential playback (prevent overlapping)
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.currentAudio = null;
        
        // Message accumulation tracking
        this.newUserInput = false;  // Flag to track when to create new AI message
        
        // Initialize
        this.init();
    }
    
    init() {
        console.log('Initializing Pipecat client...');
        
        // Get configuration from UI
        this.provider = document.getElementById('providerSelect').value;
        this.language = document.getElementById('languageSelect').value;
        this.useRag = document.getElementById('useRag').checked;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Auto-connect
        this.connect();
    }
    
    setupEventListeners() {
        // Toggle mic button
        const toggleMic = document.getElementById('toggleMic');
        toggleMic.addEventListener('click', () => this.toggleRecording());
        
        // Send text button
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.addEventListener('click', () => this.sendText());
        
        // Enter key in input
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendText();
        });
        
        // Provider change
        document.getElementById('providerSelect').addEventListener('change', (e) => {
            this.provider = e.target.value;
            if (this.connected) {
                this.reconnect();
            }
        });
        
        // Language change
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            this.language = e.target.value;
            if (this.connected) {
                this.reconnect();
            }
        });
        
        // RAG toggle
        document.getElementById('useRag').addEventListener('change', (e) => {
            this.useRag = e.target.checked;
        });
        
        // Clear session
        document.getElementById('clearSession').addEventListener('click', () => {
            this.clearSession();
        });
        
        // End conversation
        document.getElementById('endConversation').addEventListener('click', () => {
            this.endConversation();
        });
        
        // Session info
        document.getElementById('sessionInfo').addEventListener('click', () => {
            this.showSessionInfo();
        });
    }
    
    connect() {
        if (this.connected) {
            console.log('Already connected');
            return;
        }
        
        const token = window.authToken || 'test-token';
        console.log('🔑 Using token:', token ? 'Present' : 'Missing');
        
        // Build WebSocket URL
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        let wsUrl = `${wsProtocol}//${wsHost}/pipecat/conversation/stream?token=${token}&provider=${this.provider}&language=${this.language}&use_rag=${this.useRag}`;
        
        if (this.consultationId) {
            wsUrl += `&consultation_id=${this.consultationId}`;
        }
        
        console.log('🔌 Connecting to Pipecat:', wsUrl);
        console.log('📋 Provider:', this.provider, 'Language:', this.language, 'RAG:', this.useRag);
        updateStatusIndicator('Connecting to Pipecat...', false);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ Pipecat connected');
            this.connected = true;
            updateStatusIndicator('🚀 Pipecat Connected - Ultra-Low Latency Mode', true);
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(event);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ Pipecat WebSocket error:', error);
            console.error('❌ Error details:', {
                type: error.type,
                target: error.target,
                readyState: this.ws ? this.ws.readyState : 'no ws'
            });
            this.errors++;
            updateStatusIndicator('❌ Connection Error - Check backend logs', false);
            
            // Show error in chat
            addChatMessage('system', '❌ Failed to connect to Pipecat. Check browser console and backend logs.', false);
        };
        
        this.ws.onclose = (event) => {
            console.log('🔌 Pipecat disconnected');
            console.log('🔌 Close details:', {
                code: event.code,
                reason: event.reason || 'No reason provided',
                wasClean: event.wasClean
            });
            this.connected = false;
            
            // Show detailed error message based on close code
            let errorMsg = `Disconnected (Code: ${event.code})`;
            if (event.code === 1008) {
                errorMsg = '❌ Authentication failed';
            } else if (event.code === 1006) {
                errorMsg = '❌ Connection closed abnormally - check backend';
            } else if (event.reason) {
                errorMsg = `❌ ${event.reason}`;
            }
            
            updateStatusIndicator(errorMsg, false);
            addChatMessage('system', `Connection closed: ${errorMsg}`, false);
            
            // Don't auto-reconnect to avoid spam - user can refresh
            console.log('⚠️ Auto-reconnect disabled. Refresh the page to reconnect.');
        };
    }
    
    handleMessage(event) {
        if (event.data instanceof Blob) {
            // Audio data from TTS
            this.handleAudio(event.data);
        } else {
            // JSON message
            try {
                const msg = JSON.parse(event.data);
                this.handleJsonMessage(msg);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        }
    }
    
    handleJsonMessage(msg) {
        console.log('📥 Pipecat message:', msg.type, msg);
        
        switch (msg.type) {
            case 'connection_established':
                this.sessionId = msg.session_id;
                updateStatusIndicator(`✅ ${msg.message}`, true);
                addChatMessage('system', `🎉 Pipecat session started: ${msg.pipeline}`);
                break;
            
            case 'transcription':
                // User's speech transcribed
                addChatMessage('user', msg.text);
                this.requestStartTime = Date.now();
                this.firstResponseTime = null;
                
                // Mark that we have a new user input - next text_chunk should create new AI message
                this.newUserInput = true;
                break;
            
            case 'text_chunk':
                // LLM token streaming
                if (!this.firstResponseTime) {
                    this.firstResponseTime = Date.now();
                    this.firstAudioLatency = this.firstResponseTime - this.requestStartTime;
                }
                
                // Append to last AI message or create new
                const chatMessages = document.getElementById('chatMessages');
                if (!chatMessages) break;
                
                const lastMessage = chatMessages.lastElementChild;
                
                // Check if last message is an AI message (regardless of streaming class)
                const isAIMessage = lastMessage && 
                    lastMessage.classList.contains('assistant');
                
                // Create new message if:
                // 1. No AI message exists, OR
                // 2. We have a new user input (start fresh response)
                const shouldCreateNew = !isAIMessage || this.newUserInput;
                
                if (!shouldCreateNew && isAIMessage) {
                    // Append to existing AI message (accumulate all tokens into one response)
                    const textSpan = lastMessage.querySelector('.message-text');
                    if (textSpan) {
                        textSpan.textContent += msg.text;
                        console.log(`📝 Appended token: "${msg.text}" (total: ${textSpan.textContent.length} chars)`);
                    } else {
                        console.warn('⚠️ No .message-text span found, creating one');
                        const currentText = lastMessage.textContent.replace('AI:', '').trim();
                        lastMessage.innerHTML = `<strong>AI:</strong> <span class="message-text">${currentText}${msg.text}</span>`;
                    }
                    // Ensure streaming class is present
                    lastMessage.classList.add('streaming');
                } else {
                    // Create new streaming message for this LLM response
                    console.log(`✨ New AI message started with: "${msg.text}"`);
                    const message = document.createElement('div');
                    message.className = 'chat-message assistant streaming';
                    message.innerHTML = `<strong>AI:</strong> <span class="message-text">${msg.text}</span>`;
                    chatMessages.appendChild(message);
                    // Clear the flag after creating new message
                    this.newUserInput = false;
                }
                
                // Auto-scroll to show new text
                chatMessages.scrollTop = chatMessages.scrollHeight;
                break;
            
            case 'llm_response_complete':
                // LLM finished generating - keep streaming class until next user input
                // (Don't remove streaming class here - let next user input trigger new message)
                console.log('✅ LLM response complete (message stays active for any remaining chunks)');
                break;
            
            case 'error':
                console.error('Pipecat error:', msg.message);
                this.errors++;
                addChatMessage('system', `❌ Error: ${msg.message}`);
                break;
            
            case 'pong':
                // Ignore pong
                break;
            
            default:
                console.log('Unknown message type:', msg.type);
        }
    }
    
    handleAudio(audioBlob) {
        // Calculate latency if we have a start time
        if (this.requestStartTime) {
            this.lastLatency = Date.now() - this.requestStartTime;
            this.latencies.push(this.lastLatency);
            this.avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
            
            // Keep only last 10 latencies
            if (this.latencies.length > 10) {
                this.latencies.shift();
            }
            
            console.log(`⚡ Latency: ${this.lastLatency}ms (Avg: ${Math.round(this.avgLatency)}ms)`);
        }
        
        // Queue audio directly for sequential playback
        console.log(`🔊 Received audio blob (${audioBlob.size} bytes)`);
        this.audioQueue.push(audioBlob);
        
        // Start playing if not already playing
        if (!this.isPlayingAudio) {
            this.playNextAudio();
        }
        
        this.messageCount++;
    }
    
    playNextAudio() {
        // If no audio in queue or already playing, return
        if (this.audioQueue.length === 0) {
            this.isPlayingAudio = false;
            console.log('✅ Audio queue empty');
            return;
        }
        
        if (this.isPlayingAudio && this.currentAudio && !this.currentAudio.paused) {
            // Still playing previous audio, wait
            return;
        }
        
        this.isPlayingAudio = true;
        
        // Get next audio from queue
        const audioBlob = this.audioQueue.shift();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        this.currentAudio = new Audio(audioUrl);
        
        // OPTIMIZATION: Preload next audio while current is playing
        this.currentAudio.preload = 'auto';
        
        // When this audio finishes, play next immediately
        this.currentAudio.onended = () => {
            console.log('🎵 Audio finished, playing next...');
            URL.revokeObjectURL(audioUrl);
            this.isPlayingAudio = false;
            // No delay - play next immediately
            this.playNextAudio();
        };
        
        // Handle errors
        this.currentAudio.onerror = (e) => {
            console.error('❌ Audio playback error:', e);
            URL.revokeObjectURL(audioUrl);
            this.isPlayingAudio = false;
            this.playNextAudio(); // Try next audio
        };
        
        // Play audio immediately
        console.log(`🔊 Playing audio (${this.audioQueue.length} remaining in queue)`);
        this.currentAudio.play().catch(e => {
            console.error('Error playing audio:', e);
            this.isPlayingAudio = false;
            this.playNextAudio();
        });
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        if (!this.connected) {
            alert('Not connected to Pipecat. Please wait...');
            return;
        }
        
        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.audioStream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(event.data);
                }
            };
            
            this.mediaRecorder.start(100); // Send chunks every 100ms (optimal for real-time)
            this.isRecording = true;
            
            document.getElementById('toggleMic').textContent = 'Stop Recording';
            document.getElementById('toggleMic').style.background = '#f44336';
            updateStatusIndicator('🎤 Recording...', true);
            document.getElementById('statusIndicator').classList.add('recording');
            
        } catch (error) {
            console.error('Microphone access error:', error);
            alert('Microphone access denied: ' + error.message);
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }
        
        this.isRecording = false;
        
        document.getElementById('toggleMic').textContent = 'Start Recording';
        document.getElementById('toggleMic').style.background = '#4CAF50';
        updateStatusIndicator('🚀 Pipecat Connected - Ready', true);
        document.getElementById('statusIndicator').classList.remove('recording');
    }
    
    sendText() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        if (!this.connected) {
            alert('Not connected to Pipecat. Please wait...');
            return;
        }
        
        // Send text message
        this.ws.send(JSON.stringify({
            type: 'text',
            text: text
        }));
        
        addChatMessage('user', text);
        this.requestStartTime = Date.now();
        this.firstResponseTime = null;
        
        // Mark that we have a new user input - next text_chunk should create new AI message
        this.newUserInput = true;
        
        input.value = '';
    }
    
    clearSession() {
        // Clear chat
        document.getElementById('chatMessages').innerHTML = '';
        
        // Reset analytics
        this.messageCount = 0;
        this.errors = 0;
        this.latencies = [];
        this.lastLatency = 0;
        this.avgLatency = 0;
        this.firstAudioLatency = 0;
        
        // Reset start time
        window.sessionStartTime = Date.now();
        
        addChatMessage('system', '🔄 Session cleared - Starting fresh');
    }
    
    endConversation() {
        if (confirm('Are you sure you want to end this conversation?')) {
            this.stopRecording();
            
            if (this.ws) {
                this.ws.close();
            }
            
            addChatMessage('system', '👋 Conversation ended');
            updateStatusIndicator('Session Ended', false);
            
            // Redirect to thank you page after 2 seconds
            setTimeout(() => {
                window.location.href = '/thank-you';
            }, 2000);
        }
    }
    
    showSessionInfo() {
        const info = `
Pipecat Session Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session ID: ${this.sessionId || 'Not started'}
Consultation ID: ${this.consultationId || 'None'}
Provider: ${this.provider}
Language: ${this.language}
RAG: ${this.useRag ? 'Enabled' : 'Disabled'}

Performance:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Messages: ${this.messageCount}
Last Latency: ${this.lastLatency}ms
Avg Latency: ${Math.round(this.avgLatency)}ms
First Audio: ${this.firstAudioLatency}ms
Errors: ${this.errors}

Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connected: ${this.connected ? 'Yes' : 'No'}
Recording: ${this.isRecording ? 'Yes' : 'No'}

Target Performance:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time to First Audio: < 800ms
Total Latency: < 3000ms
        `;
        
        alert(info);
    }
    
    reconnect() {
        console.log('Reconnecting with new configuration...');
        if (this.ws) {
            this.ws.close();
        }
        this.connected = false;
        setTimeout(() => this.connect(), 500);
    }
}

// Initialize Pipecat client
window.pipecatClient = new PipecatClient();

// Keep connection alive with ping
setInterval(() => {
    if (window.pipecatClient && window.pipecatClient.connected && window.pipecatClient.ws) {
        window.pipecatClient.ws.send(JSON.stringify({ type: 'ping' }));
    }
}, 30000);

console.log('✅ Pipecat client initialized');

