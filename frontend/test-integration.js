/**
 * Phase 3.2: Frontend Integration Testing
 * Tests API authentication, consultation flow, and analytics
 */

// Test API Authentication
async function testAuthentication() {
  console.log('Testing API Authentication...');
  
  try {
    // Test login endpoint
    const loginResponse = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword'
      })
    });
    
    if (loginResponse.ok) {
      console.log('✅ Login endpoint accessible');
      const data = await loginResponse.json();
      if (data.access_token) {
        console.log('✅ Login returns access token');
        
        // Test token validation
        const profileResponse = await fetch('/auth/me', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });
        
        if (profileResponse.ok) {
          console.log('✅ Token validation working');
        } else {
          console.log('❌ Token validation failed');
        }
      }
    } else {
      console.log('❌ Login endpoint failed:', loginResponse.status);
    }
  } catch (error) {
    console.log('❌ Authentication test error:', error.message);
  }
}

// Test Consultation Flow
async function testConsultationFlow() {
  console.log('\nTesting Consultation Flow...');
  
  try {
    // Test consultation creation
    const consultationResponse = await fetch('/consultation/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doctor_id: 1,
        specialty_id: 1,
        language: 'en-IN',
        consultation_type: 'video'
      })
    });
    
    if (consultationResponse.ok) {
      console.log('✅ Consultation creation endpoint accessible');
      const consultation = await consultationResponse.json();
      
      if (consultation.consultation_id) {
        console.log('✅ Consultation created successfully');
        
        // Test consultation details
        const detailsResponse = await fetch(`/consultation/${consultation.consultation_id}`);
        if (detailsResponse.ok) {
          console.log('✅ Consultation details endpoint working');
        }
        
        // Test consultation transcript
        const transcriptResponse = await fetch(`/consultation/${consultation.consultation_id}/transcript`);
        if (transcriptResponse.ok) {
          console.log('✅ Consultation transcript endpoint working');
        }
      }
    } else {
      console.log('❌ Consultation creation failed:', consultationResponse.status);
    }
  } catch (error) {
    console.log('❌ Consultation flow test error:', error.message);
  }
}

// Test Analytics
async function testAnalytics() {
  console.log('\nTesting Analytics...');
  
  try {
    // Test public analytics event
    const analyticsResponse = await fetch('/analytics/event/public', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'test_event',
        data: { test: true },
        timestamp: new Date().toISOString()
      })
    });
    
    if (analyticsResponse.ok) {
      console.log('✅ Public analytics endpoint working');
    } else {
      console.log('❌ Public analytics failed:', analyticsResponse.status);
    }
    
    // Test health endpoint
    const healthResponse = await fetch('/api/v1/health');
    if (healthResponse.ok) {
      console.log('✅ Health endpoint accessible');
      const healthData = await healthResponse.json();
      console.log('Health status:', healthData.status);
    } else {
      console.log('❌ Health endpoint failed:', healthResponse.status);
    }
  } catch (error) {
    console.log('❌ Analytics test error:', error.message);
  }
}

// Test WebSocket Connection
function testWebSocketConnection() {
  console.log('\nTesting WebSocket Connection...');
  
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket('ws://localhost:8000/conversation/stream?token=test-token');
      
      ws.onopen = () => {
        console.log('✅ WebSocket connection opened');
        
        // Send init message
        ws.send(JSON.stringify({
          type: 'init',
          session_id: 'test-session',
          language: 'en-IN',
          provider: 'deepgram'
        }));
        
        // Send ping
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'ping' }));
        }, 1000);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('✅ WebSocket message received:', data.type);
        
        if (data.type === 'pong') {
          console.log('✅ Ping/Pong working');
          ws.close();
          resolve();
        }
      };
      
      ws.onerror = (error) => {
        console.log('❌ WebSocket error:', error);
        resolve();
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        resolve();
      };
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        resolve();
      }, 5000);
      
    } catch (error) {
      console.log('❌ WebSocket test error:', error.message);
      resolve();
    }
  });
}

// Run all tests
async function runIntegrationTests() {
  console.log('Phase 3.2: Frontend Integration Testing Started\n');
  
  await testAuthentication();
  await testConsultationFlow();
  await testAnalytics();
  await testWebSocketConnection();
  
  console.log('\nPhase 3.2 Testing Complete!');
  console.log('\nSummary:');
  console.log('- Authentication endpoints tested');
  console.log('- Consultation flow tested');
  console.log('- Analytics endpoints tested');
  console.log('- WebSocket connection tested');
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.runIntegrationTests = runIntegrationTests;
  console.log('Integration tests loaded. Run with: runIntegrationTests()');
}

// Auto-run if in Node.js environment
if (typeof window === 'undefined') {
  runIntegrationTests();
}
