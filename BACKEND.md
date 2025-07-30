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

### Volume Calculation
- `POST /api/calculate-volume` - Calculate workout volume

## Directory Structure

```
/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── data/              # User JSON data storage
├── uploads/           # Exercise image uploads
├── utils/             # Utility functions
│   └── volumeCalculator.js # Volume calculation logic
└── test-api.js        # API testing script
```

## Data Format

### Training Plan JSON Structure (PRD-compliant)
```json
{
  "id": "training-plan-uuid",
  "name": "Training Plan Name",
  "start_date": "2025-07-29T11:43:00.000Z",
  "weeks": [
    {
      "week_number": 1,
      "days": [
        {
          "id": "day-uuid",
          "name": "Day Name",
          "day_type": "STANDARD",
          "exercises": [
            {
              "id": "exercise-uuid",
              "name": "Exercise Name",
              "exercise_type": "WEIGHTED",
              "target_sets": 3,
              "target_reps": 10,
              "completed_sets": [
                { "reps": 10, "weight": 50 },
                { "reps": 8, "weight": 50 },
                { "reps": 7, "weight": 50 }
              ]
            },
            {
              "id": "exercise-uuid",
              "name": "Push-ups",
              "exercise_type": "BODYWEIGHT",
              "bodyweight_load_percentage": 0.75,
              "target_sets": 3,
              "target_reps": 10,
              "completed_sets": [
                { "reps": 10 },
                { "reps": 8 },
                { "reps": 7 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Volume Calculation Request
```json
{
  "user_bodyweight": 75,
  "exercises": [
    {
      "id": "exercise-uuid",
      "name": "Push-ups",
      "exercise_type": "BODYWEIGHT",
      "bodyweight_load_percentage": 0.75,
      "completed_sets": [
        { "reps": 10 },
        { "reps": 8 },
        { "reps": 7 }
      ]
    },
    {
      "id": "exercise-uuid",
      "name": "Bench Press",
      "exercise_type": "WEIGHTED",
      "completed_sets": [
        { "reps": 8, "weight": 60 },
        { "reps": 6, "weight": 60 },
        { "reps": 6, "weight": 60 },
        { "reps": 5, "weight": 60 }
      ]
    }
  ]
}
```

### Volume Calculation Response
```json
{
  "success": true,
  "total_volume_kg": 3202.5
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
- ✅ PRD-compliant hierarchical data structure
- ✅ Volume calculation according to PRD requirements
- ✅ Backward compatibility during transition