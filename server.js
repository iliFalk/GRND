const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const VolumeCalculator = require('./backend/utils/volumeCalculator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('frontend'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Helper function to get user data file path
function getUserDataPath(userId) {
  return path.join(__dirname, 'data', `${userId}.json`);
}

// Validation functions for new PRD-compliant hierarchical data structure
function validateTrainingPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Training plan is required and must be an object');
  }

  // Validate required fields at each level according to PRD
  // Accept both README-compliant and legacy field names
  const planId = plan.plan_id || plan.id;
  const planName = plan.plan_name || plan.name;

  if (!planId || typeof planId !== 'string' || planId.trim() === '') {
    throw new Error('Training plan must have a valid plan_id or id');
  }

  if (!planName || typeof planName !== 'string' || planName.trim() === '') {
    throw new Error('Training plan must have a valid plan_name or name');
  }

  if (!plan.start_date || typeof plan.start_date !== 'string' || isNaN(Date.parse(plan.start_date))) {
    throw new Error('Training plan start_date must be a valid date string');
  }

  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    throw new Error('Training plan must have at least one week');
  }

  // Validate each week
  for (const week of plan.weeks) {
    validateWeek(week, plan.weeks.indexOf(week) + 1);
  }

  return true;
}

function validateWeek(week, weekNumber) {
  if (!week || typeof week !== 'object') {
    throw new Error(`Week ${weekNumber} is required and must be an object`);
  }

  const requiredWeekFields = ['week_number', 'days'];
  for (const field of requiredWeekFields) {
    if (!week.hasOwnProperty(field)) {
      throw new Error(`Missing required field in week ${weekNumber}: ${field}`);
    }
  }

  if (typeof week.week_number !== 'number' || week.week_number <= 0) {
    throw new Error(`Week ${weekNumber} must have a valid week number`);
  }

  if (!Array.isArray(week.days) || week.days.length === 0) {
    throw new Error(`Week ${weekNumber} must have at least one day`);
  }

  // Validate each day
  for (const day of week.days) {
    validateDay(day, weekNumber, week.days.indexOf(day) + 1);
  }

  return true;
}

function validateDay(day, weekNumber, dayNumber) {
  if (!day || typeof day !== 'object') {
    throw new Error(`Day ${dayNumber} in week ${weekNumber} is required and must be an object`);
  }

  // Accept both README-compliant and legacy field names
  const dayId = day.day_id || day.id;
  const dayName = day.day_name || day.name;

  if (!dayId || typeof dayId !== 'string' || dayId.trim() === '') {
    throw new Error(`Day ${dayNumber} in week ${weekNumber} must have a valid day_id or id`);
  }

  if (!dayName || typeof dayName !== 'string' || dayName.trim() === '') {
    throw new Error(`Day ${dayNumber} in week ${weekNumber} must have a valid day_name or name`);
  }

  if (day.day_type !== 'STANDARD' && day.day_type !== 'CIRCUIT') {
    throw new Error(`Day ${dayNumber} in week ${weekNumber} must have a valid day_type (STANDARD or CIRCUIT)`);
  }

  // For STANDARD days, validate exercises array
  if (day.day_type === 'STANDARD') {
    if (!Array.isArray(day.exercises)) {
      throw new Error(`Day ${dayNumber} in week ${weekNumber} must have exercises array for STANDARD day type`);
    }

    // Validate each exercise
    for (const exercise of day.exercises) {
      validateExercise(exercise, weekNumber, dayNumber, day.exercises.indexOf(exercise) + 1);
    }
  }

  // For CIRCUIT days, validate circuit_config
  if (day.day_type === 'CIRCUIT') {
    if (!day.circuit_config || typeof day.circuit_config !== 'object') {
      throw new Error(`Day ${dayNumber} in week ${weekNumber} must have circuit_config for CIRCUIT day type`);
    }
  }

  return true;
}

