"""
Streaming Configuration for Consistent Real-time TTS
Fine-tune these parameters based on your network and latency requirements
"""

# Adaptive Buffer Settings
STREAMING_CONFIG = {
    # Deepgram TTS Streaming (MP3)
    "deepgram": {
        "min_buffer_ms": 30,      # Minimum buffer for consistency
        "max_buffer_ms": 150,     # Maximum buffer to prevent delay
        "target_chunk_ms": 80,    # Target chunk duration
        "sample_rate": 24000,     # Deepgram default sample rate
        "encoding": "mp3"
    },
    
    # Sarvam TTS Streaming (WAV/PCM)
    "sarvam": {
        "min_buffer_ms": 80,      # Higher for variable chunks
        "max_buffer_ms": 250,     # Allow more buffering for stability
        "target_chunk_ms": 120,   # Larger chunks for WAV
        "sample_rate": 16000,     # Sarvam uses 16kHz
        "encoding": "wav"
    },
    
    # Network and Performance Settings
    "network": {
        "connection_timeout": 3.0,    # WebSocket connection timeout
        "chunk_timeout": 0.3,         # Individual chunk timeout
        "stream_timeout": 15.0,       # Overall stream timeout
        "retry_attempts": 2,          # Number of retry attempts
        "backoff_factor": 1.5         # Exponential backoff multiplier
    },
    
    # Quality vs Latency Trade-offs
    "quality_profiles": {
        "ultra_low_latency": {
            "min_buffer_ms": 20,
            "max_buffer_ms": 100,
            "target_chunk_ms": 60,
            "description": "Minimal latency, may have occasional gaps"
        },
        
        "balanced": {
            "min_buffer_ms": 50,
            "max_buffer_ms": 200,
            "target_chunk_ms": 100,
            "description": "Good balance of latency and consistency"
        },
        
        "high_consistency": {
            "min_buffer_ms": 100,
            "max_buffer_ms": 400,
            "target_chunk_ms": 200,
            "description": "Maximum consistency, higher latency"
        }
    }
}


def get_streaming_config(provider: str = "sarvam", profile: str = "balanced"):
    """Get optimized streaming configuration"""
    config = STREAMING_CONFIG[provider].copy()
    
    if profile in STREAMING_CONFIG["quality_profiles"]:
        profile_config = STREAMING_CONFIG["quality_profiles"][profile]
        config.update({
            "min_buffer_ms": profile_config["min_buffer_ms"],
            "max_buffer_ms": profile_config["max_buffer_ms"],
            "target_chunk_ms": profile_config["target_chunk_ms"]
        })
    
    config["network"] = STREAMING_CONFIG["network"].copy()
    return config