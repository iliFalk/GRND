const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const VolumeCalculator = require('./backend/utils/volumeCalculator');
const MuscleVolume = require('./backend/utils/muscleVolume');
const { suggestForReport } = require('./backend/utils/muscleSuggestions');
const { suggestPairs, suggestCircuit, alternativesForMissingEquipment } = require('./backend/utils/pairings');
const { computeSessionVolume } = require('./backend/utils/sessionVolume');
const { weeklyPillars } = require('./backend/utils/pillars');
const { getDraft, putDraft, removeDraft } = require('./backend/utils/drafts');
const { readJson, writeJson, updateJson, StoreError } = require('./backend/utils/store');
const { mergePlanWeeks } = require('./backend/utils/planMerge');
require('dotenv').config();

// The ceilings on what one request may grow. They sit beside the routes that read them.
const MAX_PLANS_PER_PRINCIPAL = 50;
const MAX_PLAN_WEEKS = 52;
const MAX_EXERCISES_PER_SESSION = 50;
const MAX_SETS_PER_EXERCISE = 50;
const MAX_SESSION_NOTES = 2000;
const MAX_PAIRING_SELECTION = 50;
const MAX_DRAFT_STATE_BYTES = 64 * 1024;
const MAX_DRAFTS_STORE_BYTES = 1024 * 1024;

/** The plans one account holds. Without a verified principal every stored plan is that caller's. */
function plansOf(plans, owner) {
  return (Array.isArray(plans) ? plans : [])
    .filter((plan) => plan && (plan.userId || null) === owner);
}

const app = express();
const PORT = process.env.PORT || 3000;

// The directory that holds the JSON stores: GRND_DATA_DIR when set, <repo>/data otherwise.
function dataRoot() {
  return process.env.GRND_DATA_DIR || path.join(__dirname, 'data');
}

// A local run has no uploads/ (the container creates it), so it is made here. The data root holds the
// user's journal and drafts and belongs to its owner alone, hence 0700.
const uploadsDir = path.join(__dirname, 'uploads');
fsSync.mkdirSync(dataRoot(), { recursive: true, mode: 0o700 });
fsSync.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// The React app. `npm run build` writes it into dist/, and it is the only front end: the vanilla app
// under frontend/ is gone. It serves at the root, which is the address the bot opens.
const appDir = path.join(__dirname, 'dist');
app.use(express.static(appDir));

// A link saved before the move still carries /next/; send it to the same path at the root.
app.use('/next', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const target = req.originalUrl.replace(/^\/next/, '');

  // Only a path that stays on this host is a target. `//host` and `\host` are read as a host by the
  // browser, so a redirect to either would leave the app and could carry the visitor anywhere.
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return res.status(400).json({ error: 'Invalid redirect target' });
  }
  const targetPath = decoded.split(/[?#]/)[0];
  if (!/^\/(?!\/)./.test(targetPath) || targetPath.includes('\\') || /[\u0000-\u001f\u007f]/.test(decoded)) {
    return res.status(400).json({ error: 'Invalid redirect target' });
  }

  res.redirect(301, target);
});

// What may be stored and served from uploads/. The declared type and the name's extension must both
// be on the list: a browser trusts the served type, so a `.png` that is really HTML is refused.
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const MAX_UPLOADS_PER_PRINCIPAL = 20;
const MAX_UPLOAD_BYTES_PER_PRINCIPAL = 50 * 1024 * 1024;
const MAX_UPLOAD_INDEX_ENTRIES = 1000;

const uploadsIndexFile = () => path.join(dataRoot(), 'uploads.json');

/** The allowlisted extension of a name, lowercased, or `null` when it has none. */
function allowedExtension(name) {
  const extension = path.extname(typeof name === 'string' ? name : '').slice(1).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.includes(extension) ? extension : null;
}

function uploadTypeError(message) {
  const error = new Error(message);
  error.code = 'INVALID_UPLOAD_TYPE';
  error.status = 400;
  return error;
}