function validateExercise(exercise, weekNumber, dayNumber, exerciseNumber) {
  if (!exercise || typeof exercise !== 'object') {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} is required and must be an object`);
  }

  // Accept both README-compliant and legacy field names
  const exerciseId = exercise.exercise_id || exercise.id;
  const exerciseName = exercise.exercise_name || exercise.name;
  const targetSets = exercise.target_sets || exercise.sets;
  const targetReps = exercise.target_reps || exercise.reps;

  if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim() === '') {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} must have a valid exercise_id or id`);
  }

  if (!exerciseName || typeof exerciseName !== 'string' || exerciseName.trim() === '') {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} must have a valid exercise_name or name`);
  }

  if (exercise.exercise_type !== 'WEIGHTED' && exercise.exercise_type !== 'BODYWEIGHT') {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} must have a valid exercise_type (WEIGHTED or BODYWEIGHT)`);
  }

  if (typeof targetSets !== 'number' || targetSets <= 0) {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} must have valid target_sets or sets`);
  }

  if (typeof targetReps !== 'number' || targetReps <= 0) {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} must have valid target_reps or reps`);
  }

  if (!Array.isArray(exercise.completed_sets)) {
    throw new Error(`Exercise ${exerciseNumber} in day ${dayNumber} of week ${weekNumber} must have completed_sets array`);
  }

  // Validate each completed set
  for (const set of exercise.completed_sets) {
    if (typeof set.reps !== 'number' || set.reps < 0) {
      throw new Error(`Each set in exercise ${exerciseNumber} must have a valid reps number`);
    }

    if (exercise.exercise_type === 'WEIGHTED' && (set.weight === undefined || set.weight === null)) {
      throw new Error(`Each set in WEIGHTED exercise ${exerciseNumber} must have a weight`);
    }
  }

  return true;
}

// API Endpoints

// GET /api/workout-data/:userId - retrieve user's training plan data
app.get('/api/workout-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = getUserDataPath(userId);

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let trainingPlan;
      try {
        trainingPlan = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in training plan data:', parseError);
        return res.status(500).json({ error: 'Invalid JSON format in training plan data' });
      }

      // Validate the data structure
      try {
        validateTrainingPlan(trainingPlan);
        res.json(trainingPlan);
      } catch (validationError) {
        console.error('Validation error in stored data:', validationError);
        res.status(400).json({ error: 'Invalid training plan data structure', details: validationError.message });
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty training plan structure
        res.json({
          id: `${userId}-plan`,
          name: 'New Training Plan',
          start_date: new Date().toISOString(),
          weeks: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error reading training plan data:', error);
    res.status(500).json({ error: 'Failed to retrieve training plan data' });
  }
});

// POST /api/workout-data/:userId - save user's training plan data
app.post('/api/workout-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const trainingPlan = req.body;

    if (!trainingPlan || typeof trainingPlan !== 'object') {
      return res.status(400).json({ error: 'Invalid training plan format' });
    }

    // Validate the training plan structure
    try {
      validateTrainingPlan(trainingPlan);
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid training plan structure', details: validationError.message });
    }

    const filePath = getUserDataPath(userId);

    // Ensure the data directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Add metadata
    const dataToSave = {
      ...trainingPlan,
      userId,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));

    res.json({
      success: true,
      message: 'Training plan saved successfully',
      lastUpdated: dataToSave.updatedAt
    });
  } catch (error) {
    console.error('Error saving training plan data:', error);
    res.status(500).json({ error: 'Failed to save training plan data' });
  }
});

// POST /api/upload-image - handle exercise image uploads
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// POST /api/calculate-volume - calculate workout volume
app.post('/api/calculate-volume', (req, res) => {
  try {
    const { user_bodyweight, exercises } = req.body;

    if (user_bodyweight === undefined || user_bodyweight === null) {
      return res.status(400).json({ error: 'user_bodyweight is required' });
    }

    if (!Array.isArray(exercises)) {
      return res.status(400).json({ error: 'exercises must be an array' });
    }

    // Calculate total volume using the updated VolumeCalculator
    const totalVolume = VolumeCalculator.calculateTotalVolume(exercises, user_bodyweight);

    res.json({
      success: true,
      total_volume_kg: totalVolume
    });
  } catch (error) {
    console.error('Error calculating volume:', error);
    res.status(500).json({ error: 'Failed to calculate volume' });
  }
});
// Validation functions for user profiles
function validateUserProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('User profile is required and must be an object');
  }

  if (!profile.userId || typeof profile.userId !== 'string' || profile.userId.trim() === '') {
    throw new Error('userId is required and must be a non-empty string');
  }

  if (typeof profile.bodyweight !== 'number' || isNaN(profile.bodyweight) ||
      profile.bodyweight < 30 || profile.bodyweight > 300) {
    throw new Error('bodyweight is required and must be a number between 30 and 300');
  }

  return true;
}

