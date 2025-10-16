# Backend Environment Variables Required

To run the backend server, you need to create a `.env` file in the backend directory with the following variables:

```
DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/avatar_doctor_managementprofile_V4
GEMINI_API_KEY=your_gemini_key
HEYGEN_API_KEY=your_heygen_key
SARVAM_API_KEY=your_sarvam_key
OPENAI_API_KEY=your_openai_key
DEEPGRAM_API_KEY=your_deepgram_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SECRET_KEY=your_secret_key
```

## Google OAuth Setup

For Google OAuth to work, you need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins
6. Copy the Client ID and Client Secret to your .env file

## Database Setup

Make sure your MySQL database is running and the database `avatar_doctor_managementprofile_V4` exists.

## Testing the Implementation

Once you have set up the environment variables:

1. Start the backend server: `cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. Start the frontend server: `cd frontend && npm run dev`
3. Test the Google OAuth login flow

The Google OAuth endpoint is now available at: `POST /auth/google`
