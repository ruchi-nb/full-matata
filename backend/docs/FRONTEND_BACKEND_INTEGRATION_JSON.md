# Frontend-Backend Integration JSON Guide

## Complete Integration Steps in JSON Format

```json
{
  "project_overview": {
    "title": "FastAPI to Next.js Frontend Integration",
    "description": "Seamless integration of existing FastAPI backend with Next.js frontend",
    "constraints": {
      "database_modifications": "NOT ALLOWED",
      "backend_changes": "MINIMAL - Only CORS and minor configurations",
      "existing_functionality": "MUST BE PRESERVED",
      "data_integrity": "MUST BE MAINTAINED"
    },
    "migration_type": "Frontend replacement only",
    "backend_status": "Fully functional - no changes required"
  },

  "integration_phases": {
    "phase_1": {
      "name": "Project Setup and Configuration",
      "duration": "2-3 days",
      "steps": [
        {
          "step_id": "1.1",
          "title": "Next.js Project Initialization",
          "description": "Create new Next.js project with proper structure",
          "actions": [
            "Create Next.js 13+ project with App Router",
            "Install required dependencies",
            "Configure TypeScript (optional but recommended)",
            "Set up project folder structure"
          ],
          "dependencies": [
            "next@latest",
            "react@latest",
            "react-dom@latest",
            "axios",
            "socket.io-client",
            "react-hook-form",
            "zustand (for state management)",
            "tailwindcss (for styling)"
          ],
          "folder_structure": {
            "src/": {
              "app/": "Next.js App Router pages",
              "components/": "Reusable React components",
              "data/": "API integration layer",
              "hooks/": "Custom React hooks",
              "services/": "Business logic services",
              "utils/": "Utility functions",
              "styles/": "Global styles"
            }
          }
        },
        {
          "step_id": "1.2",
          "title": "Environment Configuration",
          "description": "Set up environment variables and configuration",
          "actions": [
            "Create .env.local file",
            "Configure API base URL",
            "Set up WebSocket URL",
            "Configure authentication settings"
          ],
          "environment_variables": {
            "NEXT_PUBLIC_API_BASE": "http://localhost:8000",
            "NEXT_PUBLIC_WS_URL": "ws://localhost:8000",
            "NEXT_PUBLIC_APP_NAME": "AvatarOpenAI",
            "NEXT_PUBLIC_VERSION": "1.0.0"
          }
        },
        {
          "step_id": "1.3",
          "title": "Backend CORS Configuration",
          "description": "Minimal backend changes for CORS",
          "actions": [
            "Add Next.js domain to CORS origins",
            "Configure CORS headers",
            "Test CORS functionality"
          ],
          "backend_changes": {
            "file": "backend/main.py",
            "changes": [
              "Add localhost:3000 to CORS origins",
              "Add production domain to CORS origins",
              "Configure CORS headers for WebSocket"
            ]
          }
        }
      ]
    },

    "phase_2": {
      "name": "API Integration Layer",
      "duration": "3-4 days",
      "steps": [
        {
          "step_id": "2.1",
          "title": "Base API Client Setup",
          "description": "Create centralized API client for all backend communication",
          "actions": [
            "Create base API client with authentication",
            "Implement token management",
            "Add request/response interceptors",
            "Handle error responses"
          ],
          "files_to_create": [
            "src/data/api.js",
            "src/data/auth.js",
            "src/utils/errorHandler.js"
          ],
          "features": [
            "Automatic token refresh",
            "Request/response logging",
            "Error handling",
            "Loading states"
          ]
        },
        {
          "step_id": "2.2",
          "title": "Authentication Service",
          "description": "Replace HTML login with React authentication",
          "actions": [
            "Create login component",
            "Implement token storage",
            "Create authentication context",
            "Add protected route wrapper"
          ],
          "backend_routes_to_integrate": [
            "POST /api/v1/auth/login",
            "POST /api/v1/auth/refresh-token",
            "POST /api/v1/auth/logout"
          ],
          "files_to_create": [
            "src/data/api-auth.js",
            "src/contexts/AuthContext.jsx",
            "src/components/common/ProtectedRoute.jsx",
            "src/app/login/page.js"
          ]
        },
        {
          "step_id": "2.3",
          "title": "Consultation Service",
          "description": "Integrate consultation creation and management",
          "actions": [
            "Create consultation API service",
            "Implement doctor selection",
            "Add consultation creation",
            "Handle consultation status"
          ],
          "backend_routes_to_integrate": [
            "POST /api/v1/consultation/create",
            "GET /api/v1/consultation/{id}",
            "PUT /api/v1/consultation/{id}/status"
          ],
          "files_to_create": [
            "src/data/api-consultation.js",
            "src/components/PatientPortal/DoctorSelection.jsx",
            "src/components/PatientPortal/ConsultationSetup.jsx"
          ]
        },
        {
          "step_id": "2.4",
          "title": "Conversation Service",
          "description": "Integrate real-time conversation functionality",
          "actions": [
            "Create conversation API service",
            "Implement WebSocket connection",
            "Add message handling",
            "Handle audio processing"
          ],
          "backend_routes_to_integrate": [
            "POST /api/v1/conversation/text",
            "POST /api/v1/conversation/speech",
            "POST /api/v1/conversation/end-session",
            "GET /api/v1/conversation/transcript/{session_id}"
          ],
          "files_to_create": [
            "src/data/api-conversation.js",
            "src/hooks/useWebSocket.js",
            "src/hooks/useAudio.js",
            "src/components/PatientPortal/ConversationInterface.jsx"
          ]
        },
        {
          "step_id": "2.5",
          "title": "Doctor Service",
          "description": "Integrate doctor listing and management",
          "actions": [
            "Create doctor API service",
            "Implement doctor listing",
            "Add specialty filtering",
            "Handle hospital associations"
          ],
          "backend_routes_to_integrate": [
            "GET /api/v1/doctors/available-doctors",
            "GET /api/v1/doctors/specialties",
            "GET /api/v1/doctors/{id}"
          ],
          "files_to_create": [
            "src/data/api-doctor.js",
            "src/components/PatientPortal/DoctorCard.jsx",
            "src/components/PatientPortal/DoctorList.jsx"
          ]
        }
      ]
    },

    "phase_3": {
      "name": "Component Development",
      "duration": "4-5 days",
      "steps": [
        {
          "step_id": "3.1",
          "title": "Page Components",
          "description": "Create main page components to replace HTML templates",
          "actions": [
            "Create login page",
            "Create patient portal pages",
            "Create doctor portal pages",
            "Create admin pages"
          ],
          "page_mappings": {
            "backend/templates/login.html": "src/app/login/page.js",
            "backend/templates/conversation.html": "src/app/patientportal/conversation/page.js",
            "backend/templates/consultation_form.html": "src/app/patientportal/consultation/page.js",
            "backend/templates/analytics_simple.html": "src/app/admin/analytics/page.js",
            "backend/templates/thank_you.html": "src/app/patientportal/thank-you/page.js"
          },
          "files_to_create": [
            "src/app/layout.js",
            "src/app/page.js",
            "src/app/login/page.js",
            "src/app/patientportal/layout.js",
            "src/app/patientportal/conversation/page.js",
            "src/app/patientportal/consultation/page.js",
            "src/app/doctorportal/layout.js",
            "src/app/doctorportal/dashboard/page.js",
            "src/app/admin/layout.js",
            "src/app/admin/analytics/page.js"
          ]
        },
        {
          "step_id": "3.2",
          "title": "Reusable Components",
          "description": "Create reusable components for common functionality",
          "actions": [
            "Create form components",
            "Create navigation components",
            "Create audio components",
            "Create chat components"
          ],
          "component_categories": {
            "forms": [
              "Input.jsx",
              "Select.jsx",
              "Button.jsx",
              "Form.jsx"
            ],
            "navigation": [
              "Header.jsx",
              "Sidebar.jsx",
              "Breadcrumb.jsx",
              "Navigation.jsx"
            ],
            "audio": [
              "AudioRecorder.jsx",
              "AudioPlayer.jsx",
              "MicrophoneButton.jsx"
            ],
            "chat": [
              "MessageBubble.jsx",
              "ChatInput.jsx",
              "ChatHistory.jsx"
            ]
          }
        },
        {
          "step_id": "3.3",
          "title": "State Management",
          "description": "Implement state management for application data",
          "actions": [
            "Create context providers",
            "Implement custom hooks",
            "Add state persistence",
            "Handle real-time updates"
          ],
          "context_providers": [
            "AuthContext",
            "ConversationContext",
            "DoctorContext",
            "LanguageContext"
          ],
          "custom_hooks": [
            "useAuth",
            "useConversation",
            "useWebSocket",
            "useAudio",
            "useApi"
          ]
        }
      ]
    },

    "phase_4": {
      "name": "Real-time Features",
      "duration": "3-4 days",
      "steps": [
        {
          "step_id": "4.1",
          "title": "WebSocket Integration",
          "description": "Implement real-time communication",
          "actions": [
            "Create WebSocket client",
            "Implement connection management",
            "Add message handling",
            "Handle reconnection logic"
          ],
          "backend_websocket_routes": [
            "ws://localhost:8000/ws/conversation",
            "ws://localhost:8000/ws/audio"
          ],
          "files_to_create": [
            "src/hooks/useWebSocket.js",
            "src/services/websocketService.js",
            "src/components/common/WebSocketProvider.jsx"
          ]
        },
        {
          "step_id": "4.2",
          "title": "Audio Processing",
          "description": "Implement audio recording and playback",
          "actions": [
            "Create audio recording component",
            "Implement audio playback",
            "Add audio processing",
            "Handle microphone permissions"
          ],
          "audio_features": [
            "Microphone access",
            "Audio recording",
            "Audio playback",
            "Audio streaming"
          ],
          "files_to_create": [
            "src/hooks/useAudio.js",
            "src/components/audio/AudioRecorder.jsx",
            "src/components/audio/AudioPlayer.jsx",
            "src/utils/audioUtils.js"
          ]
        },
        {
          "step_id": "4.3",
          "title": "Streaming Integration",
          "description": "Implement streaming for real-time features",
          "actions": [
            "Create streaming components",
            "Implement real-time updates",
            "Add progress indicators",
            "Handle streaming errors"
          ],
          "streaming_features": [
            "Real-time conversation",
            "Audio streaming",
            "Text streaming",
            "File uploads"
          ]
        }
      ]
    },

    "phase_5": {
      "name": "Testing and Optimization",
      "duration": "2-3 days",
      "steps": [
        {
          "step_id": "5.1",
          "title": "Component Testing",
          "description": "Test all components and functionality",
          "actions": [
            "Test authentication flow",
            "Test consultation creation",
            "Test conversation interface",
            "Test audio functionality"
          ],
          "testing_areas": [
            "Unit tests for components",
            "Integration tests for API calls",
            "End-to-end tests for user flows",
            "Performance testing"
          ]
        },
        {
          "step_id": "5.2",
          "title": "API Integration Testing",
          "description": "Test all API integrations",
          "actions": [
            "Test authentication APIs",
            "Test consultation APIs",
            "Test conversation APIs",
            "Test WebSocket connections"
          ],
          "test_scenarios": [
            "Successful API calls",
            "Error handling",
            "Network failures",
            "Authentication failures"
          ]
        },
        {
          "step_id": "5.3",
          "title": "Performance Optimization",
          "description": "Optimize application performance",
          "actions": [
            "Optimize bundle size",
            "Implement code splitting",
            "Add caching strategies",
            "Optimize API calls"
          ],
          "optimization_areas": [
            "Bundle size reduction",
            "Lazy loading",
            "Memoization",
            "Caching"
          ]
        }
      ]
    },

    "phase_6": {
      "name": "Deployment and Production",
      "duration": "1-2 days",
      "steps": [
        {
          "step_id": "6.1",
          "title": "Build Configuration",
          "description": "Configure production build",
          "actions": [
            "Configure build settings",
            "Set up environment variables",
            "Optimize for production",
            "Configure static assets"
          ],
          "build_configuration": {
            "output": "standalone",
            "optimization": true,
            "compression": true,
            "caching": true
          }
        },
        {
          "step_id": "6.2",
          "title": "Deployment Setup",
          "description": "Deploy to production environment",
          "actions": [
            "Set up production server",
            "Configure domain and SSL",
            "Set up monitoring",
            "Configure backups"
          ],
          "deployment_requirements": [
            "Node.js runtime",
            "Nginx reverse proxy",
            "SSL certificate",
            "Domain configuration"
          ]
        }
      ]
    }
  },

  "backend_routes_integration": {
    "authentication_routes": {
      "login": {
        "method": "POST",
        "endpoint": "/api/v1/auth/login",
        "frontend_integration": "src/data/api-auth.js",
        "component": "src/app/login/page.js"
      },
      "refresh_token": {
        "method": "POST",
        "endpoint": "/api/v1/auth/refresh-token",
        "frontend_integration": "src/data/api-auth.js",
        "component": "src/contexts/AuthContext.jsx"
      },
      "logout": {
        "method": "POST",
        "endpoint": "/api/v1/auth/logout",
        "frontend_integration": "src/data/api-auth.js",
        "component": "src/components/common/LogoutButton.jsx"
      }
    },
    "consultation_routes": {
      "create_consultation": {
        "method": "POST",
        "endpoint": "/api/v1/consultation/create",
        "frontend_integration": "src/data/api-consultation.js",
        "component": "src/components/PatientPortal/ConsultationSetup.jsx"
      },
      "get_consultation": {
        "method": "GET",
        "endpoint": "/api/v1/consultation/{id}",
        "frontend_integration": "src/data/api-consultation.js",
        "component": "src/components/PatientPortal/ConsultationDetails.jsx"
      }
    },
    "conversation_routes": {
      "text_conversation": {
        "method": "POST",
        "endpoint": "/api/v1/conversation/text",
        "frontend_integration": "src/data/api-conversation.js",
        "component": "src/components/PatientPortal/ConversationInterface.jsx"
      },
      "speech_conversation": {
        "method": "POST",
        "endpoint": "/api/v1/conversation/speech",
        "frontend_integration": "src/data/api-conversation.js",
        "component": "src/components/PatientPortal/AudioInterface.jsx"
      },
      "end_session": {
        "method": "POST",
        "endpoint": "/api/v1/conversation/end-session",
        "frontend_integration": "src/data/api-conversation.js",
        "component": "src/components/PatientPortal/ConversationInterface.jsx"
      }
    },
    "doctor_routes": {
      "available_doctors": {
        "method": "GET",
        "endpoint": "/api/v1/doctors/available-doctors",
        "frontend_integration": "src/data/api-doctor.js",
        "component": "src/components/PatientPortal/DoctorList.jsx"
      },
      "doctor_specialties": {
        "method": "GET",
        "endpoint": "/api/v1/doctors/specialties",
        "frontend_integration": "src/data/api-doctor.js",
        "component": "src/components/PatientPortal/DoctorFilter.jsx"
      }
    }
  },

  "file_structure": {
    "frontend_project": {
      "src/": {
        "app/": {
          "layout.js": "Root layout component",
          "page.js": "Home page",
          "login/": {
            "page.js": "Login page"
          },
          "patientportal/": {
            "layout.js": "Patient portal layout",
            "page.js": "Patient dashboard",
            "consultation/": {
              "page.js": "Consultation setup"
            },
            "conversation/": {
              "page.js": "Conversation interface"
            },
            "thank-you/": {
              "page.js": "Thank you page"
            }
          },
          "doctorportal/": {
            "layout.js": "Doctor portal layout",
            "page.js": "Doctor dashboard"
          },
          "admin/": {
            "layout.js": "Admin layout",
            "analytics/": {
              "page.js": "Analytics dashboard"
            }
          }
        },
        "components/": {
          "common/": {
            "Header.jsx": "Site header",
            "Navigation.jsx": "Main navigation",
            "ProtectedRoute.jsx": "Route protection",
            "LoadingSpinner.jsx": "Loading indicator"
          },
          "PatientPortal/": {
            "DoctorSelection.jsx": "Doctor selection",
            "ConsultationSetup.jsx": "Consultation setup",
            "ConversationInterface.jsx": "Chat interface",
            "AudioInterface.jsx": "Audio controls"
          },
          "DoctorPortal/": {
            "Dashboard.jsx": "Doctor dashboard",
            "PatientList.jsx": "Patient list"
          },
          "Admin/": {
            "AnalyticsDashboard.jsx": "Analytics dashboard"
          }
        },
        "data/": {
          "api.js": "Base API client",
          "api-auth.js": "Authentication API",
          "api-consultation.js": "Consultation API",
          "api-conversation.js": "Conversation API",
          "api-doctor.js": "Doctor API"
        },
        "hooks/": {
          "useAuth.js": "Authentication hook",
          "useWebSocket.js": "WebSocket hook",
          "useAudio.js": "Audio hook",
          "useApi.js": "API hook"
        },
        "services/": {
          "authService.js": "Authentication service",
          "websocketService.js": "WebSocket service",
          "audioService.js": "Audio service"
        },
        "utils/": {
          "errorHandler.js": "Error handling",
          "audioUtils.js": "Audio utilities",
          "validation.js": "Form validation"
        },
        "styles/": {
          "globals.css": "Global styles"
        }
      }
    }
  },

  "implementation_checklist": {
    "setup": [
      "Create Next.js project",
      "Install dependencies",
      "Configure environment variables",
      "Set up project structure"
    ],
    "api_integration": [
      "Create base API client",
      "Implement authentication service",
      "Create consultation service",
      "Create conversation service",
      "Create doctor service"
    ],
    "components": [
      "Create page components",
      "Create reusable components",
      "Implement state management",
      "Add error handling"
    ],
    "realtime_features": [
      "Implement WebSocket connection",
      "Add audio recording/playback",
      "Create streaming components",
      "Handle real-time updates"
    ],
    "testing": [
      "Test authentication flow",
      "Test consultation creation",
      "Test conversation interface",
      "Test audio functionality"
    ],
    "deployment": [
      "Configure production build",
      "Set up deployment",
      "Configure monitoring",
      "Test production environment"
    ]
  },

  "success_criteria": {
    "functional_requirements": [
      "All existing functionality preserved",
      "Authentication working seamlessly",
      "Consultation creation working",
      "Real-time conversation working",
      "Audio recording/playback working"
    ],
    "performance_requirements": [
      "Page load time < 2 seconds",
      "API response time < 500ms",
      "WebSocket connection stable",
      "Audio processing smooth"
    ],
    "user_experience_requirements": [
      "Intuitive navigation",
      "Responsive design",
      "Error handling",
      "Loading states"
    ]
  },

  "risk_mitigation": {
    "database_integrity": {
      "risk": "Database modifications",
      "mitigation": "No database changes allowed",
      "action": "Use existing database schema only"
    },
    "backend_stability": {
      "risk": "Backend functionality disruption",
      "mitigation": "Minimal backend changes",
      "action": "Only CORS configuration changes"
    },
    "data_consistency": {
      "risk": "Data inconsistency",
      "mitigation": "Use existing API endpoints",
      "action": "Maintain existing data flow"
    }
  },

  "timeline": {
    "total_duration": "15-20 days",
    "phases": {
      "phase_1": "2-3 days",
      "phase_2": "3-4 days",
      "phase_3": "4-5 days",
      "phase_4": "3-4 days",
      "phase_5": "2-3 days",
      "phase_6": "1-2 days"
    },
    "milestones": {
      "week_1": "Project setup and API integration",
      "week_2": "Component development and real-time features",
      "week_3": "Testing, optimization, and deployment"
    }
  }
}
```

## Key Integration Points

### 1. **Zero Database Changes**
- All existing database tables remain unchanged
- Use existing API endpoints only
- Maintain existing data relationships
- Preserve all existing functionality

### 2. **Minimal Backend Changes**
- Only CORS configuration for Next.js domain
- No API endpoint modifications
- No database schema changes
- No business logic changes

### 3. **Seamless Frontend Replacement**
- Replace HTML templates with React components
- Replace static JS with React hooks
- Maintain all existing functionality
- Improve user experience

### 4. **Preserved Functionality**
- Authentication system
- Consultation creation
- Real-time conversations
- Audio processing
- Analytics dashboard
- All existing features

This JSON guide provides a complete roadmap for integrating your FastAPI backend with Next.js frontend while maintaining all existing functionality and ensuring a seamless transition.
