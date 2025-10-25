"""
Authenticated WebSocket Transport for Pipecat
Wraps Pipecat's WebSocket transport with JWT authentication
"""

import logging
from typing import Optional, Dict, Any

from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from pipecat.frames.frames import (
    Frame,
    AudioRawFrame,
    TTSAudioRawFrame,
    TranscriptionFrame,
    TextFrame,
    ErrorFrame,
    CancelFrame,
    StartFrame,
    EndFrame,
    LLMFullResponseEndFrame
)

from utils.utils import decode_token
from database.redis import token_in_blocklist

logger = logging.getLogger(__name__)


class AuthenticatedWebSocketTransport(FrameProcessor):
    """
    WebSocket transport with JWT authentication
    Handles bidirectional audio/text streaming for Pipecat pipeline
    Acts as both input source and output sink in the pipeline
    """
    
    def __init__(
        self,
        websocket: WebSocket,
        authenticated_user: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self._websocket = websocket
        self._authenticated_user = authenticated_user
        self._audio_buffer = bytearray()
        self._connected = True  # WebSocket is already accepted, so we're connected
        logger.info("AuthenticatedWebSocketTransport initialized (FrameProcessor) - connected")
    
    @staticmethod
    async def authenticate_after_accept(token: Optional[str]) -> Dict[str, Any]:
        """
        Authenticate after WebSocket is already accepted
        Use this when you've already called websocket.accept()
        
        Args:
            token: JWT access token
            
        Returns:
            User payload from token
            
        Raises:
            HTTPException: If authentication fails
        """
        if not token:
            raise HTTPException(status_code=401, detail="Missing authentication token")
        
        # Allow test token for development/testing
        if token == 'test-token-for-pipecat-demo' or token == 'test-token':
            logger.warning("⚠️ Using test token - ONLY FOR TESTING!")
            return {
                'user_id': 0,
                'username': 'test_user',
                'email': 'test@example.com',
                'role': 'test',
                'is_test': True
            }
        
        # Decode and validate token
        token_data = decode_token(token)
        if token_data is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Check if token is revoked
        jti = token_data.get("jti")
        if jti and await token_in_blocklist(jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        # Verify it's an access token
        if token_data.get("is_refresh", False):
            raise HTTPException(status_code=401, detail="Access token required")
        
        user_payload = token_data.get("user")
        if not user_payload or not isinstance(user_payload, dict):
            raise HTTPException(status_code=401, detail="Invalid user data in token")
        
        logger.info(f"WebSocket authenticated for user: {user_payload.get('username', 'unknown')}")
        return user_payload
    
    @staticmethod
    async def authenticate(websocket: WebSocket, token: Optional[str]) -> Dict[str, Any]:
        """
        Authenticate WebSocket connection using JWT token
        
        Args:
            websocket: FastAPI WebSocket connection
            token: JWT access token
            
        Returns:
            User payload from token
            
        Raises:
            HTTPException: If authentication fails
        """
        if not token:
            await websocket.close(code=1008, reason="Missing authentication token")
            raise HTTPException(status_code=401, detail="Missing authentication token")
        
        # Allow test token for development/testing
        if token == 'test-token-for-pipecat-demo' or token == 'test-token':
            logger.warning("⚠️ Using test token - ONLY FOR TESTING!")
            return {
                'user_id': 0,
                'username': 'test_user',
                'email': 'test@example.com',
                'role': 'test',
                'is_test': True
            }
        
        # Decode and validate token
        token_data = decode_token(token)
        if token_data is None:
            await websocket.close(code=1008, reason="Invalid or expired token")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Check if token is revoked
        jti = token_data.get("jti")
        if jti and await token_in_blocklist(jti):
            await websocket.close(code=1008, reason="Token has been revoked")
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        # Verify it's an access token
        if token_data.get("is_refresh", False):
            await websocket.close(code=1008, reason="Access token required")
            raise HTTPException(status_code=401, detail="Access token required")
        
        user_payload = token_data.get("user")
        if not user_payload or not isinstance(user_payload, dict):
            await websocket.close(code=1008, reason="Invalid user data in token")
            raise HTTPException(status_code=401, detail="Invalid user data in token")
        
        logger.info(f"WebSocket authenticated for user: {user_payload.get('username', 'unknown')}")
        return user_payload
    
    async def start(self):
        """Start the transport - accept WebSocket connection"""
        try:
            # Check if WebSocket is already accepted
            if self._websocket.client_state.value == 1:  # CONNECTED state
                logger.info("WebSocket already accepted, skipping accept()")
                self._connected = True
            else:
                await self._websocket.accept()
                self._connected = True
                logger.info("WebSocket transport started")
        except Exception as e:
            logger.error(f"Failed to start WebSocket transport: {e}")
            raise
    
    async def stop(self):
        """Stop the transport - close WebSocket connection"""
        try:
            if self._connected:
                await self._websocket.close()
                self._connected = False
                logger.info("WebSocket transport stopped")
        except Exception as e:
            logger.error(f"Error stopping WebSocket transport: {e}")
    
    async def read(self) -> Optional[Frame]:
        """
        Read frames from WebSocket
        Converts incoming audio data to AudioRawFrame
        
        Returns:
            Frame from client or None
        """
        try:
            if not self._connected:
                return None
            
            # Receive message from client
            data = await self._websocket.receive()
            
            # Check for disconnect
            if "type" in data and data["type"] == "websocket.disconnect":
                logger.info("WebSocket disconnect message received")
                self._connected = False
                return None
            
            # Handle different message types
            if "bytes" in data:
                # Binary audio data
                audio_bytes = data["bytes"]
                return AudioRawFrame(
                    audio=audio_bytes,
                    sample_rate=16000,
                    num_channels=1
                )
            
            elif "text" in data:
                # JSON control messages
                import json
                try:
                    message = json.loads(data["text"])
                    msg_type = message.get("type")
                    
                    if msg_type == "audio_chunk":
                        # Base64 encoded audio
                        import base64
                        audio_b64 = message.get("audio", "")
                        if audio_b64:
                            audio_bytes = base64.b64decode(audio_b64)
                            return AudioRawFrame(
                                audio=audio_bytes,
                                sample_rate=16000,
                                num_channels=1
                            )
                    
                    elif msg_type == "text":
                        # Text input (for testing or chat mode)
                        text = message.get("text", "")
                        if text:
                            return TextFrame(text)
                    
                    elif msg_type == "cancel":
                        # Cancel current processing
                        return CancelFrame()
                    
                    elif msg_type == "ping":
                        # Respond to ping with pong
                        await self._websocket.send_json({"type": "pong"})
                        return None
                
                except json.JSONDecodeError:
                    logger.warning("Received invalid JSON from client")
                    return None
            
            return None
        
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected by client")
            self._connected = False
            return None
        
        except RuntimeError as e:
            # Handle "Cannot call 'receive' once a disconnect message has been received"
            if "disconnect" in str(e).lower():
                logger.info("WebSocket already disconnected")
                self._connected = False
                return None
            logger.error(f"RuntimeError reading from WebSocket: {e}")
            self._connected = False
            return None
        
        except Exception as e:
            logger.error(f"Error reading from WebSocket: {e}")
            self._connected = False  # Disconnect on any error to stop loop
            return None  # Return None instead of ErrorFrame to avoid infinite loop
    
    async def write(self, frame: Frame):
        """
        Write frames to WebSocket
        Sends audio, text, and status frames to client
        
        Args:
            frame: Frame to send to client
        """
        try:
            if not self._connected:
                return
            
            # Handle different frame types
            if isinstance(frame, TTSAudioRawFrame):
                # Send audio data as binary
                await self._websocket.send_bytes(frame.audio)
            
            elif isinstance(frame, TranscriptionFrame):
                # Send transcription as JSON
                await self._websocket.send_json({
                    "type": "transcription",
                    "text": frame.text,
                    "is_final": True
                })
            
            elif isinstance(frame, TextFrame):
                # Send text chunk (LLM token)
                await self._websocket.send_json({
                    "type": "text_chunk",
                    "text": frame.text
                })
            
            elif isinstance(frame, LLMFullResponseEndFrame):
                # Send LLM response complete marker
                await self._websocket.send_json({
                    "type": "llm_response_complete"
                })
            
            elif isinstance(frame, ErrorFrame):
                # Send error to client
                await self._websocket.send_json({
                    "type": "error",
                    "message": str(frame.error)
                })
        
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected during write")
            self._connected = False
        
        except Exception as e:
            logger.error(f"Error writing to WebSocket: {e}")
    
    def is_connected(self) -> bool:
        """Check if WebSocket is still connected"""
        return self._connected
    
    def get_authenticated_user(self) -> Optional[Dict[str, Any]]:
        """Get authenticated user data"""
        return self._authenticated_user
    
    async def input(self) -> Optional[Frame]:
        """
        Input handler - required by Pipecat BaseTransport
        Reads frames from WebSocket
        """
        return await self.read()
    
    async def output(self, frame: Frame):
        """
        Output handler - required by Pipecat BaseTransport
        Writes frames to WebSocket
        """
        await self.write(frame)
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """
        Process frame - required by FrameProcessor
        This makes the transport work as part of the pipeline
        
        Args:
            frame: Frame to process
            direction: Direction of frame flow
        """
        # Handle control frames first
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)
            return
        
        # When frames come downstream to us (from TTS), send them to WebSocket
        if direction == FrameDirection.DOWNSTREAM:
            await self.write(frame)
        
        # Push frame downstream to next processor (if any, though we're usually the last)
        await self.push_frame(frame, direction)

