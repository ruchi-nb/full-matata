from config import settings
import redis.asyncio as redis_asyncio
import time
import logging
import json
import redis as redis_sync
from typing import Dict, List

JTI_EXPIRY = getattr(settings, "JTI_EXPIRY_SECONDS", 3600)

_redis_client = None
_exception_info = None

host = getattr(settings, "REDIS_HOST", "localhost")
port = int(getattr(settings, "REDIS_PORT", 6379))
_redis_client = redis_asyncio.Redis(host=host, port=port, db=0, decode_responses=True, socket_timeout=5.0, socket_connect_timeout=5.0, health_check_interval=60, retry_on_timeout=True)
_memory_blocklist: dict[str, int] = {}

async def add_jti_to_blocklist(jti: str) -> None:
    if not jti:
        return
    if _redis_client is not None:
        try:
            await _redis_client.set(name=jti, value="1", ex=JTI_EXPIRY)
            return
        except Exception:
            pass

    _memory_blocklist[jti] = int(time.time()) + JTI_EXPIRY

async def token_in_blocklist(jti: str) -> bool:
    if not jti:
        return False
    if _redis_client is not None:
        try:
            val = await _redis_client.get(jti)
            return val is not None
        except Exception:
            pass
    exp_ts = _memory_blocklist.get(jti)
    if exp_ts is None:
        return False
    if exp_ts < int(time.time()):
        try:
            del _memory_blocklist[jti]
        except KeyError:
            pass
        return False
    return True


def get_redis_init_error() -> str | None:
    return _exception_info


logger = logging.getLogger(__name__)


