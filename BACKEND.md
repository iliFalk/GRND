# GRND Telegram Mini App - Backend Setup

This directory contains the backend server for the GRND Telegram Mini App.

## Quick Start

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   or
   ```bash
   node server.js
   ```

3. **Server will run on**: http://localhost:3000

## API Endpoints

### Health Check
- `GET /health` - Returns server status

### Workout Data
- `GET /api/workout-data/:userId` - Retrieve user's workout data
- `POST /api/workout-data/:userId` - Save user's workout data

### Image Upload
- `POST /api/upload-image` - Upload exercise images (multipart/form-data)

## Directory Structure

```
/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── data/              # User JSON data storage
├── uploads/           # Exercise image uploads
└── test-api.js        # API testing script
```

## Data Format

### Workout Data JSON Structure
```json
{
  "userId": "telegram-user-id",
  "workouts": [
    {
      "id": "workout-uuid",
      "name": "Workout Name",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10,
          "weight": 50,
          "imageUrl": "/uploads/image-filename.jpg"
        }
      ]
    }
  ],
  "lastUpdated": "2025-07-29T11:43:00.000Z"
}
```

## Testing

Run the test script to verify all endpoints:
```bash
node test-api.js
```

## Environment Variables

- `PORT` - Server port (default: 3000)

## Features

- ✅ CORS enabled for Telegram Mini App
- ✅ JSON file storage for user data
- ✅ Image upload with validation
- ✅ Error handling and logging
- ✅ Async/await patterns
- ✅ 5MB file upload limit
- ✅ Image file type validation