/** The account an upload belongs to. Without a verified principal every upload is the one caller's. */
function uploadOwner(req) {
  return req.userId || null;
}

/** The files and bytes one principal already holds, from the index the route keeps. */
async function uploadUsage(owner) {
  const stored = await readJson(uploadsIndexFile(), []);
  const entries = (Array.isArray(stored) ? stored : [])
    .filter((entry) => entry && (entry.owner || null) === owner);
  return {
    count: entries.length,
    bytes: entries.reduce((sum, entry) => sum + (Number(entry.size) || 0), 0)
  };
}

/** Refuses the 21st file or the request that would carry the principal past 50 MB. */
async function uploadQuota(req, res, next) {
  try {
    const usage = await uploadUsage(uploadOwner(req));
    const declared = Number(req.headers['content-length']);
    const wouldPass = Number.isFinite(declared) && usage.bytes + declared > MAX_UPLOAD_BYTES_PER_PRINCIPAL;
    if (usage.count >= MAX_UPLOADS_PER_PRINCIPAL
      || usage.bytes >= MAX_UPLOAD_BYTES_PER_PRINCIPAL
      || wouldPass) {
      return res.status(413).json({ error: 'Upload quota reached for this account' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

/** Notes the accepted file, so the next request can count it. The index keeps the last 1000. */
async function recordUpload(owner, file) {
  await updateJson(uploadsIndexFile(), [], (current) => {
    const entries = Array.isArray(current) ? current : [];
    return [...entries, { name: file.filename, size: file.size, owner, at: Date.now() }]
      .slice(-MAX_UPLOAD_INDEX_ENTRIES);
  });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // The stored name is ours: a generated stem and an allowlisted extension. The caller's name is
    // only inspected, never written, so it cannot choose a path or a type.
    const extension = allowedExtension(file.originalname);
    if (!extension) return cb(uploadTypeError('The file name must end in png, jpg, jpeg, webp or gif'));
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname || 'image'}-${uniqueSuffix}.${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(uploadTypeError('Only PNG, JPEG, WebP and GIF images are allowed'));
    }
    if (!allowedExtension(file.originalname)) {
      return cb(uploadTypeError('The file name must end in png, jpg, jpeg, webp or gif'));
    }
    cb(null, true);
  }
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// --- Identity and the data root -------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** The directory every store lives in. A deployment points GRND_DATA_DIR at a private volume. */
function dataRoot() {
  return process.env.GRND_DATA_DIR ? path.resolve(process.env.GRND_DATA_DIR) : path.join(__dirname, 'data');
}

// A user id names one file, so it may only carry the characters a file name keeps to itself.
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// The shared stores hold every account. A user id must never name one of them, or a plan read would
// read the journal and a plan write would overwrite it.
const SHARED_STORE_NAMES = new Set([
  'user-profiles',
  'workout-sessions',
  'workout-drafts',
  'training-plans',
  'weekly-targets',
  'exercise-catalogue',
  'exercise-taxonomy',
  'equipment',
  'pillars'
]);

/** Why a route's userId may not become a file name, or `null` when it may. */
function userIdRefusal(userId) {
  if (typeof userId !== 'string' || !USER_ID_PATTERN.test(userId)) {
    return 'userId must be 1 to 64 letters, digits, underscores or hyphens';
  }
  if (SHARED_STORE_NAMES.has(userId)) return 'userId must not name a shared store';
  return null;
}

// Helper function to get user data file path. The path is built from a checked value only: a raw
// request value never reaches the filesystem.
function getUserDataPath(userId) {
  const refusal = userIdRefusal(userId);
  if (refusal) throw new HttpError(400, refusal);

  const root = dataRoot();
  const filePath = path.join(root, `${userId}.json`);
  if (path.dirname(filePath) !== root) throw new HttpError(400, 'userId escapes the data root');
  return filePath;
}

/**
 * The Telegram WebApp initData, or `null` when it was not signed with this bot's token.
 * The check string is every other field sorted by key as `key=value`; the key is HMAC(bot token,
 * "WebAppData") and the signature is HMAC(that key, check string).
 */
function verifyInitData(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) return null;

  const secret = process.env.GRND_TELEGRAM_BOT_TOKEN;
  if (!secret) return null;

  const pairs = [];
  for (const [key, value] of params) {
    if (key === 'hash') continue;
    pairs.push([key, value]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const checkString = pairs.map(([key, value]) => `${key}=${value}`).join('\n');

  const key = crypto.createHmac('sha256', 'WebAppData').update(secret).digest();
  const expected = crypto.createHmac('sha256', key).update(checkString).digest();
  const received = Buffer.from(hash.toLowerCase(), 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > 24 * 60 * 60) return null;

  let user;
  try {
    user = JSON.parse(params.get('user') || '');
  } catch {
    return null;
  }
  if (!user || typeof user !== 'object' || typeof user.id !== 'number' || !Number.isFinite(user.id)) return null;

  return { user, authDate };
}

/** Every /api request carries one verified principal. Without a bot token there is nothing to verify. */
function requirePrincipal(req, res, next) {
  if (!process.env.GRND_TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ error: 'Telegram bot token is not configured' });
  }

  const header = req.get('authorization') || '';
  const match = /^tma\s+(.+)$/i.exec(header.trim());
  if (!match) return res.status(401).json({ error: 'Missing Telegram initData' });

  const verified = verifyInitData(match[1].trim());
  if (!verified) return res.status(401).json({ error: 'Invalid Telegram initData' });

  req.userId = String(verified.user.id);
  req.telegramUser = verified.user;
  next();
}

app.use('/api', requirePrincipal);

// `/:userId` with an empty value does not reach its route; it still must answer 400, not 404.
app.use('/api', (req, res, next) => {
  if (!req.path.endsWith('/')) return next();
  if (/^\/(workout-data|user-profile|workout-draft|workout-sessions|muscle-volume|pillars|suggestions)\/$/.test(req.path)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  next();
});

/** A route's `:userId` must be the caller's own. 404, never 403: another account is not a fact here. */
function requireOwnUserId(req, res, next) {
  if (req.params.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
  next();
}

/** Refuse a malformed userId before any handler can build a path from it. */
function validateUserIdParam(req, res, next) {
  const refusal = userIdRefusal(req.params.userId);
  if (refusal) return res.status(400).json({ error: 'Invalid userId', details: refusal });
  next();
}

// Who the caller is, from the verified payload only.
app.get('/api/me', (req, res) => {
  res.json({ userId: req.userId });
});

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
app.get('/api/workout-data/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
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
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error('Error reading training plan data:', error);
    res.status(500).json({ error: 'Failed to retrieve training plan data' });
  }
});

// POST /api/workout-data/:userId - save user's training plan data
app.post('/api/workout-data/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
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

    await writeJson(filePath, dataToSave);

    res.json({
      success: true,
      message: 'Training plan saved successfully',
      lastUpdated: dataToSave.updatedAt
    });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error('Error saving training plan data:', error);
    res.status(500).json({ error: 'Failed to save training plan data' });
  }
});

// POST /api/upload-image - handle exercise image uploads
app.post('/api/upload-image', uploadQuota, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    await recordUpload(uploadOwner(req), req.file);
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
// Weekly working sets per muscle group, against the band in data/weekly-targets.json.
// A kilogram total says nothing about whether a group got enough work; this answers that question.
app.get('/api/muscle-volume/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const week = req.query.week || undefined;
    let sessions = [];
    try {
      const data = await fs.readFile(getWorkoutSessionsPath(), 'utf8');
      sessions = journalSessions(JSON.parse(data));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const report = MuscleVolume.weeklyReport(sessions, { userId, week });
    res.json(report);
  } catch (error) {
    console.error('Error building the weekly muscle report:', error);
    res.status(500).json({ error: 'Failed to build the weekly muscle report' });
  }
});

// The running workout, so a killed app resumes where it stopped.
const draftFile = () => path.join(dataRoot(), 'workout-drafts.json');

app.get('/api/workout-draft/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const draft = await getDraft(draftFile(), req.params.userId);
    if (!draft) return res.status(404).json({ error: 'No draft' });
    res.json({ draft });
  } catch (error) {
    console.error('Error reading the workout draft:', error);
    res.status(500).json({ error: 'Failed to read the workout draft' });
  }
});

