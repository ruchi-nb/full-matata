// Unified API Service - Consolidates all API calls and removes redundancy
class UnifiedApiService {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    this.wsBaseURL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.requestTimeouts = new Map();
    this.ws = null;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connectionParams = null;
    this.isIntentionalDisconnect = false;
    this.pingInterval = null;
    this.reconnectTimeout = null;
  }

  // =============================================
  // AUTHENTICATION & TOKEN MANAGEMENT
  // =============================================
  
  getAuthToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  getStoredTokens() {
    if (typeof window === 'undefined') return { accessToken: '', refreshToken: '' };
    try {
      const accessToken = localStorage.getItem('access_token') || '';
      const refreshToken = localStorage.getItem('refresh_token') || '';
      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Error reading tokens:', error);
      return { accessToken: '', refreshToken: '' };
    }
  }

  setStoredTokens(accessToken, refreshToken) {
    if (typeof window === 'undefined') return;
    try {
      if (accessToken) localStorage.setItem('access_token', accessToken);
      if (refreshToken !== undefined) localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('isLoggedIn', 'true');
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  clearTokens() {
    if (typeof window === 'undefined') return;
    const tokensToClear = [
      'access_token', 'accessToken', 'admin_access_token', 'superadmin_access_token',
      'refresh_token', 'refreshToken', 'admin_refresh_token', 'superadmin_refresh_token',
      'isLoggedIn', 'hospital_id'
    ];
    tokensToClear.forEach(token => {
      localStorage.removeItem(token);
      sessionStorage.removeItem(token);
    });
  }

  async refreshTokens() {
    const { refreshToken } = this.getStoredTokens();
    if (!refreshToken) {
      this.clearTokens();
      return false;
    }
    
    try {
      const res = await fetch(`${this.baseURL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}` 
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        this.setStoredTokens(data.access_token, data.refresh_token);
        return true;
      } else {
        this.clearTokens();
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      return false;
    }
  }

  // =============================================
  // UNIFIED REQUEST HANDLER
  // =============================================

  async requestWithRetry(endpoint, options = {}, retries = this.maxRetries) {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || 30000;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      let timeoutId;
      const controller = new AbortController();
      
      try {
        timeoutId = setTimeout(() => {
          controller.abort();
          this.requestTimeouts.delete(endpoint);
        }, timeout);
        
        this.requestTimeouts.set(endpoint, timeoutId);

        const config = {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        };

        // Handle FormData vs JSON
        if (options.body instanceof FormData) {
          delete config.headers['Content-Type'];
        }

        // Add authentication
        const { accessToken } = this.getStoredTokens();
        if (accessToken && !options.skipAuth) {
          config.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, config);
        
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(endpoint);
        
        if (response.status === 401 && !options.skipAuth) {
          console.log('Token expired, attempting refresh...');
          const refreshSuccess = await this.refreshTokens();
          if (refreshSuccess) {
            const { accessToken: newToken } = this.getStoredTokens();
            if (newToken) {
              config.headers['Authorization'] = `Bearer ${newToken}`;
              const retryResponse = await fetch(url, config);
              clearTimeout(timeoutId);
              return this.handleResponse(retryResponse);
            }
          }
        }
        
        if (response.status === 429) {
          const delay = Math.min(attempt * this.retryDelay, 10000);
          await this.delay(delay);
          continue;
        }
        
        return this.handleResponse(response);
        
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.requestTimeouts.delete(endpoint);
        }
        
        if (attempt === retries) {
          console.error(`API request failed after ${retries} attempts:`, error);
          throw error;
        }
        
        await this.delay(attempt * this.retryDelay);
      }
    }
  }

  async handleResponse(res) {
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : await res.text();
    
    if (!res.ok) {
      let message = res.statusText;
      if (data) {
        if (typeof data === 'string') {
          message = data;
        } else if (Array.isArray(data)) {
          message = data.map(err => err.msg || JSON.stringify(err)).join(', ');
        } else if (data.detail) {
          if (Array.isArray(data.detail)) {
            message = data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
          } else if (typeof data.detail === 'object') {
            message = data.detail.msg || JSON.stringify(data.detail);
          } else {
            message = data.detail;
          }
        } else if (data.message) {
          message = data.message;
        } else {
          message = JSON.stringify(data);
        }
      }

      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =============================================
  // AUTHENTICATION APIs
  // =============================================

  async login({ email, password }) {
    console.log('🔐 Attempting login for:', email);
    const response = await this.requestWithRetry('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }, { skipAuth: true });

    if (response.access_token && response.refresh_token) {
      this.setStoredTokens(response.access_token, response.refresh_token);
      
      // Parse JWT to get hospital_id
      try {
        const payload = JSON.parse(atob(response.access_token.split('.')[1]));
        const userData = payload.user || payload;
        const hospitalId = userData.hospital_roles?.[0]?.hospital_id || null;
        if (hospitalId) {
          localStorage.setItem('hospital_id', hospitalId);
        }
      } catch (e) {
        console.warn('Failed to parse JWT for hospital ID:', e);
      }
    }

    return response;
  }

  async logout() {
    try {
      await this.requestWithRetry('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async register(userData) {
    return this.requestWithRetry('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }, { skipAuth: true });
  }

  async getProfile() {
    const tokens = this.getStoredTokens();
    if (!tokens.accessToken) {
      throw new Error('Not authenticated');
    }
    
    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      const userData = payload.user || payload;
      let roleName = userData.global_role?.role_name || userData.role_name || userData.role;
      
      if (roleName) {
        switch (roleName) {
          case 'superadmin':
            return { ...userData, _detectedRole: 'superadmin' };
          case 'patient':
            try {
              const profile = await this.requestWithRetry('/patients/profile');
              return { ...profile, _detectedRole: 'patient' };
            } catch (error) {
              if (error.status === 404) {
                return {
                  user_id: userData.user_id,
                  username: userData.username,
                  email: userData.email,
                  first_name: userData.first_name || userData.username || 'User',
                  last_name: userData.last_name || '',
                  _detectedRole: 'patient',
                  _warning: 'Patient profile created from JWT'
                };
              }
              throw error;
            }
          case 'doctor':
            try {
              const profile = await this.requestWithRetry('/doctors/profile');
              return { ...profile, _detectedRole: 'doctor' };
            } catch (error) {
              return { ...userData, _detectedRole: 'doctor' };
            }
          case 'hospital_admin':
            let hospitalId = userData.hospital_roles?.[0]?.hospital_id || userData.hospital_id;
            if (!hospitalId) {
              try {
                const hospitalResponse = await this.requestWithRetry('/hospitals/profile');
                hospitalId = hospitalResponse?.hospital_id;
              } catch (apiError) {
                console.log('Failed to get hospital ID from API:', apiError);
              }
            }
            return { 
              ...userData, 
              _detectedRole: 'hospital_admin',
              hospital_id: hospitalId
            };
          default:
            return { ...userData, _detectedRole: roleName || 'patient' };
        }
      }
      
      // Fallback: try endpoints
      try {
        const patientProfile = await this.requestWithRetry('/patients/profile');
        return { ...patientProfile, _detectedRole: 'patient' };
      } catch (patientError) {
        try {
          const doctorProfile = await this.requestWithRetry('/doctors/profile');
          return { ...doctorProfile, _detectedRole: 'doctor' };
        } catch (doctorError) {
          return { ...userData, _detectedRole: 'patient' };
        }
      }
    } catch (error) {
      console.error('Critical error in getProfile:', error);
      throw new Error(`Failed to load user profile: ${error.message}`);
    }
  }

  // =============================================
  // CONSULTATION APIs
  // =============================================

  async createConsultation(doctorId, patientId = null, specialtyId = null, hospitalId = null) {
    const finalPatientId = patientId || await this.getCurrentPatientId();
    const finalSpecialtyId = specialtyId || await this.getDoctorSpecialty(doctorId);

    const consultationData = {
      patient_id: finalPatientId,
      doctor_id: doctorId,
      specialty_id: finalSpecialtyId,
      hospital_id: hospitalId,
      consultation_type: 'online',
      audio_provider: 'deepgram',
      language: 'multi'
    };

    await this.logEvent('consultation_form_submit', consultationData);

    const result = await this.requestWithRetry('/consultation/create', {
      method: 'POST',
      body: JSON.stringify(consultationData)
    });

    await this.logEvent('consultation_created', {
      consultation_id: result.consultation_id,
      doctor_id: doctorId,
      patient_id: finalPatientId
    });

    return result;
  }

  async getCurrentPatientId() {
    try {
      const token = this.getAuthToken();
      if (!token) return 12;

      const response = await this.requestWithRetry('/auth/me');
      return response.id || 12;
    } catch (error) {
      console.warn('Could not get current patient ID:', error);
      return 12;
    }
  }

  async getDoctorSpecialty(doctorId) {
    return 1; // Default specialty ID
  }

  async getDoctorLanguages(doctorId) {
    try {
      // First try to get from API
      const response = await this.requestWithRetry(`/doctors/${doctorId}/languages`);
      return response.languages || [];
    } catch (error) {
      console.warn('Could not fetch doctor languages from API, using fallback:', error);
      
      // Fallback to static data
      const doctor = this.getDoctorFromStaticData(doctorId);
      if (doctor && doctor.languages) {
        return this.parseLanguagesFromString(doctor.languages);
      }
      
      // Default fallback
      return ['en-IN'];
    }
  }

  getDoctorFromStaticData(doctorId) {
    // Import doctors data dynamically to avoid circular dependencies
    const doctors = [
      { id: 'emily-chen', languages: 'English, Mandarin, Spanish' },
      { id: 'james-wilson', languages: 'English, French' },
      { id: 'michael-rodriguez', languages: 'English, Spanish, Portuguese' },
      { id: 'tarun-singh', languages: 'English' },
      { id: 'devangi-patel', languages: 'English, Hindi, Gujarati' },
      { id: 'sarah-johnson', languages: 'English, Spanish' },
      { id: 'kshitij-mehta', languages: 'English, Korean' },
      { id: 'veena-gupta', languages: 'English, Spanish, Tagalog' },
      { id: 'tony-chopper', languages: 'Japanese, English' },
      { id: 'dr-kureha', languages: 'Japanese, English' },
      { id: 'dr-hiluluk', languages: 'Japanese, English' },
      { id: 'dr-stein', languages: 'Japanese, English' },
      { id: 'dr-senku', languages: 'Japanese, English' },
      { id: 'dr-tsunade', languages: 'Japanese, English' }
    ];
    
    return doctors.find(d => d.id === doctorId);
  }

  parseLanguagesFromString(languageString) {
    if (!languageString) return ['en-IN'];
    
    const languageMap = {
      'English': 'en-IN',
      'Hindi': 'hi-IN',
      'Bengali': 'bn-IN',
      'Gujarati': 'gu-IN',
      'Kannada': 'kn-IN',
      'Malayalam': 'ml-IN',
      'Marathi': 'mr-IN',
      'Punjabi': 'pa-IN',
      'Tamil': 'ta-IN',
      'Telugu': 'te-IN',
      'Mandarin': 'zh-CN',
      'Spanish': 'es-ES',
      'French': 'fr-FR',
      'Portuguese': 'pt-PT',
      'Korean': 'ko-KR',
      'Japanese': 'ja-JP',
      'Tagalog': 'tl-PH'
    };
    
    return languageString
      .split(',')
      .map(lang => lang.trim())
      .map(lang => languageMap[lang] || 'en-IN')
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
  }

  async endConsultation(consultationId) {
    return this.requestWithRetry(`/consultation/${consultationId}/end`, {
      method: 'POST'
    });
  }

  async getConsultationTranscript(consultationId) {
    return this.requestWithRetry(`/consultation/${consultationId}/transcript`);
  }

  // =============================================
  // CONVERSATION & AUDIO APIs
  // =============================================

  async enhancedSTT(audioBlob, options = {}) {
    const {
      provider = 'sarvam',
      language = 'en-IN',
      sessionId = null,
      consultationId = null,
      streaming = false,
      diarize = false
    } = options;

    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'audio.webm');
    formData.append('language', language);
    formData.append('provider', provider);
    
    if (sessionId) formData.append('session_id', sessionId);
    if (consultationId) formData.append('consultation_id', consultationId);
    if (streaming) formData.append('streaming', 'true');
    if (diarize && provider === 'deepgram') {
      formData.append('diarize', 'true');
    }

    return this.requestWithRetry('/conversation/speech', {
      method: 'POST',
      body: formData,
      timeout: 60000
    });
  }

  async enhancedTTS(text, options = {}) {
    const {
      provider = 'sarvam',
      language = 'hi-IN',
      voice = 'hitesh',
      streaming = true
    } = options;

    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', language);
    formData.append('provider', provider);
    formData.append('voice', voice);

    return this.requestWithRetry('/tts/stream', {
      method: 'POST',
      body: formData,
      timeout: 30000
    });
  }

  async sendTextMessage(text, options = {}) {
    const {
      sessionId = null,
      consultationId = null,
      language = 'en-IN',
      provider = 'sarvam'
    } = options;

    return this.requestWithRetry('/conversation/text', {
      method: 'POST',
      body: JSON.stringify({
        text,
        session_id: sessionId,
        consultation_id: consultationId,
        language,
        provider
      }),
      timeout: 30000
    });
  }

  async createSession(consultationId = null, sessionType = 'speech') {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (consultationId) {
      try {
        await this.requestWithRetry('/consultation/session', {
          method: 'POST',
          body: JSON.stringify({
            consultation_id: consultationId,
            session_type: sessionType,
            session_status: 'active'
          })
        });
      } catch (error) {
        console.warn('Failed to create backend session:', error);
      }
    }
    
    return sessionId;
  }

  async clearSession(sessionId) {
    try {
      await this.requestWithRetry('/conversation/clear', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (error) {
      console.warn('Failed to clear backend session:', error);
    }
  }

  // =============================================
  // WEBSOCKET CONNECTION
  // =============================================

  connectWebSocket(sessionId, language, provider, consultationId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.isIntentionalDisconnect = false;
        this.sessionId = sessionId;
        this.connectionParams = { sessionId, language, provider, consultationId };
        
        const token = this.getAuthToken();
        if (!token) {
          reject(new Error('No authentication token available'));
          return;
        }
        
        const wsBaseUrl = this.wsBaseURL || 'ws://localhost:8000';
        const wsUrl = `${wsBaseUrl}/conversation/stream?token=${encodeURIComponent(token)}`;
        
        console.log('Attempting WebSocket connection to:', wsUrl.replace(token, '[TOKEN]'));
        
        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000); // 10 second timeout
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0;
          
          this.ws.send(JSON.stringify({
            type: 'init',
            session_id: sessionId,
            language: language,
            provider: provider,
            consultation_id: consultationId
          }));

          this.startPingInterval();
          resolve(this.ws);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.stopPingInterval();
          this.handleDisconnection();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(connectionTimeout);
          this.stopPingInterval();
          
          let errorMessage = 'WebSocket connection failed';
          if (error && typeof error === 'object') {
            if (error.type) {
              errorMessage += `: ${error.type}`;
            } else if (error.message) {
              errorMessage += `: ${error.message}`;
            } else if (error.code) {
              errorMessage += `: Code ${error.code}`;
            }
          } else if (typeof error === 'string') {
            errorMessage += `: ${error}`;
          }
          
          const wsError = new Error(errorMessage);
          wsError.originalEvent = error;
          
          if (!this.isIntentionalDisconnect) {
            reject(wsError);
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  handleMessage(message) {
    const { type } = message;
    if (type === 'pong') return;
    
    if (this.messageHandlers.has(type)) {
      this.messageHandlers.get(type).forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in message handler for ${type}:`, error);
        }
      });
    }
  }

  handleDisconnection() {
    if (this.isIntentionalDisconnect || 
        !this.connectionParams || 
        this.reconnectAttempts >= this.maxReconnectAttempts) {
      
      this.emit('connection_lost', {
        message: 'Connection lost',
        intentional: this.isIntentionalDisconnect
      });
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.connectWebSocket(
        this.connectionParams.sessionId,
        this.connectionParams.language,
        this.connectionParams.provider,
        this.connectionParams.consultationId
      ).catch(error => {
        console.error('Reconnection failed:', error);
        this.handleDisconnection();
      });
      
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  off(messageType, handler) {
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    this.handleMessage({ type: event, ...data });
  }

  sendAudioChunk(audioBlob, language, provider, isStreaming = true) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const base64Data = reader.result.split(',')[1];
          
          this.ws.send(JSON.stringify({
            type: 'audio_chunk',
            audio: base64Data,
            language: language,
            provider: provider,
            is_streaming: isStreaming,
            encoding: 'webm',
            sample_rate: 16000
          }));
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read audio blob'));
      };
      
      reader.readAsDataURL(audioBlob);
    });
  }

  sendTextMessage(text, language, provider) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'text_message',
      text: text,
      language: language,
      provider: provider
    }));
  }

  sendFlushSignal() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ type: 'flush' }));
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    this.stopPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }
    
    this.connectionParams = null;
    this.reconnectAttempts = 0;
  }

  // =============================================
  // ANALYTICS & HEALTH CHECK
  // =============================================

  async logEvent(eventType, data = {}) {
    try {
      const token = this.getAuthToken();
      const endpoint = token ? '/analytics/event' : '/analytics/event/public';
      const headers = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: eventType,
          data: {
            timestamp: Date.now(),
            ...data
          }
        }),
        timeout: 5000
      });
    } catch (error) {
      console.warn('Analytics event logging failed:', error);
    }
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // =============================================
  // CLEANUP
  // =============================================

  cleanup() {
    this.requestTimeouts.forEach((timeoutId, endpoint) => {
      clearTimeout(timeoutId);
    });
    this.requestTimeouts.clear();
    this.disconnect();
  }
}

// Create and export singleton instance
export const unifiedApiService = new UnifiedApiService();
