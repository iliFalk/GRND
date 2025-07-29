const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// API Endpoints

// GET /api/workout-data/:userId - retrieve user's workout data
app.get('/api/workout-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = getUserDataPath(userId);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const workoutData = JSON.parse(data);
      res.json(workoutData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty workout data
        res.json({
          userId,
          workouts: [],
          lastUpdated: new Date().toISOString()
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error reading workout data:', error);
    res.status(500).json({ error: 'Failed to retrieve workout data' });
  }
});

// POST /api/workout-data/:userId - save user's workout data
app.post('/api/workout-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const workoutData = req.body;
    
    if (!workoutData || typeof workoutData !== 'object') {
      return res.status(400).json({ error: 'Invalid workout data format' });
    }
    
    const filePath = getUserDataPath(userId);
    
    // Ensure the data directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Add metadata
    const dataToSave = {
      ...workoutData,
      userId,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Workout data saved successfully',
      lastUpdated: dataToSave.lastUpdated 
    });
  } catch (error) {
    console.error('Error saving workout data:', error);
    res.status(500).json({ error: 'Failed to save workout data' });
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`GRND Telegram Mini App backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});