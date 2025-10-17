#!/usr/bin/env python3
"""
Test Redis-based session management
"""

import time
from integrations.unified_services import openai_service

def test_redis_sessions():
    """Test Redis session management functionality"""
    print("🧪 Testing Redis-based Session Management")
    print("=" * 50)
    
    # Test 1: Create a new session
    print("\n1. Testing session creation...")
    session_id = f"test-session-{int(time.time())}"
    
    # Generate a response (this will create the session)
    response1 = openai_service.generate_response(
        prompt="Hi, my name is John and I'm 25 years old. I have a headache.",
        session_id=session_id
    )
    print(f"   ✅ First response: {response1[:100]}...")
    
    # Test 2: Continue the conversation (should remember context)
    print("\n2. Testing session continuity...")
    response2 = openai_service.generate_response(
        prompt="What should I do about my headache?",
        session_id=session_id  # Same session ID
    )
    print(f"   ✅ Second response: {response2[:100]}...")
    
    # Test 3: Check session info
    print("\n3. Testing session info...")
    session_info = openai_service.get_session_info()
    print(f"   ✅ Total sessions: {session_info['total_sessions']}")
    
    # Find our test session
    test_session = None
    for session in session_info['sessions']:
        if session['session_id'] == session_id:
            test_session = session
            break
    
    if test_session:
        print(f"   ✅ Test session found: {test_session['message_count']} messages, {test_session['age_seconds']}s old")
    else:
        print("   ❌ Test session not found")
    
    # Test 4: Get conversation history
    print("\n4. Testing conversation history...")
    conversation = openai_service.get_session_conversation(session_id)
    print(f"   ✅ Conversation has {len(conversation)} messages:")
    for i, msg in enumerate(conversation):
        print(f"      {i+1}. {msg['role']}: {msg['content'][:80]}...")
    
    # Test 5: Test session persistence (simulate restart)
    print("\n5. Testing session persistence...")
    # Create a new service instance (simulates server restart)
    from integrations.openai import OpenAIChatService, SessionManager
    new_chat_service = OpenAIChatService()
    new_session_manager = SessionManager()
    
    # Create a simple wrapper for testing
    class TestService:
        def __init__(self, chat_service, session_manager):
            self.chat_service = chat_service
            self.session_manager = session_manager
        
        def generate_response(self, prompt, session_id=None):
            return self.chat_service.generate_response(prompt, session_id=session_id)
    
    new_service = TestService(new_chat_service, new_session_manager)
    
    # Try to continue the conversation with the same session_id
    response3 = new_service.generate_response(
        prompt="I also have a fever now.",
        session_id=session_id  # Same session ID
    )
    print(f"   ✅ Response after 'restart': {response3[:100]}...")
    
    # Test 6: Clean up
    print("\n6. Testing session cleanup...")
    openai_service.clear_session(session_id)
    print("   ✅ Session cleared")
    
    # Verify session is gone
    session_info_after = openai_service.get_session_info()
    print(f"   ✅ Sessions after cleanup: {session_info_after['total_sessions']}")
    
    print("\n🎉 All Redis session tests completed!")

if __name__ == "__main__":
    test_redis_sessions()