class SessionManager:
    """
    OpenAI Session Manager
    Handles Redis-based session management for conversation history
    """

    def __init__(self) -> None:
        # Redis client for session management (sync client for existing logic)
        try:
            self.redis = redis_sync.Redis.from_url(settings.REDIS_URL, decode_responses=True)
            # Test connection
            self.redis.ping()
            logger.info("✅ Redis connection established for session management")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            logger.warning("Falling back to in-memory session storage")
            self.redis = None

        # Session management configuration
        self.max_session_messages = 20  # Keep last 20 messages per session
        self.session_timeout = 3600  # 1 hour timeout

    def _get_or_create_session(self, session_id: str) -> List[Dict[str, str]]:
        """Get existing session or create new one from Redis"""
        if self.redis is None:
            # Fallback to in-memory storage if Redis is not available
            return []

        try:
            # Get messages from Redis
            messages_key = f"session:{session_id}:messages"
            messages_data = self.redis.lrange(messages_key, 0, -1)

            # Parse messages from JSON
            messages = []
            for msg_data in messages_data:
                try:
                    messages.append(json.loads(msg_data))
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse message in session {session_id}: {msg_data}")
                    continue

            # Update last access timestamp
            self.redis.set(f"session:{session_id}:last_access", time.time())

            return messages
        except Exception as e:
            logger.error(f"Error getting session {session_id} from Redis: {e}")
            return []

    def _add_message_to_session(self, session_id: str, role: str, content: str):
        """Add message to session history in Redis"""
        if self.redis is None:
            # Fallback: do nothing if Redis is not available
            return

        try:
            messages_key = f"session:{session_id}:messages"
            message = {"role": role, "content": content}

            # Add message to Redis list
            self.redis.rpush(messages_key, json.dumps(message))

            # Keep only the last max_session_messages
            current_length = self.redis.llen(messages_key)
            if current_length > self.max_session_messages:
                # Check if first message is system message
                first_msg_data = self.redis.lindex(messages_key, 0)
                if first_msg_data:
                    try:
                        first_msg = json.loads(first_msg_data)
                        if first_msg.get("role") == "system":
                            # Keep system message + last (max_session_messages-1) messages
                            self.redis.ltrim(messages_key, 0, 0)  # Keep system message
                            self.redis.ltrim(messages_key, -(self.max_session_messages-1), -1)  # Keep last N-1 messages
                        else:
                            # No system message, just keep last max_session_messages
                            self.redis.ltrim(messages_key, -(self.max_session_messages), -1)
                    except json.JSONDecodeError:
                        # If first message is corrupted, just trim to last max_session_messages
                        self.redis.ltrim(messages_key, -(self.max_session_messages), -1)
                else:
                    # No messages, just trim to last max_session_messages
                    self.redis.ltrim(messages_key, -(self.max_session_messages), -1)

            # Update last access timestamp
            self.redis.set(f"session:{session_id}:last_access", time.time())

        except Exception as e:
            logger.error(f"Error adding message to session {session_id} in Redis: {e}")

    def get_session_messages(self, session_id: str, system_prompt: str) -> List[Dict[str, str]]:
        """Get conversation history for a session from Redis"""
        messages = self._get_or_create_session(session_id)

        # Ensure system prompt is always first
        if not messages or messages[0].get("role") != "system":
            # If no system message or first message is not system, add it
            system_message = {"role": "system", "content": system_prompt}
            messages.insert(0, system_message)

            # Update Redis with system message
            if self.redis is not None:
                try:
                    messages_key = f"session:{session_id}:messages"
                    # Remove existing messages and add system message first
                    self.redis.delete(messages_key)
                    for msg in messages:
                        self.redis.rpush(messages_key, json.dumps(msg))
                except Exception as e:
                    logger.error(f"Error updating session {session_id} with system message: {e}")

        # Debug logging
        logger.info(f"Session {session_id} has {len(messages)} messages")
        for i, msg in enumerate(messages):
            try:
                logger.info(f"Message {i}: {msg['role']} - {msg['content'][:100]}...")
            except UnicodeEncodeError:
                logger.info(f"Message {i}: {msg['role']} - [Unicode content]")

        return messages

    def add_message_to_session(self, session_id: str, role: str, content: str):
        """Add message to session history"""
        self._add_message_to_session(session_id, role, content)

    def clear_session(self, session_id: str):
        """Clear a specific session from Redis"""
        if self.redis is None:
            return

        try:
            # Delete session messages and timestamp
            self.redis.delete(f"session:{session_id}:messages")
            self.redis.delete(f"session:{session_id}:last_access")
            logger.info(f"Cleared session: {session_id}")
        except Exception as e:
            logger.error(f"Error clearing session {session_id}: {e}")

    def clear_all_sessions(self):
        """Clear all sessions from Redis"""
        if self.redis is None:
            return

        try:
            # Find all session keys and delete them
            session_keys = self.redis.keys("session:*")
            if session_keys:
                self.redis.delete(*session_keys)
                logger.info(f"Cleared {len(session_keys)} session keys")
        except Exception as e:
            logger.error(f"Error clearing all sessions: {e}")

    def cleanup_expired_sessions(self):
        """Remove sessions that have exceeded the timeout from Redis"""
        if self.redis is None:
            return 0

        try:
            current_time = time.time()
            expired_sessions = []

            # Find all session timestamp keys
            timestamp_keys = self.redis.keys("session:*:last_access")

            for timestamp_key in timestamp_keys:
                try:
                    # Extract session_id from key (format: session:{session_id}:last_access)
                    session_id = timestamp_key.split(":")[1]
                    timestamp = float(self.redis.get(timestamp_key))

                    if current_time - timestamp > self.session_timeout:
                        expired_sessions.append(session_id)
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid timestamp for key {timestamp_key}: {e}")
                    continue

            # Clean up expired sessions
            for session_id in expired_sessions:
                self.clear_session(session_id)
                logger.info(f"Cleaned up expired session: {session_id}")

            return len(expired_sessions)
        except Exception as e:
            logger.error(f"Error cleaning up expired sessions: {e}")
            return 0

    def get_session_info(self) -> Dict[str, any]:
        """Get information about current sessions from Redis"""
        if self.redis is None:
            return {"total_sessions": 0, "sessions": []}

        try:
            current_time = time.time()
            active_sessions = []

            # Find all session timestamp keys
            timestamp_keys = self.redis.keys("session:*:last_access")

            for timestamp_key in timestamp_keys:
                try:
                    # Extract session_id from key
                    session_id = timestamp_key.split(":")[1]
                    timestamp = float(self.redis.get(timestamp_key))
                    age_seconds = current_time - timestamp

                    # Get message count
                    messages_key = f"session:{session_id}:messages"
                    message_count = self.redis.llen(messages_key)

                    active_sessions.append({
                        "session_id": session_id,
                        "age_seconds": int(age_seconds),
                        "message_count": message_count,
                        "is_expired": age_seconds > self.session_timeout
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid timestamp for key {timestamp_key}: {e}")
                    continue

            return {
                "total_sessions": len(active_sessions),
                "sessions": active_sessions
            }
        except Exception as e:
            logger.error(f"Error getting session info: {e}")
            return {"total_sessions": 0, "sessions": []}

    def get_session_conversation(self, session_id: str) -> List[Dict[str, str]]:
        """Get the full conversation history for a specific session from Redis"""
        return self._get_or_create_session(session_id)