app.put('/api/workout-draft/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.state || typeof body.state !== 'object') {
      return res.status(400).json({ error: 'A draft carries a state object' });
    }
    // A draft is a screen's worth of state. A larger one is not a draft, and the store holds every
    // account's draft in one file, so it has a ceiling of its own.
    const stateBytes = Buffer.byteLength(JSON.stringify(body.state));
    if (stateBytes > MAX_DRAFT_STATE_BYTES) {
      return res.status(413).json({ error: 'The draft state is larger than 64 KB' });
    }
    const draft = {
      mode: body.mode === 'amrap' ? 'amrap' : 'sets',
      elapsed: Number(body.elapsed) || 0,
      state: body.state,
      savedAt: Date.now()
    };
    const drafts = await readJson(draftFile(), {});
    const nextStore = { ...(drafts && typeof drafts === 'object' ? drafts : {}), [req.params.userId]: draft };
    if (Buffer.byteLength(JSON.stringify(nextStore)) > MAX_DRAFTS_STORE_BYTES) {
      return res.status(413).json({ error: 'The drafts store would exceed 1 MB' });
    }
    const saved = await putDraft(draftFile(), req.params.userId, {
      mode: draft.mode,
      elapsed: draft.elapsed,
      state: draft.state
    });
    // The client ignores the body; echoing the whole draft doubled the traffic of every save.
    res.json({ savedAt: saved.savedAt });
  } catch (error) {
    console.error('Error writing the workout draft:', error);
    res.status(500).json({ error: 'Failed to write the workout draft' });
  }
});

