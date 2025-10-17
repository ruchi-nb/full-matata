# Frontend-Backend Integration Guide for Consultation System

## Overview
This guide provides step-by-step instructions for integrating the FastAPI backend with the Next.js frontend to create a seamless consultation system where patients can select doctors and start consultations with multi-language support.

## System Architecture

### Database Relationships
- **Users** table contains both doctors and patients
- **DoctorSpecialties** links doctors to their specialties
- **DoctorHospitals** (many-to-many) links doctors to hospitals
- **Consultation** table stores consultation records
- **Specialties** table contains medical specialties

### Key Integration Points
1. **Doctor Selection**: Frontend fetches available doctors with their specialties and hospitals
2. **Consultation Creation**: Frontend creates consultation with selected doctor
3. **Language Support**: Frontend handles language selection without database queries
4. **Real-time Communication**: WebSocket integration for live consultations

## Step-by-Step Integration Guide

### Phase 1: Backend API Endpoints Setup

#### 1.1 Create Doctor Listing Endpoint
```python
# Add to backend/routes/doctors_router.py
@router.get("/available-doctors")
async def get_available_doctors(
    specialty_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.list"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """Get list of available doctors with their specialties and hospitals"""
    try:
        from sqlalchemy import select, and_
        from models.models import Users, DoctorSpecialties, Specialties, HospitalMaster
        from sqlalchemy.orm import selectinload
        
        # Build query with joins
        query = (
            select(Users, Specialties, HospitalMaster)
            .join(DoctorSpecialties, Users.user_id == DoctorSpecialties.user_id)
            .join(Specialties, DoctorSpecialties.specialty_id == Specialties.specialty_id)
            .join(t_doctor_hospitals, Users.user_id == t_doctor_hospitals.c.user_id)
            .join(HospitalMaster, t_doctor_hospitals.c.hospital_id == HospitalMaster.hospital_id)
        )
        
        # Apply filters
        conditions = []
        if specialty_id:
            conditions.append(DoctorSpecialties.specialty_id == specialty_id)
        if hospital_id:
            conditions.append(t_doctor_hospitals.c.hospital_id == hospital_id)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await db.execute(query)
        rows = result.all()
        
        # Group doctors by user_id
        doctors_dict = {}
        for user, specialty, hospital in rows:
            if user.user_id not in doctors_dict:
                doctors_dict[user.user_id] = {
                    "user_id": user.user_id,
                    "username": user.username,
                    "email": user.email,
                    "specialties": [],
                    "hospitals": []
                }
            
            # Add specialty if not already present
            specialty_info = {
                "specialty_id": specialty.specialty_id,
                "name": specialty.name,
                "description": specialty.description
            }
            if specialty_info not in doctors_dict[user.user_id]["specialties"]:
                doctors_dict[user.user_id]["specialties"].append(specialty_info)
            
            # Add hospital if not already present
            hospital_info = {
                "hospital_id": hospital.hospital_id,
                "hospital_name": hospital.hospital_name,
                "address": hospital.address
            }
            if hospital_info not in doctors_dict[user.user_id]["hospitals"]:
                doctors_dict[user.user_id]["hospitals"].append(hospital_info)
        
        return {"doctors": list(doctors_dict.values())}
    except Exception as e:
        logger.error(f"Error fetching available doctors: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 1.2 Create Specialties Endpoint
```python
# Add to backend/routes/doctors_router.py
@router.get("/specialties")
async def get_specialties(
    caller: Dict[str, Any] = Depends(require_permissions(["specialty.list"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """Get all available medical specialties"""
    try:
        from sqlalchemy import select
        from models.models import Specialties
        
        result = await db.execute(
            select(Specialties).where(Specialties.status == "active")
        )
        specialties = result.scalars().all()
        
        return {
            "specialties": [
                {
                    "specialty_id": s.specialty_id,
                    "name": s.name,
                    "description": s.description
                }
                for s in specialties
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching specialties: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 1.3 Create Hospitals Endpoint
```python
# Add to backend/routes/hospital_router.py
@router.get("/hospitals")
async def get_hospitals(
    caller: Dict[str, Any] = Depends(require_permissions(["hospital.list"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """Get all available hospitals"""
    try:
        from sqlalchemy import select
        from models.models import HospitalMaster
        
        result = await db.execute(select(HospitalMaster))
        hospitals = result.scalars().all()
        
        return {
            "hospitals": [
                {
                    "hospital_id": h.hospital_id,
                    "hospital_name": h.hospital_name,
                    "address": h.address,
                    "admin_contact": h.admin_contact
                }
                for h in hospitals
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching hospitals: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Phase 2: Frontend API Integration

#### 2.1 Create API Service for Doctors
```javascript
// frontend/src/data/api-doctor.js
import { request } from './api.js';

export const doctorApi = {
  // Get all available doctors
  async getAvailableDoctors(filters = {}) {
    const params = new URLSearchParams();
    if (filters.specialty_id) params.append('specialty_id', filters.specialty_id);
    if (filters.hospital_id) params.append('hospital_id', filters.hospital_id);
    
    const queryString = params.toString();
    const url = `/api/v1/doctors/available-doctors${queryString ? `?${queryString}` : ''}`;
    
    return await request(url, { method: 'GET' });
  },

  // Get all specialties
  async getSpecialties() {
    return await request('/api/v1/doctors/specialties', { method: 'GET' });
  },

  // Get doctor details
  async getDoctorDetails(doctorId) {
    return await request(`/api/v1/doctors/${doctorId}`, { method: 'GET' });
  }
};
```

#### 2.2 Create API Service for Consultations
```javascript
// frontend/src/data/api-consultation.js
import { request } from './api.js';

export const consultationApi = {
  // Create new consultation
  async createConsultation(consultationData) {
    return await request('/api/v1/consultation/create', {
      method: 'POST',
      body: JSON.stringify(consultationData)
    });
  },

  // Get consultation details
  async getConsultationDetails(consultationId) {
    return await request(`/api/v1/consultation/${consultationId}`, { method: 'GET' });
  },

  // Start conversation (text)
  async startTextConversation(data) {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    
    return await request('/api/v1/conversation/text', {
      method: 'POST',
      body: formData
    });
  },

  // Start conversation (speech)
  async startSpeechConversation(audioFile, options) {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    Object.keys(options).forEach(key => {
      if (options[key] !== null && options[key] !== undefined) {
        formData.append(key, options[key]);
      }
    });
    
    return await request('/api/v1/conversation/speech', {
      method: 'POST',
      body: formData
    });
  },

  // End consultation session
  async endSession(sessionData) {
    return await request('/api/v1/conversation/end-session', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  }
};
```

### Phase 3: Frontend Components

#### 3.1 Doctor Selection Component
```jsx
// frontend/src/components/PatientPortal/DoctorSelection.jsx
import React, { useState, useEffect } from 'react';
import { doctorApi } from '../../data/api-doctor.js';

const DoctorSelection = ({ onDoctorSelect, onConsultationStart }) => {
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [doctorsRes, specialtiesRes] = await Promise.all([
        doctorApi.getAvailableDoctors(),
        doctorApi.getSpecialties()
      ]);
      
      setDoctors(doctorsRes.doctors || []);
      setSpecialties(specialtiesRes.specialties || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialtyFilter = async (specialtyId) => {
    setSelectedSpecialty(specialtyId);
    try {
      setLoading(true);
      const filteredDoctors = await doctorApi.getAvailableDoctors({
        specialty_id: specialtyId
      });
      setDoctors(filteredDoctors.doctors || []);
    } catch (error) {
      console.error('Error filtering doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    onDoctorSelect(doctor);
  };

  const handleStartConsultation = () => {
    if (selectedDoctor) {
      onConsultationStart(selectedDoctor);
    }
  };

  return (
    <div className="doctor-selection">
      <h2>Select a Doctor</h2>
      
      {/* Specialty Filter */}
      <div className="specialty-filter">
        <label>Filter by Specialty:</label>
        <select 
          value={selectedSpecialty} 
          onChange={(e) => handleSpecialtyFilter(e.target.value)}
        >
          <option value="">All Specialties</option>
          {specialties.map(specialty => (
            <option key={specialty.specialty_id} value={specialty.specialty_id}>
              {specialty.name}
            </option>
          ))}
        </select>
      </div>

      {/* Doctors List */}
      <div className="doctors-grid">
        {loading ? (
          <div>Loading doctors...</div>
        ) : (
          doctors.map(doctor => (
            <div 
              key={doctor.user_id} 
              className={`doctor-card ${selectedDoctor?.user_id === doctor.user_id ? 'selected' : ''}`}
              onClick={() => handleDoctorSelect(doctor)}
            >
              <h3>{doctor.username}</h3>
              <p>Email: {doctor.email}</p>
              <div className="specialties">
                <strong>Specialties:</strong>
                {doctor.specialties.map(spec => (
                  <span key={spec.specialty_id} className="specialty-tag">
                    {spec.name}
                  </span>
                ))}
              </div>
              <div className="hospitals">
                <strong>Hospitals:</strong>
                {doctor.hospitals.map(hospital => (
                  <span key={hospital.hospital_id} className="hospital-tag">
                    {hospital.hospital_name}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Start Consultation Button */}
      {selectedDoctor && (
        <button 
          className="start-consultation-btn"
          onClick={handleStartConsultation}
        >
          Start Consultation with Dr. {selectedDoctor.username}
        </button>
      )}
    </div>
  );
};

export default DoctorSelection;
```

#### 3.2 Consultation Setup Component
```jsx
// frontend/src/components/PatientPortal/ConsultationSetup.jsx
import React, { useState } from 'react';
import { consultationApi } from '../../data/api-consultation.js';

const ConsultationSetup = ({ selectedDoctor, onConsultationCreated }) => {
  const [consultationType, setConsultationType] = useState('hospital');
  const [language, setLanguage] = useState('en');
  const [audioProvider, setAudioProvider] = useState('deepgram');
  const [loading, setLoading] = useState(false);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'bn', name: 'Bengali' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mr', name: 'Marathi' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' }
  ];

  const handleStartConsultation = async () => {
    try {
      setLoading(true);
      
      // Get patient ID from user context or localStorage
      const patientId = localStorage.getItem('user_id') || 12; // fallback
      
      // Get hospital ID from doctor's first hospital
      const hospitalId = selectedDoctor.hospitals[0]?.hospital_id || null;
      
      // Get specialty ID from doctor's first specialty
      const specialtyId = selectedDoctor.specialties[0]?.specialty_id || 1;
      
      const consultationData = {
        patient_id: parseInt(patientId),
        doctor_id: selectedDoctor.user_id,
        specialty_id: specialtyId,
        hospital_id: hospitalId,
        consultation_type: consultationType
      };

      const response = await consultationApi.createConsultation(consultationData);
      
      if (response.consultation_id) {
        // Store consultation details for the conversation
        const consultationDetails = {
          consultation_id: response.consultation_id,
          doctor: selectedDoctor,
          language,
          audio_provider: audioProvider,
          consultation_type: consultationType
        };
        
        onConsultationCreated(consultationDetails);
      }
    } catch (error) {
      console.error('Error creating consultation:', error);
      alert('Failed to start consultation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="consultation-setup">
      <h2>Consultation Setup</h2>
      <p>Doctor: Dr. {selectedDoctor.username}</p>
      
      <div className="setup-options">
        <div className="form-group">
          <label>Consultation Type:</label>
          <select 
            value={consultationType} 
            onChange={(e) => setConsultationType(e.target.value)}
          >
            <option value="hospital">Hospital</option>
            <option value="online">Online</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div className="form-group">
          <label>Language:</label>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Audio Provider:</label>
          <select 
            value={audioProvider} 
            onChange={(e) => setAudioProvider(e.target.value)}
          >
            <option value="deepgram">Deepgram (Global)</option>
            <option value="sarvam">Sarvam (Indian Languages)</option>
          </select>
        </div>
      </div>

      <button 
        className="start-consultation-btn"
        onClick={handleStartConsultation}
        disabled={loading}
      >
        {loading ? 'Creating Consultation...' : 'Start Consultation'}
      </button>
    </div>
  );
};

export default ConsultationSetup;
```

#### 3.3 Main Consultation Page
```jsx
// frontend/src/app/patientportal/consultation/page.js
'use client';
import React, { useState } from 'react';
import DoctorSelection from '../../../components/PatientPortal/DoctorSelection';
import ConsultationSetup from '../../../components/PatientPortal/ConsultationSetup';
import ConversationInterface from '../../../components/PatientPortal/ConversationInterface';

const ConsultationPage = () => {
  const [step, setStep] = useState('doctor-selection'); // 'doctor-selection', 'consultation-setup', 'conversation'
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [consultationDetails, setConsultationDetails] = useState(null);

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setStep('consultation-setup');
  };

  const handleConsultationCreated = (details) => {
    setConsultationDetails(details);
    setStep('conversation');
  };

  const handleBackToDoctors = () => {
    setStep('doctor-selection');
    setSelectedDoctor(null);
    setConsultationDetails(null);
  };

  return (
    <div className="consultation-page">
      <h1>Start a Consultation</h1>
      
      {step === 'doctor-selection' && (
        <DoctorSelection 
          onDoctorSelect={handleDoctorSelect}
        />
      )}
      
      {step === 'consultation-setup' && selectedDoctor && (
        <ConsultationSetup 
          selectedDoctor={selectedDoctor}
          onConsultationCreated={handleConsultationCreated}
        />
      )}
      
      {step === 'conversation' && consultationDetails && (
        <ConversationInterface 
          consultationDetails={consultationDetails}
          onBackToDoctors={handleBackToDoctors}
        />
      )}
    </div>
  );
};

export default ConsultationPage;
```

### Phase 4: Language Support Implementation

#### 4.1 Language Configuration
```javascript
// frontend/src/config/languages.js
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', code: 'en', flag: '🇺🇸' },
  hi: { name: 'Hindi', code: 'hi', flag: '🇮🇳' },
  bn: { name: 'Bengali', code: 'bn', flag: '🇧🇩' },
  gu: { name: 'Gujarati', code: 'gu', flag: '🇮🇳' },
  kn: { name: 'Kannada', code: 'kn', flag: '🇮🇳' },
  ml: { name: 'Malayalam', code: 'ml', flag: '🇮🇳' },
  mr: { name: 'Marathi', code: 'mr', flag: '🇮🇳' },
  pa: { name: 'Punjabi', code: 'pa', flag: '🇮🇳' },
  ta: { name: 'Tamil', code: 'ta', flag: '🇮🇳' },
  te: { name: 'Telugu', code: 'te', flag: '🇮🇳' }
};

export const getLanguageName = (code) => {
  return SUPPORTED_LANGUAGES[code]?.name || 'Unknown';
};

export const getLanguageFlag = (code) => {
  return SUPPORTED_LANGUAGES[code]?.flag || '🌐';
};
```

#### 4.2 Language Context
```jsx
// frontend/src/contexts/LanguageContext.jsx
import React, { createContext, useContext, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '../config/languages';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isMultiLanguage, setIsMultiLanguage] = useState(false);

  const changeLanguage = (languageCode) => {
    setCurrentLanguage(languageCode);
    setIsMultiLanguage(languageCode === 'multi');
  };

  const getCurrentLanguageInfo = () => {
    return SUPPORTED_LANGUAGES[currentLanguage] || SUPPORTED_LANGUAGES.en;
  };

  const value = {
    currentLanguage,
    isMultiLanguage,
    changeLanguage,
    getCurrentLanguageInfo,
    supportedLanguages: SUPPORTED_LANGUAGES
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
```

### Phase 5: Database Integration Points

#### 5.1 Doctor-Hospital Relationship Query
```sql
-- Query to get doctors with their hospitals and specialties
SELECT 
    u.user_id,
    u.username,
    u.email,
    s.specialty_id,
    s.name as specialty_name,
    h.hospital_id,
    h.hospital_name,
    h.address
FROM users u
JOIN doctor_specialties ds ON u.user_id = ds.user_id
JOIN specialties s ON ds.specialty_id = s.specialty_id
JOIN doctor_hospitals dh ON u.user_id = dh.user_id
JOIN hospital_master h ON dh.hospital_id = h.hospital_id
WHERE s.status = 'active'
ORDER BY u.username, s.name, h.hospital_name;
```

#### 5.2 Consultation Creation Flow
```json
{
  "consultation_creation_flow": {
    "step_1": "Patient selects doctor from frontend",
    "step_2": "Frontend fetches doctor's hospital_id from doctor_hospitals table",
    "step_3": "Frontend fetches doctor's specialty_id from doctor_specialties table",
    "step_4": "Frontend creates consultation with patient_id, doctor_id, specialty_id, hospital_id",
    "step_5": "Backend validates all foreign keys exist",
    "step_6": "Consultation record created in database",
    "step_7": "Frontend receives consultation_id and starts conversation"
  }
}
```

### Phase 6: Error Handling and Validation

#### 6.1 Backend Validation
```python
# Add to backend/schema/schema.py
class ConsultationCreateRequest(BaseModel):
    patient_id: int
    doctor_id: int
    specialty_id: int
    hospital_id: Optional[int] = None
    consultation_type: str = "hospital"
    language: str = "en"
    audio_provider: str = "deepgram"

    @validator('consultation_type')
    def validate_consultation_type(cls, v):
        allowed_types = ['hospital', 'online', 'emergency']
        if v not in allowed_types:
            raise ValueError(f'consultation_type must be one of {allowed_types}')
        return v

    @validator('language')
    def validate_language(cls, v):
        supported_languages = ['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te', 'multi']
        if v not in supported_languages:
            raise ValueError(f'language must be one of {supported_languages}')
        return v
```

#### 6.2 Frontend Error Handling
```javascript
// frontend/src/utils/errorHandler.js
export const handleApiError = (error) => {
  if (error.status === 401) {
    // Redirect to login
    window.location.href = '/login';
    return;
  }
  
  if (error.status === 403) {
    return 'You do not have permission to perform this action.';
  }
  
  if (error.status === 404) {
    return 'The requested resource was not found.';
  }
  
  if (error.status === 500) {
    return 'Server error. Please try again later.';
  }
  
  return error.message || 'An unexpected error occurred.';
};
```

### Phase 7: Testing and Deployment

#### 7.1 API Testing
```javascript
// frontend/src/utils/apiTest.js
export const testConsultationFlow = async () => {
  try {
    // Test doctor listing
    const doctors = await doctorApi.getAvailableDoctors();
    console.log('✅ Doctors loaded:', doctors.doctors?.length || 0);
    
    // Test specialty filtering
    const filteredDoctors = await doctorApi.getAvailableDoctors({ specialty_id: 1 });
    console.log('✅ Filtered doctors:', filteredDoctors.doctors?.length || 0);
    
    // Test consultation creation
    const consultation = await consultationApi.createConsultation({
      patient_id: 12,
      doctor_id: 11,
      specialty_id: 1,
      hospital_id: 1,
      consultation_type: 'hospital'
    });
    console.log('✅ Consultation created:', consultation.consultation_id);
    
    return true;
  } catch (error) {
    console.error('❌ API test failed:', error);
    return false;
  }
};
```

#### 7.2 Integration Checklist
- [ ] Backend endpoints are accessible
- [ ] Frontend can fetch doctors with specialties and hospitals
- [ ] Consultation creation works with proper validation
- [ ] Language selection works without database queries
- [ ] Error handling is implemented
- [ ] Authentication is working
- [ ] Real-time communication is functional

### Phase 8: Production Considerations

#### 8.1 Environment Variables
```bash
# Backend (.env)
DATABASE_URL=mysql://user:password@localhost:3306/avatar_openai
JWT_SECRET_KEY=your-secret-key
DEEPGRAM_API_KEY=your-deepgram-key
SARVAM_API_KEY=your-sarvam-key
OPENAI_API_KEY=your-openai-key

# Frontend (.env.local)
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

#### 8.2 Performance Optimization
- Implement caching for doctor listings
- Use pagination for large datasets
- Optimize database queries with proper indexing
- Implement connection pooling
- Use CDN for static assets

#### 8.3 Security Considerations
- Validate all inputs on both frontend and backend
- Implement rate limiting
- Use HTTPS in production
- Implement proper CORS policies
- Sanitize user inputs

## Conclusion

This integration guide provides a comprehensive approach to connecting the FastAPI backend with the Next.js frontend for the consultation system. The key points are:

1. **Database Integration**: Proper handling of doctor-hospital relationships
2. **Language Support**: Frontend-managed language selection without database queries
3. **Real-time Communication**: WebSocket integration for live consultations
4. **Error Handling**: Comprehensive error handling and validation
5. **User Experience**: Seamless flow from doctor selection to consultation start

Follow this guide step by step to ensure a robust and scalable consultation system integration.
