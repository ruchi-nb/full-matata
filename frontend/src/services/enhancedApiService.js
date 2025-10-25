// File: services/enhancedApiService.js
class EnhancedApiService {
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL;
    this.wsBaseURL = process.env.NEXT_PUBLIC_WS_URL;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.requestTimeouts = new Map(); // Track timeouts for cleanup
  }

  async requestWithRetry(endpoint, options = {}, retries = this.maxRetries) {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || 30000; // Default 30 second timeout
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      let timeoutId;
      const controller = new AbortController();
      
      try {
        // Setup timeout
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

        // Remove body from config if it's FormData (let browser set Content-Type)
        if (options.body instanceof FormData) {
          delete config.headers['Content-Type'];
        }

        const response = await fetch(url, config);
        
        // Clear timeout on success
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(endpoint);
        
        if (response.status === 429) { // Rate limiting
          const delay = Math.min(attempt * this.retryDelay, 10000);
          await this.delay(delay);
          continue;
        }
        
        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { detail: `HTTP error! status: ${response.status}` };
          }
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        // Handle different response types
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
        
      } catch (error) {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.requestTimeouts.delete(endpoint);
        }
        
        if (attempt === retries) {
          console.error(`API request failed after ${retries} attempts:`, error);
          throw error;
        }
        
        if (error.name === 'AbortError') {
          console.warn(`Request timeout (attempt ${attempt}/${retries})`);
        } else {
          console.warn(`Request failed (attempt ${attempt}/${retries}):`, error.message);
        }
        
        await this.delay(attempt * this.retryDelay);
      }
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enhanced STT with multiple providers
  async enhancedSTT(audioBlob, options = {}) {
    const {
      provider = 'sarvam',
      language = 'en-IN',
      sessionId = null,
      consultationId = null,
      streaming = false,
      diarize = false,
      returnUtterances = false
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
      formData.append('return_utterances', returnUtterances.toString());
    }

    return this.requestWithRetry('/conversation/speech', {
      method: 'POST',
      body: formData,
      timeout: 60000 // 60 seconds for STT
    });
  }

  // Enhanced TTS with voice selection
  async enhancedTTS(text, options = {}) {
    const {
      provider = 'sarvam',
      language = 'hi-IN',
      voice = 'hitesh',
      streaming = true
    } = options;

    if (streaming) {
      return this.streamTTS(text, language, provider, voice);
    }

    // For non-streaming TTS (currently only Deepgram supports this)
    if (provider === 'deepgram') {
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

    throw new Error(`Non-streaming TTS not supported for provider: ${provider}`);
  }

  // TTS streaming method
  async streamTTS(text, language, provider, voice) {
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

  // Send text message via API (fallback when WebSocket is not available)
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

  // Session management with enhanced capabilities
  async createSession(consultationId = null, sessionType = 'speech') {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Optionally create consultation session in backend
    if (consultationId) {
      try {
        await this.requestWithRetry('/consultation/session', {
          method: 'POST',
          body: JSON.stringify({
            consultation_id: consultationId,
            session_type: sessionType,
            session_status: 'active'
          }),
          timeout: 10000
        });
      } catch (error) {
        console.warn('Failed to create backend session, continuing with frontend session only:', error);
        // Don't throw error - we can continue with frontend session ID
      }
    }
    
    return sessionId;
  }

  // Clear session data
  async clearSession(sessionId) {
    try {
      await this.requestWithRetry('/conversation/clear', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        timeout: 10000
      });
    } catch (error) {
      console.warn('Failed to clear backend session:', error);
    }
  }

  // Analytics integration
  async logEvent(eventType, data = {}) {
    try {
      await fetch(`${this.baseURL}/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          timestamp: Date.now(),
          ...data
        }),
        timeout: 5000 // Short timeout for analytics
      });
    } catch (error) {
      console.warn('Analytics event logging failed:', error);
      // Don't throw error for analytics failures
    }
  }

  // Health check
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

  // Get available services status
  async getServicesStatus() {
    try {
      return await this.requestWithRetry('/services/status', {
        method: 'GET',
        timeout: 10000
      });
    } catch (error) {
      console.warn('Failed to get services status:', error);
      return {
        openai: false,
        sarvam: false,
        deepgram: false,
        redis: false,
        api: false
      };
    }
  }

  // Cleanup method to abort pending requests
  cleanup() {
    this.requestTimeouts.forEach((timeoutId, endpoint) => {
      clearTimeout(timeoutId);
    });
    this.requestTimeouts.clear();
  }
}

export const enhancedApiService = new EnhancedApiService();