app.delete('/api/workout-draft/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    await removeDraft(draftFile(), req.params.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing the workout draft:', error);
    res.status(500).json({ error: 'Failed to remove the workout draft' });
  }
});

// Weekly work per ability — pull, push, legs. A set counts once, by the movement of its exercise.
app.get('/api/pillars/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const week = req.query.week || undefined;
    let sessions = [];
    try {
      const data = await fs.readFile(getWorkoutSessionsPath(), 'utf8');
      sessions = journalSessions(JSON.parse(data));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    res.json(weeklyPillars(sessions, { userId, week }));
  } catch (error) {
    console.error('Error building the weekly pillars:', error);
    res.status(500).json({ error: 'Failed to build the weekly pillars' });
  }
});

// What pairs well with what, for a circuit. It advises; the user chooses.
app.post('/api/pairings', async (req, res) => {
  try {
    const body = req.body || {};
    const selected = Array.isArray(body.selected) ? body.selected : [];
    // The bound is answered before any file is read: a refusal must not depend on the data root.
    if (selected.length > MAX_PAIRING_SELECTION) {
      return res.status(400).json({ error: `selected must hold at most ${MAX_PAIRING_SELECTION} entries` });
    }
    const catalogue = JSON.parse(await fs.readFile(path.join(dataRoot(), 'exercise-catalogue.json'), 'utf8'));
    const equipmentFile = JSON.parse(await fs.readFile(path.join(dataRoot(), 'equipment.json'), 'utf8'));
    const owned = (equipmentFile.items || []).filter((item) => item.available).map((item) => item.id);
    // No limit unless the caller asks for one: the picker shows the whole ranked list.
    const limit = Number.isFinite(body.limit) ? body.limit : 0;
    res.json({
      pairs: suggestPairs(catalogue, selected, { limit, equipment: owned }),
      alternatives: alternativesForMissingEquipment(catalogue, selected, owned),
      // One ready circuit per chosen exercise, built so no primary group repeats.
      circuits: selected.map((item) => suggestCircuit(catalogue, item, { size: 3, equipment: owned }))
    });
  } catch (error) {
    console.error('Error building pairings:', error);
    res.status(500).json({ error: 'Failed to build pairings' });
  }
});

