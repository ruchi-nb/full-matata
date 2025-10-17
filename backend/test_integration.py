#!/usr/bin/env python3
"""
Phase 3.1: Integration Testing Script
Tests backend health checks and WebSocket functionality
"""

import asyncio
import sys
import os
sys.path.append('.')

async def test_health_checks():
    print('Testing Backend Health Checks...')
    
    try:
        from routes.routes_health import check_database_connectivity, check_redis_connectivity, check_external_services
        
        print('\nTesting Database Connectivity...')
        db_status = await check_database_connectivity()
        print(f'Database Status: {db_status["status"]}')
        if db_status['status'] == 'healthy':
            print(f'Response Time: {db_status["response_time_ms"]}ms')
            print(f'User Count: {db_status["user_count"]}')
        else:
            print(f'Error: {db_status["error"]}')
        
        print('\nTesting Redis Connectivity...')
        redis_status = await check_redis_connectivity()
        print(f'Redis Status: {redis_status["status"]}')
        if redis_status['status'] == 'healthy':
            print(f'Response Time: {redis_status["response_time_ms"]}ms')
            print(f'Redis Version: {redis_status["redis_info"]["redis_version"]}')
        else:
            print(f'Error: {redis_status["error"]}')
        
        print('\nTesting External Services...')
        services_status = await check_external_services()
        for service, status in services_status.items():
            print(f'{service.upper()}: {status["status"]}')
            if status['status'] == 'healthy':
                print(f'  Response Time: {status["response_time_ms"]}ms')
                print(f'  API Key Valid: {status["api_key_valid"]}')
            else:
                print(f'  Error: {status["error"]}')
                
    except Exception as e:
        print(f'Error importing health check functions: {e}')
        print('This is expected if the backend server is not running.')
        print('Please start the backend server first with: python main.py')

async def test_websocket_functionality():
    print('\nTesting WebSocket Functionality...')
    
    try:
        import websocket
        import json
        import threading
        import time
        
        # Test WebSocket connection
        def on_message(ws, message):
            try:
                data = json.loads(message)
                print(f'Received: {data["type"]}')
                if data["type"] == "connection_established":
                    print('WebSocket connection established')
                    # Send a ping
                    ws.send(json.dumps({"type": "ping"}))
                elif data["type"] == "pong":
                    print('Ping/Pong working')
                    ws.close()
            except Exception as e:
                print(f'Error handling message: {e}')
        
        def on_error(ws, error):
            print(f'WebSocket error: {error}')
        
        def on_close(ws, close_status_code, close_msg):
            print('WebSocket connection closed')
        
        def on_open(ws):
            print('WebSocket connection opened')
            # Send init message
            ws.send(json.dumps({
                "type": "init",
                "session_id": "test-session",
                "language": "en-IN",
                "provider": "deepgram"
            }))
        
        # Try to connect to WebSocket
        ws_url = "ws://localhost:8000/conversation/stream?token=test-token"
        ws = websocket.WebSocketApp(ws_url,
                                  on_open=on_open,
                                  on_message=on_message,
                                  on_error=on_error,
                                  on_close=on_close)
        
        # Run WebSocket in a separate thread
        ws_thread = threading.Thread(target=ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        
        # Wait for connection test
        time.sleep(2)
        
    except ImportError:
        print('websocket-client not installed. Install with: pip install websocket-client')
    except Exception as e:
        print(f'WebSocket test error: {e}')
        print('This is expected if the backend server is not running.')

async def main():
    print('Phase 3.1: Integration Testing Started\n')
    
    await test_health_checks()
    await test_websocket_functionality()
    
    print('\nPhase 3.1 Testing Complete!')
    print('\nNext Steps:')
    print('1. Start the backend server: python main.py')
    print('2. Start the frontend server: npm run dev')
    print('3. Test the full integration in the browser')

if __name__ == "__main__":
    asyncio.run(main())