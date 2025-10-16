/**
 * Enhanced Conversation Interface
 * Integrates with analytics and provides real-time feedback
 */

class EnhancedConversationInterface {
    constructor() {
        this.consultationId = null;
        this.sessionId = null;
        this.currentProvider = 'deepgram';
        this.currentLanguage = 'multi';
        this.isRecording = false;
        this.isCameraOn = false;
        this.analytics = {
            startTime: null,
            totalTokens: 0,
            totalCost: 0,
            apiCalls: 0,
            errors: 0
        };
        
        this.initializeInterface();
        this.setupEventListeners();
        this.loadAnalytics();
    }
    
    initializeInterface() {
        // Extract consultation ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.consultationId = urlParams.get('consultation_id');
        
        if (this.consultationId) {
            console.log('Consultation ID:', this.consultationId);
            this.updateStatus('Connected to consultation ' + this.consultationId);
        }
        
        // Initialize analytics
        this.analytics.startTime = Date.now();
    }
    
    setupEventListeners() {
        // Provider selection
        const providerSelect = document.getElementById('providerSelect');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                this.currentProvider = e.target.value;
                this.updateStatus(`Provider changed to ${this.currentProvider}`);
                this.logAnalytics('provider_change', { provider: this.currentProvider });
            });
        }
        
        // Language selection
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.currentLanguage = e.target.value;
                this.updateStatus(`Language changed to ${this.currentLanguage}`);
                this.logAnalytics('language_change', { language: this.currentLanguage });
            });
        }
        
        // Microphone toggle
        const toggleMic = document.getElementById('toggleMic');
        if (toggleMic) {
            toggleMic.addEventListener('click', () => {
                this.toggleRecording();
            });
        }
        
        // Camera toggle
        const toggleCam = document.getElementById('toggleCam');
        if (toggleCam) {
            toggleCam.addEventListener('click', () => {
                this.toggleCamera();
            });
        }
        
        // Session controls
        const clearSession = document.getElementById('clearSession');
        if (clearSession) {
            clearSession.addEventListener('click', () => {
                this.clearSession();
            });
        }
        
        const sessionInfo = document.getElementById('sessionInfo');
        if (sessionInfo) {
            sessionInfo.addEventListener('click', () => {
                this.showSessionInfo();
            });
        }
        
        const endConversation = document.getElementById('endConversation');
        if (endConversation) {
            endConversation.addEventListener('click', () => {
                this.endConversation();
            });
        }
        
        // Chat input
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (chatInput && sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
            
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }
    
    toggleRecording() {
        const toggleMic = document.getElementById('toggleMic');
        
        if (!this.isRecording) {
            this.startRecording();
            toggleMic.textContent = '🎤 Stop Recording';
            toggleMic.style.background = '#f44336';
        } else {
            this.stopRecording();
            toggleMic.textContent = '🎤 Start Recording';
            toggleMic.style.background = '#4caf50';
        }
    }
    
    startRecording() {
        this.isRecording = true;
        this.updateStatus('Recording started...');
        this.logAnalytics('recording_start', {
            provider: this.currentProvider,
            language: this.currentLanguage
        });
        
        // Initialize audio recording based on provider
        if (this.currentProvider === 'deepgram') {
            this.initializeDeepgramRecording();
        } else if (this.currentProvider === 'sarvam') {
            this.initializeSarvamRecording();
        }
    }
    
    stopRecording() {
        this.isRecording = false;
        this.updateStatus('Recording stopped');
        this.logAnalytics('recording_stop', {
            provider: this.currentProvider,
            language: this.currentLanguage
        });
        
        // Stop audio recording
        this.stopAudioRecording();
    }
    
    initializeDeepgramRecording() {
        // Deepgram-specific recording initialization
        console.log('Initializing Deepgram recording...');
        // Implementation would go here
    }
    
    initializeSarvamRecording() {
        // Sarvam-specific recording initialization
        console.log('Initializing Sarvam recording...');
        // Implementation would go here
    }
    
    stopAudioRecording() {
        // Stop audio recording implementation
        console.log('Stopping audio recording...');
    }
    
    toggleCamera() {
        const toggleCam = document.getElementById('toggleCam');
        const userVideo = document.getElementById('userVideo');
        
        if (!this.isCameraOn) {
            this.startCamera();
            toggleCam.textContent = '📷 Camera Off';
            toggleCam.style.background = '#f44336';
        } else {
            this.stopCamera();
            toggleCam.textContent = '📷 Camera On';
            toggleCam.style.background = '#4caf50';
        }
    }
    
    startCamera() {
        this.isCameraOn = true;
        this.updateStatus('Camera started');
        this.logAnalytics('camera_start');
        
        // Initialize camera
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(stream => {
                const userVideo = document.getElementById('userVideo');
                if (userVideo) {
                    userVideo.srcObject = stream;
                }
            })
            .catch(err => {
                console.error('Camera access denied:', err);
                this.updateStatus('Camera access denied');
            });
    }
    
    stopCamera() {
        this.isCameraOn = false;
        this.updateStatus('Camera stopped');
        this.logAnalytics('camera_stop');
        
        // Stop camera stream
        const userVideo = document.getElementById('userVideo');
        if (userVideo && userVideo.srcObject) {
            userVideo.srcObject.getTracks().forEach(track => track.stop());
            userVideo.srcObject = null;
        }
    }
    
    sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Clear input
        chatInput.value = '';
        
        // Log analytics
        this.logAnalytics('text_message', {
            message_length: message.length,
            provider: this.currentProvider
        });
        
        // Send to backend
        this.sendToBackend(message);
    }
    
    addMessageToChat(sender, message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <strong>${sender === 'user' ? 'You' : 'AI Doctor'}:</strong>
                <p>${message}</p>
                <small>${new Date().toLocaleTimeString()}</small>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    sendToBackend(message) {
        // Send message to backend API
        fetch('/api/v1/conversation/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                consultation_id: this.consultationId,
                provider: this.currentProvider,
                language: this.currentLanguage
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.response) {
                this.addMessageToChat('assistant', data.response);
                this.updateAnalytics('api_call', {
                    provider: this.currentProvider,
                    tokens: data.tokens || 0,
                    cost: data.cost || 0
                });
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            this.updateStatus('Error sending message');
            this.analytics.errors++;
        });
    }
    
    clearSession() {
        if (confirm('Are you sure you want to start a new session?')) {
            // Clear chat messages
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            // Reset analytics
            this.analytics = {
                startTime: Date.now(),
                totalTokens: 0,
                totalCost: 0,
                apiCalls: 0,
                errors: 0
            };
            
            // Stop recording and camera
            if (this.isRecording) {
                this.toggleRecording();
            }
            if (this.isCameraOn) {
                this.toggleCamera();
            }
            
            this.updateStatus('Session cleared');
            this.logAnalytics('session_clear');
        }
    }
    
    showSessionInfo() {
        const duration = Math.floor((Date.now() - this.analytics.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        const info = `
Session Information:
- Duration: ${minutes}m ${seconds}s
- Provider: ${this.currentProvider}
- Language: ${this.currentLanguage}
- API Calls: ${this.analytics.apiCalls}
- Total Tokens: ${this.analytics.totalTokens}
- Total Cost: $${this.analytics.totalCost.toFixed(4)}
- Errors: ${this.analytics.errors}
        `;
        
        alert(info);
    }
    
    async endConversation() {
        if (confirm('Are you sure you want to end the conversation? You will be redirected to a thank you page where you can download your transcript.')) {
            try {
                // Stop all recording
                if (this.isRecording) {
                    this.toggleRecording();
                }
                if (this.isCameraOn) {
                    this.toggleCamera();
                }
                
                // End the session in the database
                const sessionResult = await this.endSessionInDatabase();
                
                // Note: Transcript download is now handled on the thank you page
                console.log('Transcript will be available for download on the thank you page');
                
                // Log final analytics
                this.logAnalytics('conversation_end', {
                    duration: Date.now() - this.analytics.startTime,
                    total_tokens: this.analytics.totalTokens,
                    total_cost: this.analytics.totalCost,
                    api_calls: this.analytics.apiCalls,
                    errors: this.analytics.errors
                });
                
                this.updateStatus('Session ended successfully. Redirecting to thank you page...');
                
                // Redirect to thank you page with session details
                const duration = Math.floor((Date.now() - this.analytics.startTime) / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                const durationText = `${minutes}m ${seconds}s`;
                
                const thankYouUrl = new URL('/api/v1/thank-you', window.location.origin);
                thankYouUrl.searchParams.set('consultation_id', this.consultationId || '');
                thankYouUrl.searchParams.set('session_id', sessionResult?.session_id || window.currentSessionId || '');
                thankYouUrl.searchParams.set('duration', durationText);
                
                console.log('Enhanced conversation redirecting to:', thankYouUrl.toString());
                
                // Small delay to show the success message
                setTimeout(() => {
                    window.location.href = thankYouUrl.toString();
                }, 1000);
                
            } catch (error) {
                console.error('Error ending conversation:', error);
                alert('Error ending session: ' + error.message);
            }
        }
    }
    
    async endSessionInDatabase() {
        try {
            // Get JWT token for authentication
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
                    session_db_id: window.currentSessionDbId,
                    consultation_id: this.consultationId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Session ended successfully:', result);
            return result;
        } catch (error) {
            console.error('Failed to end session in database:', error);
            throw error;
        }
    }
    
    async downloadTranscript() {
        try {
            // First try to download from server if we have a session ID
            const sessionId = window.currentSessionId || window.currentSessionDbId;
            if (sessionId) {
                const token = localStorage.getItem('access_token');
                if (token) {
                    try {
                        const response = await fetch(`/api/v1/conversation/transcript/download/${sessionId}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `consultation_transcript_${this.consultationId || 'session'}_${new Date().toISOString().split('T')[0]}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            return; // Success, exit early
                        }
                    } catch (error) {
                        console.warn('Server transcript download failed, falling back to local:', error);
                    }
                }
            }
            
            // Fallback to local transcript generation
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) return;
            
            const messages = chatMessages.querySelectorAll('.message');
            let transcript = `Consultation Transcript - ${new Date().toLocaleString()}\n\n`;
            
            messages.forEach(message => {
                const sender = message.classList.contains('user') ? 'Patient' : 'Doctor';
                const content = message.querySelector('p').textContent;
                const time = message.querySelector('small').textContent;
                transcript += `[${time}] ${sender}: ${content}\n\n`;
            });
            
            // Create and download file
            const blob = new Blob([transcript], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `consultation_${this.consultationId || 'session'}_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading transcript:', error);
            throw error;
        }
    }
    
    updateStatus(message) {
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.textContent = message;
        }
        console.log('Status:', message);
    }
    
    logAnalytics(event, data = {}) {
        console.log('Analytics Event:', event, data);
        
        // Send to backend analytics
        fetch('/api/v1/analytics/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: event,
                data: data,
                consultation_id: this.consultationId,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            })
        })
        .catch(error => {
            console.error('Error logging analytics:', error);
        });
    }
    
    updateAnalytics(type, data) {
        if (type === 'api_call') {
            this.analytics.apiCalls++;
            this.analytics.totalTokens += data.tokens || 0;
            this.analytics.totalCost += data.cost || 0;
        }
    }
    
    loadAnalytics() {
        // Load initial analytics data
        if (this.consultationId) {
            fetch(`/api/v1/analytics/consultation/${this.consultationId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.analytics) {
                        this.analytics = { ...this.analytics, ...data.analytics };
                    }
                })
                .catch(error => {
                    console.error('Error loading analytics:', error);
                });
        }
    }
}

// Initialize the enhanced conversation interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.conversationInterface = new EnhancedConversationInterface();
});