// The fixed list a plan picks from. An exercise is chosen by id, never typed.
app.get('/api/exercise-catalogue', async (req, res) => {
  try {
    const raw = await fs.readFile(path.join(dataRoot(), 'exercise-catalogue.json'), 'utf8');
    res.json(JSON.parse(raw));
  } catch (error) {
    console.error('Error reading the exercise catalogue:', error);
    res.status(500).json({ error: 'Failed to read the exercise catalogue' });
  }
});

// What to add this week: the short groups with exercises his own equipment can cover.
app.get('/api/suggestions/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const week = req.query.week || undefined;
    const limit = Number.parseInt(req.query.limit, 10);
    let sessions = [];
    try {
      const data = await fs.readFile(getWorkoutSessionsPath(), 'utf8');
      sessions = journalSessions(JSON.parse(data));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const report = MuscleVolume.weeklyReport(sessions, { userId, week });
    const suggestions = suggestForReport(report, Number.isFinite(limit) ? { limit } : {});
    res.json({
      week_start: report.week_start,
      week_end: report.week_end,
      sessions: report.sessions,
      groups: suggestions,
      // Circuit work sits beside the band, never inside it: rounds and time under load.
      circuits: report.circuits,
      circuit_rounds: report.circuit_rounds,
      unmapped: report.unmapped
    });
  } catch (error) {
    console.error('Error building suggestions:', error);
    res.status(500).json({ error: 'Failed to build suggestions' });
  }
});

