// File: services/enhancedAudioService.js
class EnhancedAudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.onDataAvailable = null;
    this.audioContext = null;
    this.analyser = null;
    this.recordingStartTime = 0;
    this.volumeMonitoringId = null;
    this.events = {};
    
    this.recordingStats = {
      totalChunks: 0,
      totalBytes: 0,
      averageChunkSize: 0,
      duration: 0
    };
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  async startEnhancedRecording(options = {}) {
    const {
      onDataAvailable = null,
      onVolumeChange = null,
      onSilenceDetected = null,
      sampleRate = 16000,
      channelCount = 1,
      echoCancellation = true,
      noiseSuppression = true,
      autoGainControl = true,
      silenceThreshold = 0.01,
      silenceDuration = 2000 // ms
    } = options;

    try {
      // Stop any existing recording first
      if (this.isRecording) {
        await this.stopRecording();
      }

      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate,
          channelCount,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          ...(sampleRate && { sampleRate: { ideal: sampleRate, max: sampleRate } })
        } 
      });

      // Initialize audio context for volume monitoring
      if (onVolumeChange || onSilenceDetected) {
        await this.initializeAudioMonitoring(onVolumeChange, onSilenceDetected, silenceThreshold, silenceDuration);
      }

      const mimeType = this.getBestMimeType();
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128 kbps
      });

      this.onDataAvailable = onDataAvailable;
      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      this.recordingStats = {
        totalChunks: 0,
        totalBytes: 0,
        averageChunkSize: 0,
        duration: 0
      };

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.updateRecordingStats(event.data);
          
          if (this.onDataAvailable) {
            this.onDataAvailable(event.data, this.getRecordingStats());
          }
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        this.emit('recording_error', { error: event.error });
      };

      this.mediaRecorder.onstop = () => {
        this.recordingStats.duration = Date.now() - this.recordingStartTime;
        this.emit('recording_stopped', this.getRecordingStats());
      };

      // Start with small chunks for low latency
      this.mediaRecorder.start(100);
      this.isRecording = true;

      console.log('Enhanced recording started with options:', { sampleRate, channelCount });
      this.emit('recording_started', { startTime: this.recordingStartTime });

    } catch (error) {
      console.error('Error starting enhanced recording:', error);
      this.emit('recording_error', { error });
      throw error;
    }
  }

  async initializeAudioMonitoring(onVolumeChange, onSilenceDetected, silenceThreshold, silenceDuration) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      source.connect(this.analyser);

      this.startVolumeMonitoring(onVolumeChange, onSilenceDetected, silenceThreshold, silenceDuration);
    } catch (error) {
      console.warn('Audio monitoring initialization failed:', error);
      this.emit('monitoring_error', { error });
    }
  }

  startVolumeMonitoring(onVolumeChange, onSilenceDetected, silenceThreshold, silenceDuration) {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let silenceStartTime = null;
    let lastVolume = 0;

    const checkVolume = () => {
      if (!this.isRecording || !this.analyser) {
        this.volumeMonitoringId = null;
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length) / 255; // Normalize to 0-1
      
      // Smooth volume changes to prevent flickering
      const smoothedVolume = lastVolume * 0.7 + rms * 0.3;
      lastVolume = smoothedVolume;

      if (onVolumeChange) {
        onVolumeChange(smoothedVolume);
      }

      // Silence detection
      if (smoothedVolume < silenceThreshold) {
        if (silenceStartTime === null) {
          silenceStartTime = Date.now();
        } else if (Date.now() - silenceStartTime > silenceDuration) {
          if (onSilenceDetected) {
            onSilenceDetected({
              duration: Date.now() - silenceStartTime,
              threshold: silenceThreshold
            });
          }
          silenceStartTime = null;
        }
      } else {
        silenceStartTime = null;
      }

      if (this.isRecording) {
        this.volumeMonitoringId = requestAnimationFrame(checkVolume);
      } else {
        this.volumeMonitoringId = null;
      }
    };

    this.volumeMonitoringId = requestAnimationFrame(checkVolume);
  }

  getBestMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using audio format:', type);
        return type;
      }
    }

    console.warn('No preferred MIME type supported, using default');
    return '';
  }

  updateRecordingStats(chunk) {
    this.recordingStats.totalChunks++;
    this.recordingStats.totalBytes += chunk.size;
    this.recordingStats.averageChunkSize = this.recordingStats.totalBytes / this.recordingStats.totalChunks;
    this.recordingStats.duration = Date.now() - this.recordingStartTime;
  }

  getRecordingStats() {
    return {
      ...this.recordingStats,
      currentDuration: Date.now() - this.recordingStartTime,
      isRecording: this.isRecording
    };
  }

  async stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }

    // Stop volume monitoring
    if (this.volumeMonitoringId) {
      cancelAnimationFrame(this.volumeMonitoringId);
      this.volumeMonitoringId = null;
    }

    // Stop all audio tracks
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }

    this.emit('recording_stopped', this.getRecordingStats());
  }

  // Audio processing utilities
  async convertAudioFormat(audioBlob, targetFormat = 'audio/wav') {
    try {
      // Simple conversion - in a real implementation, you'd use a proper audio converter
      if (audioBlob.type === targetFormat) {
        return audioBlob;
      }
      
      // For now, return the original blob
      // In production, you might want to use a library like ffmpeg.js
      console.warn('Audio format conversion not implemented, returning original');
      return audioBlob;
    } catch (error) {
      console.error('Error converting audio format:', error);
      return audioBlob;
    }
  }

  async getAudioDuration(audioBlob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src); // Clean up
      };
      audio.onerror = () => {
        resolve(0); // Fallback if duration cannot be determined
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(audioBlob);
    });
  }

  // Audio analysis
  async analyzeAudio(audioBlob) {
    try {
      const duration = await this.getAudioDuration(audioBlob);
      return {
        duration,
        size: audioBlob.size,
        type: audioBlob.type,
        sampleRate: 16000, // Default assumption
        channels: 1
      };
    } catch (error) {
      console.error('Error analyzing audio:', error);
      return {
        duration: 0,
        size: audioBlob.size,
        type: audioBlob.type,
        error: error.message
      };
    }
  }

  // Check if recording is supported
  isRecordingSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && MediaRecorder);
  }

  // Get available audio devices
  async getAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }

  // Enhanced cleanup
  enhancedCleanup() {
    this.stopRecording();

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.audioChunks = [];
    this.onDataAvailable = null;
    this.events = {};
    
    console.log('Enhanced audio service cleaned up');
  }

  // Utility method to check permissions
  async checkMicrophonePermission() {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      return result.state;
    } catch (error) {
      console.warn('Microphone permission check not supported:', error);
      return 'prompt';
    }
  }
}

// Create and export singleton instance
export const enhancedAudioService = new EnhancedAudioService();