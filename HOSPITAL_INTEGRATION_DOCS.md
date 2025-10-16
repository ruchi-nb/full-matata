# Hospital Management Integration Documentation

## Overview
This document describes the integration between the frontend HospitalCards component and the backend hospital router API. The integration provides full CRUD (Create, Read, Update, Delete) operations for hospital management.

## Architecture

### Frontend Components
- **HospitalCards.jsx**: Main component displaying hospital cards with CRUD operations
- **hospitalApiService.js**: Service layer handling all API communications
- **ViewModal.jsx**: Modal for viewing hospital details
- **EditModal.jsx**: Modal for editing hospital information

### Backend Components
- **hospital_router.py**: FastAPI router with hospital endpoints
- **hospitals_service.py**: Business logic for hospital operations
- **schema.py**: Pydantic models for data validation
- **models.py**: SQLAlchemy database models

## API Endpoints

### 1. List Hospitals
```
GET /hospitals/
```
- **Purpose**: Retrieve all hospitals
- **Response**: Array of HospitalProfileOut objects
- **Permissions**: Requires `hospital.list` permission

### 2. Create Hospital
```
POST /hospitals/
```
- **Purpose**: Create a new hospital
- **Request Body**: HospitalProfileUpdate object
- **Response**: HospitalProfileOut object
- **Permissions**: Requires `hospital.create` permission

### 3. Get Hospital Profile
```
GET /hospitals/profile?hospital_id={id}
```
- **Purpose**: Retrieve specific hospital details
- **Response**: HospitalProfileOut object
- **Permissions**: Requires `hospital.profile.view` permission

### 4. Update Hospital
```
PUT /hospitals/profile?hospital_id={id}
```
- **Purpose**: Update hospital information
- **Request Body**: HospitalProfileUpdate object
- **Response**: HospitalProfileOut object
- **Permissions**: Requires `hospital.profile.update` permission

### 5. Delete Hospital
```
DELETE /hospitals/{hospital_id}
```
- **Purpose**: Delete a hospital
- **Response**: 204 No Content
- **Permissions**: Requires `hospital.delete` permission

## Data Models

### Frontend Hospital Object
```javascript
{
  id: number,
  name: string,
  email: string,
  location: string,
  phone: string,
  status: string,
  color: string,
  specialty: string,
  doctors: number,
  consultations: number,
  created_at: string,
  updated_at: string
}
```

### Backend HospitalProfileOut
```python
{
  hospital_id: int,
  hospital_name: str,
  hospital_email: Optional[EmailStr],
  admin_contact: Optional[str],
  address: Optional[str],
  created_at: Optional[str],
  updated_at: Optional[str]
}
```

## Service Layer

### hospitalApiService.js
The service layer provides the following methods:

- `listHospitals()`: Fetch all hospitals
- `createHospital(data)`: Create new hospital
- `getHospitalProfile(id)`: Get hospital details
- `updateHospitalProfile(id, data)`: Update hospital
- `deleteHospital(id)`: Delete hospital
- `transformHospitalData(data)`: Transform backend to frontend format
- `transformToBackendFormat(data)`: Transform frontend to backend format

## Error Handling

### Frontend Error Handling
- Loading states with spinner
- Error messages with retry functionality
- Fallback to mock data if API fails
- User-friendly error alerts

### Backend Error Handling
- DatabaseError: Database operation failures
- ValidationError: Input validation failures
- HTTPException: HTTP-specific errors
- Audit logging for all operations

## Authentication & Authorization

All endpoints require proper authentication and specific permissions:
- `hospital.list`: List hospitals
- `hospital.create`: Create hospital
- `hospital.profile.view`: View hospital details
- `hospital.profile.update`: Update hospital
- `hospital.delete`: Delete hospital

## Usage Example

### Frontend Usage
```javascript
import { hospitalApiService } from '@/services/hospitalApiService';

// Load hospitals
const hospitals = await hospitalApiService.listHospitals();

// Create hospital
const newHospital = await hospitalApiService.createHospital({
  hospital_name: "New Hospital",
  hospital_email: "contact@newhospital.com",
  admin_contact: "+91 98765 43210",
  address: "New Address, City"
});

// Update hospital
await hospitalApiService.updateHospitalProfile(hospitalId, {
  hospital_name: "Updated Hospital Name"
});

// Delete hospital
await hospitalApiService.deleteHospital(hospitalId);
```

### Backend Usage
```python
from routes.hospital_router import router
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
```

## Testing

Run the integration test:
```bash
python test_hospital_integration.py
```

This test verifies:
- List hospitals endpoint
- Create hospital endpoint
- Get hospital profile endpoint
- Update hospital endpoint
- Delete hospital endpoint

## Environment Variables

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000)

### Backend
- Database connection settings
- Authentication settings
- Audit logging configuration

## Security Considerations

1. **Authentication**: All endpoints require valid authentication
2. **Authorization**: Role-based permissions for each operation
3. **Input Validation**: Pydantic models validate all inputs
4. **Audit Logging**: All operations are logged for security
5. **SQL Injection**: SQLAlchemy ORM prevents SQL injection
6. **CORS**: Configure CORS for frontend-backend communication

## Performance Considerations

1. **Pagination**: List endpoints limit results to 100 items
2. **Caching**: Consider implementing Redis caching for frequently accessed data
3. **Database Indexing**: Ensure proper indexes on hospital_id and hospital_name
4. **Connection Pooling**: Use connection pooling for database operations

## Future Enhancements

1. **Search Functionality**: Add search capabilities to list hospitals
2. **Bulk Operations**: Support bulk create/update/delete operations
3. **File Upload**: Support hospital logo/image uploads
4. **Real-time Updates**: WebSocket integration for real-time updates
5. **Export/Import**: CSV/Excel export and import functionality
6. **Advanced Filtering**: Filter hospitals by status, location, specialty
7. **Analytics**: Hospital performance metrics and analytics

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure CORS is properly configured
2. **Authentication Errors**: Check token validity and permissions
3. **Database Connection**: Verify database connection settings
4. **Validation Errors**: Check input data format and required fields

### Debug Steps

1. Check browser network tab for API calls
2. Verify backend logs for error details
3. Test endpoints using Postman or curl
4. Check database for data consistency
5. Verify environment variables are set correctly