app.get('/api/user-profile/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = path.join(dataRoot(), 'user-profiles.json');

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
app.post('/api/user-profile/:userId', validateUserIdParam, requireOwnUserId, validateUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = req.body;

    // Validate the profile structure
    try {
      validateUserProfile(profile);
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid user profile structure', details: validationError.message });
    }

    const filePath = path.join(dataRoot(), 'user-profiles.json');

    const profiles = await updateJson(filePath, {}, (current) => ({
      ...current,
      [userId]: {
        ...profile,
        createdAt: current[userId] ? current[userId].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));

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
app.delete('/api/user-profile/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = path.join(dataRoot(), 'user-profiles.json');

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

      await updateJson(filePath, {}, (current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });

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

// `GET /api/unsplash-key` is gone: it answered a server secret to any caller. It falls through to the
// 404 at the end of the stack now.

// Training Plans endpoint
app.get('/api/training-plans', async (req, res) => {
  try {
    // The plans the user built are the file. A hard-coded sample used to be answered here, so the
    // screen showed two plans nobody had, with no days and no exercises, while the real ones sat on disk.
    const raw = await fs.readFile(path.join(dataRoot(), 'training-plans.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const plans = Array.isArray(parsed) ? parsed : (parsed.plans || []);
    // Only the caller's own plans. A plan without an owner (the old shape) belongs to nobody.
    res.json(plans.filter((plan) => plan && plan.userId === req.userId));
  } catch (error) {
    if (error.code === 'ENOENT') return res.json([]);
    console.error('Error retrieving training plans:', error);
    res.status(500).json({ error: 'Failed to retrieve training plans' });
  }
});

 // POST /api/training-plans - create a new training plan and auto-generate weeks/days skeleton
 app.post('/api/training-plans', async (req, res) => {
   try {
     console.log(new Date().toISOString(), '- Entered POST /api/training-plans handler');
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid plan payload' });
    }

    const { name, description, startDate, durationWeeks } = payload;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Plan name is required' });
    }

    if (!startDate || isNaN(Date.parse(startDate))) {
      return res.status(400).json({ error: 'Valid startDate is required' });
    }

    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      return res.status(400).json({ error: 'startDate cannot be in the past' });
    }

    if (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > MAX_PLAN_WEEKS) {
      return res.status(400).json({ error: `durationWeeks must be an integer between 1 and ${MAX_PLAN_WEEKS}` });
    }

    // The plan belongs to the principal that made it, and one account may hold 50.
    const owner = req.userId || null;
    const plansPath = path.join(dataRoot(), 'training-plans.json');
    const held = plansOf(await readJson(plansPath, []), owner);
    if (held.length >= MAX_PLANS_PER_PRINCIPAL) {
      return res.status(400).json({ error: `An account holds at most ${MAX_PLANS_PER_PRINCIPAL} plans` });
    }

    // Generate IDs (simple timestamp-based ids to avoid adding a UUID dependency)
    const planId = `plan-${Date.now()}`;

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const weeks = [];
    for (let w = 1; w <= durationWeeks; w++) {
      const weekId = `${planId}-w${w}`;
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dayId = `${weekId}-d${d + 1}`;
        days.push({
          id: dayId,
          weekId,
          dayOfWeek: daysOfWeek[d],
          dayType: 'Rest',
          blocks: []
        });
      }

      weeks.push({
        id: weekId,
        planId,
        weekNumber: w,
        days
      });
    }

    const newPlan = {
      id: planId,
      userId: req.userId,
      name: name.trim(),
      description: description || '',
      startDate: start.toISOString(),
      durationWeeks,
      weeks,
      createdAt: new Date().toISOString(),
      ...(owner ? { userId: owner } : {})
    };

    // Persist to the data root's training-plans.json (array). The cap is checked again inside the
    // queued change: two creates that arrive together must not both slip past the count.
    await updateJson(plansPath, [], (current) => {
      const plans = Array.isArray(current) ? current : [];
      if (plansOf(plans, owner).length >= MAX_PLANS_PER_PRINCIPAL) {
        const full = new Error('plan limit');
        full.code = 'PLAN_LIMIT';
        throw full;
      }
      return [...plans, newPlan];
    });

    res.status(201).json(newPlan);
  } catch (error) {
    if (error.code === 'PLAN_LIMIT') {
      return res.status(400).json({ error: `An account holds at most ${MAX_PLANS_PER_PRINCIPAL} plans` });
    }
    console.error('Error creating training plan:', error);
    res.status(500).json({ error: 'Failed to create training plan' });
  }
});

 // PUT /api/training-plans/:planId - update an existing training plan
app.put('/api/training-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid plan payload' });
    }

    const plansPath = path.join(dataRoot(), 'training-plans.json');

    // A plan is at most 52 weeks. The merge keeps the incoming weeks, so the payload is the place to
    // refuse one that would grow past the ceiling.
    if (Array.isArray(payload.weeks) && payload.weeks.length > MAX_PLAN_WEEKS) {
      return res.status(400).json({ error: `A plan holds at most ${MAX_PLAN_WEEKS} weeks` });
    }

    // The editor sends the fields it renders. Merging by id keeps the ones it never sees, like
    // `dayOfWeek` on a day and `planId` on a week.
    const updatedPlan = await updateJson(plansPath, [], (current) => {
      const plans = Array.isArray(current) ? current : [];
      // Another account's plan is not a plan: same answer as a missing one, and nothing is written.
      const idx = plans.findIndex((plan) => plan.id === planId && plan.userId === req.userId);
      if (idx === -1) {
        const missing = new Error('plan not found');
        missing.code = 'NOT_FOUND';
        throw missing;
      }

      const existingPlan = plans[idx];
      const merged = {
        ...existingPlan,
        ...payload,
        id: existingPlan.id,
        userId: req.userId,
        updatedAt: new Date().toISOString()
      };
      if (Array.isArray(payload.weeks)) {
        merged.weeks = mergePlanWeeks(existingPlan.weeks, payload.weeks);
      }

      const next = [...plans];
      next[idx] = merged;
      return next;
    }).then((plans) => plans.find((plan) => plan.id === planId));

    res.json(updatedPlan);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Training plan not found' });
    }
    if (error.name === 'StoreError') {
      return res.status(500).json({ error: 'The plan file is damaged', details: error.message });
    }
    console.error('Error updating training plan:', error);
    res.status(500).json({ error: 'Failed to update training plan' });
  }
});

 // DELETE /api/training-plans/:planId - delete the caller's plan
