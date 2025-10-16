#!/usr/bin/env python3
"""
Debug script to test session memory
"""

from integrations.unified_services import openai_service
import time

def test_session_memory():
    """Test session memory functionality"""
    print("🧪 Testing Session Memory Debug")
    print("=" * 50)
    
    # Test session memory
    session_id = 'test-debug-session'
    print('Testing session memory...')
    
    # First message
    print('\n1. First message:')
    response1 = openai_service.generate_response(
        'Hello doctor. My name is Devangi Barwalia and I am a 21 years old female.', 
        session_id=session_id
    )
    print(f'Response: {response1}')
    
    # Second message
    print('\n2. Second message:')
    response2 = openai_service.generate_response(
        'I am experiencing heavy fever and light headache.', 
        session_id=session_id
    )
    print(f'Response: {response2}')
    
    # Check session info
    print('\n3. Session info:')
    info = openai_service.get_session_info()
    print(f'Total sessions: {info["total_sessions"]}')
    for session in info['sessions']:
        print(f'Session {session["session_id"]}: {session["message_count"]} messages')
    
    # Get conversation history
    print('\n4. Conversation history:')
    conv = openai_service.get_session_conversation(session_id)
    for i, msg in enumerate(conv):
        print(f'{i+1}. {msg["role"]}: {msg["content"][:100]}...')
    
    print('\n5. Testing if AI remembers:')
    response3 = openai_service.generate_response(
        'What should I do about my fever?', 
        session_id=session_id
    )
    print(f'Response: {response3}')
    
    # Check if response contains patient name
    if 'devangi' in response3.lower():
        print('✅ SUCCESS: AI remembered the patient name!')
    else:
        print('❌ FAILED: AI did not remember the patient name')
    
    if '21' in response3 or 'twenty-one' in response3.lower():
        print('✅ SUCCESS: AI remembered the patient age!')
    else:
        print('❌ FAILED: AI did not remember the patient age')
    
    # Test with a more direct question about age
    print('\n6. Testing age-specific question:')
    response4 = openai_service.generate_response(
        'Is this normal for someone my age?', 
        session_id=session_id
    )
    print(f'Response: {response4}')
    
    if '21' in response4 or 'twenty-one' in response4.lower():
        print('✅ SUCCESS: AI referenced age in age-specific question!')
    else:
        print('❌ FAILED: AI did not reference age in age-specific question')

if __name__ == "__main__":
    test_session_memory()
