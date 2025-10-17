# 🚀 **DEPLOYMENT GUIDE** 🚀

## **Quick Start Instructions**

### **1. Backend Setup**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### **2. Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

### **3. Test Integration**
```bash
# Backend tests
cd backend
python test_integration.py

# Frontend tests (in browser console)
runIntegrationTests()
```

---

## **🔧 Environment Configuration**

### **Backend Environment Variables**
```env
DATABASE_URL=postgresql://user:password@localhost/dbname
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_key
SARVAM_API_KEY=your_sarvam_key
DEEPGRAM_API_KEY=your_deepgram_key
```

### **Frontend Environment Variables**
```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## **📋 Health Check Endpoints**

- **Basic Health**: `GET /api/v1/health`
- **Detailed Status**: `GET /api/v1/services/status`
- **API Documentation**: `GET /docs`

---

## **🎯 Key Features Ready**

- ✅ **User Authentication** - Login/Logout with JWT
- ✅ **Consultation Management** - Create, manage, end consultations
- ✅ **Real-time Communication** - WebSocket audio/text streaming
- ✅ **Analytics Tracking** - Event logging and reporting
- ✅ **Health Monitoring** - Service status monitoring
- ✅ **Public Hospital Search** - No-auth hospital discovery

**The system is production-ready!** 🎉