app.delete('/api/training-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const plansPath = path.join(dataRoot(), 'training-plans.json');

    await updateJson(plansPath, [], (current) => {
      const plans = Array.isArray(current) ? current : [];
      const idx = plans.findIndex((plan) => plan.id === planId && plan.userId === req.userId);
      if (idx === -1) {
        const missing = new Error('plan not found');
        missing.code = 'NOT_FOUND';
        throw missing;
      }
      return plans.filter((_, index) => index !== idx);
    });

    res.json({
      success: true,
      message: `Training plan ${planId} deleted.`
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Training plan not found' });
    }
    if (error.name === 'StoreError') {
      return res.status(500).json({ error: 'The plan file is damaged', details: error.message });
    }
    console.error('Error deleting training plan:', error);
    res.status(500).json({ error: 'Failed to delete training plan' });
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
app.post('/telegram-webhook', (req, res) => {
  const secret = process.env.TELEGRAM_SECRET_TOKEN || '';

  // Without a secret the endpoint cannot tell Telegram from anyone else, so it does not pretend to.
  if (!secret) {
    console.warn('Telegram webhook: TELEGRAM_SECRET_TOKEN is not configured');
    return res.status(503).send('Webhook not configured');
  }

  const received = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (received !== secret) {
    console.warn('Unauthorized Telegram webhook request - invalid secret token');
    return res.status(401).send('Unauthorized');
  }

  // The update body carries whatever the sender wrote, so only its id is logged.
  const updateId = req.body && req.body.update_id;
  if (updateId !== undefined) console.log(`Telegram update ${updateId} received`);

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
  return path.join(dataRoot(), 'workout-sessions.json');
}

/**
 * The sessions of a journal, whichever of its two shapes the file has: a plain array (the oldest form)
 * or `{ schema, sessions }`. A file that reads as neither has no sessions rather than a crash.
 */
function journalSessions(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.sessions)) return parsed.sessions;
  return [];
}

/** The bodyweight the profile carries, or `undefined` when it carries none. */
async function readUserBodyweight(userId) {
  try {
    const raw = await fs.readFile(path.join(dataRoot(), 'user-profiles.json'), 'utf8');
    const profile = JSON.parse(raw)[userId];
    return profile && typeof profile.bodyweight === 'number' ? profile.bodyweight : undefined;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

// Validation function for workout sessions
function validateWorkoutSession(session) {
  if (!session || typeof session !== 'object') {
    throw new Error('Workout session is required and must be an object');
  }

  if (!session.userId || typeof session.userId !== 'string' || session.userId.trim() === '') {
    throw new Error('userId is required and must be a non-empty string');
  }

  // A request body carries the date as a string; the app's own model carries a Date.
  // Demanding a Date instance rejected every POST from the browser, so no session was ever recorded.
  const parsedDate = session.date instanceof Date ? session.date : new Date(session.date);
  if (!session.date || Number.isNaN(parsedDate.getTime())) {
    throw new Error('date is required and must be a valid date');
  }

  if (!Array.isArray(session.completedExercises)) {
    throw new Error('completedExercises is required and must be an array');
  }

  if (session.completedExercises.length > MAX_EXERCISES_PER_SESSION) {
    throw new Error(`A session holds at most ${MAX_EXERCISES_PER_SESSION} exercises`);
  }

  for (const exercise of session.completedExercises) {
    if (!exercise || typeof exercise !== 'object') {
      throw new Error('Each exercise in completedExercises must be an object');
    }

    // The plan editor and the workout model identify an exercise by name; the app has no catalogue id.
    const identifier = exercise.exerciseId || exercise.name || exercise.exercise_name;
    if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
      throw new Error('Each exercise must carry an exerciseId or a name');
    }

    if (!Array.isArray(exercise.sets)) {
      throw new Error('Each exercise must have a sets array');
    }

    if (exercise.sets.length > MAX_SETS_PER_EXERCISE) {
      throw new Error(`An exercise holds at most ${MAX_SETS_PER_EXERCISE} sets`);
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

  if (typeof session.notes === 'string' && session.notes.length > MAX_SESSION_NOTES) {
    throw new Error(`notes holds at most ${MAX_SESSION_NOTES} characters`);
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

    // A session belongs to the verified caller; a body naming another account is refused.
    if (sessionData.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    const userId = req.userId;

    // The volume comes from the sets that were done. Bodyweight work needs the body it moved, so a
    // missing profile is a refusal with a reason, never a silent zero.
    let computed;
    try {
      const bodyweight = await readUserBodyweight(userId);
      computed = computeSessionVolume(sessionData.completedExercises, bodyweight);
    } catch (volumeError) {
      return res.status(400).json({ error: 'The session cannot be measured', details: volumeError.message });
    }

    const newSession = {
      ...sessionData,
      userId,
      // Two saves in the same millisecond used to share one id, so a delete or a read hit both.
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: sessionData.date ? new Date(sessionData.date) : new Date(),
      status: 'completed', // Default to completed for new sessions
      // The weekly report counts a circuit apart from the strength band; this is how it knows.
      dayType: sessionData.dayType === 'CIRCUIT' ? 'CIRCUIT' : 'STANDARD',
      completedExercises: computed.exercises,
      totalSets: computed.totalSets,
      totalVolume: computed.totalVolume,
      total_volume_kg: computed.totalVolume
    };

    // One queued read-change-write: two saves that arrive together must both land, and a damaged
    // journal must stop here instead of being overwritten with a single session.
    await updateJson(getWorkoutSessionsPath(), { sessions: [] }, (current) => ({
      // A file in the oldest shape is an array; spreading it into an object numbered the sessions and
      // hid them from every report.
      schema: 2,
      sessions: [...journalSessions(current), newSession]
    }));

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
app.get('/api/workout-sessions/:userId', validateUserIdParam, requireOwnUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = getWorkoutSessionsPath();

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let sessionsData;
      try {
        sessionsData = JSON.parse(data);
      } catch (parseError) {
        // An empty list here reads as "no training this week" while the journal is damaged.
        console.error('JSON parse error in workout sessions data:', parseError);
        return res.status(500).json({
          error: 'The session journal is damaged',
          details: 'workout-sessions.json does not parse'
        });
      }

      // Filter sessions for the specific user
      const userSessions = journalSessions(sessionsData).filter(session => session.userId === userId);

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

      // Find the specific session. One of another account reads as missing, and says nothing about it.
      const session = journalSessions(sessionsData).find(session => session.id === sessionId && session.userId === req.userId);

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
      const removed = await updateJson(filePath, { sessions: [] }, (current) => {
        const sessions = journalSessions(current);
        const target = sessions.find((session) => session.id === sessionId);
        // A missing session and another account's session are one answer: 404, journal untouched.
        if (!target || target.userId !== req.userId) {
          const missing = new Error('not found');
          missing.code = 'NOT_FOUND';
          throw missing;
        }
        return { schema: 2, sessions: sessions.filter((session) => session.id !== sessionId) };
      });


      res.json({
        success: true,
        message: 'Workout session deleted successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Workout session not found' });
      }
      if (error.name === 'StoreError') {
        return res.status(500).json({ error: 'The session journal is damaged', details: error.message });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting workout session:', error);
    res.status(500).json({ error: 'Failed to delete workout session' });
  }
});

// Uploaded files are served after every route above, so nothing here can shadow an `/api` path. The
// browser is told not to guess the type, and only the four image types are rendered inline; anything
// else is a download.
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const extension = allowedExtension(filePath);
    res.setHeader('Content-Disposition', extension ? 'inline' : 'attachment');
  }
}));

// The last middleware of the stack: a route above that throws answers here, so an `/api` caller always
// gets JSON rather than Express's HTML error page.
app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error.code === 'INVALID_UPLOAD_TYPE') {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({ error: 'Internal server error' });
});
