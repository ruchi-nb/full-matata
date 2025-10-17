// File: services/websocketService.js
class WebSocketStreamingService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connectionParams = null;
    this.isIntentionalDisconnect = false;
    this.pingInterval = null;
    this.reconnectTimeout = null;
  }

  connect(sessionId, language, provider, consultationId = null) {
    return new Promise((resolve, reject) => {
      try {
        this.isIntentionalDisconnect = false;
        this.sessionId = sessionId;
        
        // Store connection parameters for reconnection
        this.connectionParams = { sessionId, language, provider, consultationId };
        
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/conversation/stream`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Initialize session
          this.ws.send(JSON.stringify({
            type: 'init',
            session_id: sessionId,
            language: language,
            provider: provider,
            consultation_id: consultationId
          }));

          // Start ping interval to keep connection alive
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
          console.error('WebSocket error event:', error);
          this.stopPingInterval();
          
          // Convert DOM Event to proper Error object
          const wsError = new Error(
            `WebSocket connection failed: ${error.type || 'Unknown error'}`
          );
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
    this.stopPingInterval(); // Clear any existing interval
    
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  handleMessage(message) {
    const { type } = message;
    
    // Handle pong responses
    if (type === 'pong') {
      return; // No need to process pong messages
    }
    
    if (this.messageHandlers.has(type)) {
      this.messageHandlers.get(type).forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in message handler for ${type}:`, error);
        }
      });
    }

    if (this.messageHandlers.has('*')) {
      this.messageHandlers.get('*').forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in wildcard message handler:', error);
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

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.connect(
        this.connectionParams.sessionId,
        this.connectionParams.language,
        this.connectionParams.provider,
        this.connectionParams.consultationId
      ).catch(error => {
        console.error('Reconnection failed:', error);
        this.handleDisconnection(); // Continue reconnection attempts
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

  sendFinalAudio(audioBlob, language, provider) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const base64Data = reader.result.split(',')[1];
          
          this.ws.send(JSON.stringify({
            type: 'final_audio',
            audio: base64Data,
            language: language,
            provider: provider,
            is_streaming: false
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

    this.ws.send(JSON.stringify({
      type: 'flush'
    }));
  }

  sendStopSignal() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'stop'
    }));
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionState() {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'disconnected';
    }
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
}

export const websocketService = new WebSocketStreamingService();