// Middleware to validate userId matches route parameter
function validateUserId(req, res, next) {
  const { userId: routeUserId } = req.params;
  const { userId: bodyUserId } = req.body;

  if (!bodyUserId || bodyUserId !== routeUserId) {
    return res.status(400).json({
      error: 'Invalid userId',
      message: 'userId in request body must match route parameter'
    });
  }

  next();
}

// API Endpoints for User Profile Management

// GET /api/user-profile/:userId - retrieve user profile
app.get('/api/user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = path.join(__dirname, 'data', 'user-profiles.json');

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let profiles;
      try {
        profiles = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in user profiles data:', parseError);
        return res.status(500).json({ error: 'Invalid JSON format in user profiles data' });
      }

      if (!profiles[userId]) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      res.json(profiles[userId]);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'User profiles data not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

// POST /api/user-profile/:userId - create/update profile
app.post('/api/user-profile/:userId', validateUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = req.body;

    // Validate the profile structure
    try {
      validateUserProfile(profile);
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid user profile structure', details: validationError.message });
    }

    const filePath = path.join(__dirname, 'data', 'user-profiles.json');

    // Read existing profiles
    let profiles = {};
    try {
      const data = await fs.readFile(filePath, 'utf8');
      try {
        profiles = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in user profiles data:', parseError);
        profiles = {}; // Start with empty object if JSON is invalid
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // File doesn't exist, start with empty object
    }

    // Update or create profile
    profiles[userId] = {
      ...profile,
      createdAt: profiles[userId] ? profiles[userId].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(profiles, null, 2));

    res.json({
      success: true,
      message: 'User profile saved successfully',
      lastUpdated: profiles[userId].updatedAt
    });
  } catch (error) {
    console.error('Error saving user profile:', error);
    res.status(500).json({ error: 'Failed to save user profile' });
  }
});

// DELETE /api/user-profile/:userId - delete profile
app.delete('/api/user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = path.join(__dirname, 'data', 'user-profiles.json');

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let profiles;
      try {
        profiles = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in user profiles data:', parseError);
        return res.status(500).json({ error: 'Invalid JSON format in user profiles data' });
      }

      if (!profiles[userId]) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      // Delete the profile
      delete profiles[userId];

      // Write back to file
      await fs.writeFile(filePath, JSON.stringify(profiles, null, 2));

      res.json({
        success: true,
        message: 'User profile deleted successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'User profiles data not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting user profile:', error);
    res.status(500).json({ error: 'Failed to delete user profile' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({ error: 'Internal server error' });
});


// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Unsplash API key endpoint
app.get('/api/unsplash-key', (req, res) => {
  const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!unsplashAccessKey) {
    return res.status(500).json({ error: 'Unsplash API key not configured' });
  }
  
  res.json({ accessKey: unsplashAccessKey });
});

// Training Plans endpoint
app.get('/api/training-plans', async (req, res) => {
  try {
    // In a real implementation, this would query a database
    // For now, we'll return a sample training plan structure
    const samplePlans = [
      {
        id: 'plan-1',
        name: 'Beginner Strength',
        description: 'A 4-week program for beginners focusing on basic strength exercises',
        durationWeeks: 4,
        difficulty: 'Beginner',
        imageUrl: '/uploads/beginner-strength.jpg'
      },
      {
        id: 'plan-2',
        name: 'Advanced Muscle',
        description: 'An 8-week program for advanced lifters focusing on muscle growth',
        durationWeeks: 8,
        difficulty: 'Advanced',
        imageUrl: '/uploads/advanced-muscle.jpg'
      }
    ];

    res.json(samplePlans);
  } catch (error) {
    console.error('Error retrieving training plans:', error);
    res.status(500).json({ error: 'Failed to retrieve training plans' });
  }
});

// Day endpoint
app.get('/api/days/:dayId', (req, res) => {
  try {
    const { dayId } = req.params;

    // In a real implementation, this would query a database
    // For now, we'll return a sample day structure
    const sampleDay = {
      id: dayId,
      name: 'Upper Body Strength',
      day_type: 'STANDARD',
      exercises: [
        {
          id: 'exercise-1',
          name: 'Bench Press',
          exercise_type: 'WEIGHTED',
          target_sets: 4,
          target_reps: 8,
          completed_sets: []
        },
        {
          id: 'exercise-2',
          name: 'Bent Over Rows',
          exercise_type: 'WEIGHTED',
          target_sets: 4,
          target_reps: 10,
          completed_sets: []
        }
      ]
    };

    res.json(sampleDay);
  } catch (error) {
    console.error('Error retrieving day:', error);
    res.status(500).json({ error: 'Failed to retrieve day' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

 // Telegram webhook endpoint for Telegram Bot updates
 const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN || '';

 app.post('/telegram-webhook', (req, res) => {
   // If a secret token is configured, verify the incoming request contains it.
   if (TELEGRAM_SECRET_TOKEN) {
     const received = req.get('X-Telegram-Bot-Api-Secret-Token') || req.get('x-telegram-bot-api-secret-token');
     if (received !== TELEGRAM_SECRET_TOKEN) {
       console.warn('Unauthorized Telegram webhook request - invalid secret token');
       return res.status(401).send('Unauthorized');
     }
   }

   // Acknowledge quickly to Telegram and log the update for further processing
   try {
     console.log('Telegram update received:', JSON.stringify(req.body));
     // TODO: add processing logic here (e.g., route to handlers that respond to messages/commands)
   } catch (err) {
     console.error('Error processing Telegram update:', err);
   }

   // Telegram requires a quick 200 OK response for webhook updates
   res.status(200).send('OK');
 });

 // Start server
 app.listen(PORT, () => {
   console.log(`GRND Telegram Mini App backend server running on port ${PORT}`);
   console.log(`Health check: http://localhost:${PORT}/health`);
 });

// Helper function to get workout sessions file path
function getWorkoutSessionsPath() {
  return path.join(__dirname, 'data', 'workout-sessions.json');
}

// Validation function for workout sessions
function validateWorkoutSession(session) {
  if (!session || typeof session !== 'object') {
    throw new Error('Workout session is required and must be an object');
  }

  if (!session.userId || typeof session.userId !== 'string' || session.userId.trim() === '') {
    throw new Error('userId is required and must be a non-empty string');
  }

  if (!session.date || !(session.date instanceof Date) || isNaN(session.date.getTime())) {
    throw new Error('date is required and must be a valid Date');
  }

  if (!Array.isArray(session.completedExercises)) {
    throw new Error('completedExercises is required and must be an array');
  }

  for (const exercise of session.completedExercises) {
    if (!exercise || typeof exercise !== 'object') {
      throw new Error('Each exercise in completedExercises must be an object');
    }

    if (!exercise.exerciseId || typeof exercise.exerciseId !== 'string' || exercise.exerciseId.trim() === '') {
      throw new Error('Each exercise must have a non-empty exerciseId string');
    }

    if (!Array.isArray(exercise.sets)) {
      throw new Error('Each exercise must have a sets array');
    }

    for (const set of exercise.sets) {
      if (!set || typeof set !== 'object') {
        throw new Error('Each set must be an object');
      }

      if (typeof set.reps !== 'number' || set.reps <= 0) {
        throw new Error('Each set must have a positive reps number');
      }

      if (set.weight !== undefined && (typeof set.weight !== 'number' || set.weight <= 0)) {
        throw new Error('If provided, weight must be a positive number');
      }
    }
  }

  if (session.notes !== undefined && typeof session.notes !== 'string') {
    throw new Error('notes must be a string if provided');
  }

  return true;
}

// API Endpoints for Workout Session Management

// POST /api/workout-session - create a new workout session
app.post('/api/workout-session', async (req, res) => {
  try {
    const sessionData = req.body;

    // Validate the session data
    try {
      validateWorkoutSession(sessionData);
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid workout session structure', details: validationError.message });
    }

    // Create a new session with default values
    const newSession = {
      ...sessionData,
      id: Date.now().toString(),
      date: sessionData.date ? new Date(sessionData.date) : new Date(),
      status: 'completed', // Default to completed for new sessions
      totalVolume: 0
    };

    // Calculate volume for each exercise using the utility
    newSession.completedExercises = newSession.completedExercises.map(exercise => {
      // Determine if this is a bodyweight exercise
      const isBodyweight = !exercise.sets.some(set => set.weight !== undefined && set.weight !== null);

      // Get default bodyweight load percentage for this exercise
      const bodyweightLoadPercentages = VolumeCalculator.getDefaultBodyweightLoadPercentages();
      const loadPercentage = bodyweightLoadPercentages[exercise.name] || 1;

      // Calculate volume using the utility
      const volume = VolumeCalculator.calculateExerciseVolume({
        sets: exercise.sets.length,
        reps: exercise.sets.reduce((sum, set) => sum + set.reps, 0) / exercise.sets.length,
        weight: exercise.sets.reduce((sum, set) => sum + (set.weight || 0), 0) / exercise.sets.length,
        isBodyweight: isBodyweight
      }, 0, loadPercentage); // Assuming no user bodyweight available in backend

      exercise.volume = volume;
      newSession.totalVolume += volume;
      return exercise;
    });

    const filePath = getWorkoutSessionsPath();

    // Read existing sessions
    let sessionsData = { sessions: [] };
    try {
      const data = await fs.readFile(filePath, 'utf8');
      try {
        sessionsData = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in workout sessions data:', parseError);
        sessionsData = { sessions: [] }; // Start with empty array if JSON is invalid
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // File doesn't exist, start with empty array
    }

    // Add the new session
    sessionsData.sessions.push(newSession);

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(sessionsData, null, 2));

    res.json({
      success: true,
      message: 'Workout session created successfully',
      session: newSession
    });
  } catch (error) {
    console.error('Error creating workout session:', error);
    res.status(500).json({ error: 'Failed to create workout session' });
  }
});

// GET /api/workout-sessions/:userId - get all sessions for a user
app.get('/api/workout-sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = getWorkoutSessionsPath();

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let sessionsData;
      try {
        sessionsData = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in workout sessions data:', parseError);
        return res.json([]); // Return empty array if JSON is invalid
      }

      // Filter sessions for the specific user
      const userSessions = sessionsData.sessions.filter(session => session.userId === userId);

      res.json(userSessions);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty array
        res.json([]);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error retrieving workout sessions:', error);
    res.status(500).json({ error: 'Failed to retrieve workout sessions' });
  }
});

// GET /api/workout-session/:sessionId - get a specific session
app.get('/api/workout-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const filePath = getWorkoutSessionsPath();

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let sessionsData;
      try {
        sessionsData = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in workout sessions data:', parseError);
        return res.status(500).json({ error: 'Invalid JSON format in workout sessions data' });
      }

      // Find the specific session
      const session = sessionsData.sessions.find(session => session.id === sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Workout session not found' });
      }

      res.json(session);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return 404
        return res.status(404).json({ error: 'Workout session not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error retrieving workout session:', error);
    res.status(500).json({ error: 'Failed to retrieve workout session' });
  }
});

// DELETE /api/workout-session/:sessionId - delete a session
app.delete('/api/workout-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const filePath = getWorkoutSessionsPath();

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let sessionsData;
      try {
        sessionsData = JSON.parse(data);
      } catch (parseError) {
        console.error('JSON parse error in workout sessions data:', parseError);
        return res.status(500).json({ error: 'Invalid JSON format in workout sessions data' });
      }

      // Find the session index
      const sessionIndex = sessionsData.sessions.findIndex(session => session.id === sessionId);

      if (sessionIndex === -1) {
        return res.status(404).json({ error: 'Workout session not found' });
      }

      // Remove the session
      sessionsData.sessions.splice(sessionIndex, 1);

      // Write back to file
      await fs.writeFile(filePath, JSON.stringify(sessionsData, null, 2));

      res.json({
        success: true,
        message: 'Workout session deleted successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return 404
        return res.status(404).json({ error: 'Workout session not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deleting workout session:', error);
    res.status(500).json({ error: 'Failed to delete workout session' });
  }
});
