/**
 * Workout Component
 * Main workout view that handles both standard and circuit training workflows
 */

import { WorkoutSession } from '../models/WorkoutSession.js';
import { WorkoutTimer } from './WorkoutTimer.js';
import { TimerSetupModal } from './TimerSetupModal.js';
import { LogSetModal } from './LogSetModal.js';
import { LogRoundModal } from './LogRoundModal.js';
import { VolumeCalculator } from '../utils/VolumeCalculator.js';

export class Workout {
  constructor(container, apiService, storageService, navigationService) {
    this.container = container;
    this.api = apiService;
    this.storage = storageService;
    this.navigation = navigationService;
    
    // Workout data
    this.workoutSession = null;
    this.day = null;
    this.userProfile = null;
    
    // Components
    this.workoutTimer = null;
    this.timerSetupModal = null;
    this.logSetModal = null;
    this.logRoundModal = null;
    
    // UI elements
    this.timerContainer = null;
    this.exerciseContainer = null;
    this.controlsContainer = null;
    
    // State
  this.isInitialized = false;
  this.isWorkoutActive = false;
  this.currentExerciseIndex = 0;
  this.currentSetIndex = 0;
  this.currentRoundIndex = 0;
  this.currentWorkoutColor = null;
  }
  
  async init() {
    try {
      // Load user profile
      this.userProfile = await this.loadUserProfile();
      
      // Setup UI
      this.setupUI();
      
      // Initialize components
      this.initializeComponents();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('Workout component initialized successfully');
    } catch (error) {
      console.error('Failed to initialize workout component:', error);
      this.showError('Failed to initialize workout');
    }
  }
  
  async initWithDay(dayId) {
    await this.init();
    
    try {
      // Load day data
      const day = await this.api.getDay(dayId);
      if (!day) {
        throw new Error('Day not found');
      }
      
      this.day = day;
      
      // Create workout session
      this.workoutSession = new WorkoutSession({
        dayId: dayId,
        day: day,
        userId: this.userProfile.id,
        timerConfig: {
          workoutType: day.day_type || 'STANDARD'
        },
        color: this.currentWorkoutColor
      });
      
      // Show timer setup modal
      this.showTimerSetupModal();
    } catch (error) {
      console.error('Failed to initialize workout with day:', error);
      this.showError('Failed to load workout data');
    }
  }
  
  async initWithSession(sessionId) {
    await this.init();
    
    try {
      // Load session data
      const sessionData = await this.api.getWorkoutSession(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }
      
      // Create workout session from data
      this.workoutSession = new WorkoutSession(sessionData);
      this.day = this.workoutSession.day;
      
      // Restore timer state
      if (this.workoutSession.timerState) {
        this.restoreTimerState(this.workoutSession.timerState);
      }
      
      // Render workout
      this.renderWorkout();
    } catch (error) {
      console.error('Failed to initialize workout with session:', error);
      this.showError('Failed to load workout session');
    }
  }
  
  async loadUserProfile() {
    try {
      const user = await this.storage.getItem('user');
      if (!user) {
        throw new Error('User not found');
      }
      try {
        // Try to load existing profile
        const userProfile = await this.api.getUserProfile(user.id);
        return userProfile || { id: user.id, bodyweight: 70 };
      } catch (err) {
        // If profile not found, create a default one
        if (String(err.message).includes('404') || String(err.message).toLowerCase().includes('not found')) {
          const defaultProfile = { userId: String(user.id), bodyweight: 70 };
          try {
            await this.api.saveUserProfile(String(user.id), defaultProfile);
            return { id: user.id, bodyweight: defaultProfile.bodyweight };
          } catch (saveErr) {
            console.warn('Failed to auto-create user profile, falling back to defaults:', saveErr);
            return { id: user.id, bodyweight: 70 };
          }
        }
        throw err;
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      return { id: 1, bodyweight: 70 }; // Default fallback
    }
  }
  
  setupUI() {
    this.container.innerHTML = `
      <div class="workout-container">
        <!-- Timer Section -->
        <div class="workout-timer-section" id="workout-timer-section">
          <!-- Timer will be rendered here -->
        </div>
        
        <!-- Workout Info -->
        <div class="workout-info">
          <div class="workout-stats">
            <div class="stat-item">
              <span class="stat-label">Volume</span>
              <span class="stat-value" id="workout-volume">0 kg</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Sets</span>
              <span class="stat-value" id="workout-sets">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Reps</span>
              <span class="stat-value" id="workout-reps">0</span>
            </div>
          </div>
        </div>
        
        <!-- Exercise Section -->
        <div class="exercise-section" id="exercise-section">
          <!-- Exercise content will be rendered here -->
        </div>
        
        <!-- Controls Section -->
        <div class="controls-section" id="controls-section">
          <!-- Controls will be rendered here -->
        </div>
      </div>
    `;
    
    // Get UI element references
    this.timerContainer = this.container.querySelector('#workout-timer-section');
    this.exerciseContainer = this.container.querySelector('#exercise-section');
    this.controlsContainer = this.container.querySelector('#controls-section');
  }
  
  initializeComponents() {
    // Initialize workout timer
    this.workoutTimer = new WorkoutTimer({
      container: this.timerContainer,
      workoutSession: this.workoutSession,
      onTimerEvent: (event) => this.handleTimerEvent(event)
    });
    
    // Initialize modals
    this.timerSetupModal = new TimerSetupModal({
      onSave: (config) => this.handleTimerSetupSave(config),
      onCancel: () => this.handleTimerSetupCancel()
    });
    
    this.logSetModal = new LogSetModal({
      onSave: (setData) => this.handleLogSetSave(setData),
      onCancel: () => this.handleLogSetCancel()
    });
    
    this.logRoundModal = new LogRoundModal({
      onSave: (roundData) => this.handleLogRoundSave(roundData),
      onCancel: () => this.handleLogRoundCancel()
    });
  }
  
  setupEventListeners() {
    // Handle page visibility change for timer persistence
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveTimerState();
      } else if (this.isWorkoutActive) {
        this.restoreTimerState();
      }
    });
    
    // Handle beforeunload to save timer state
    window.addEventListener('beforeunload', () => {
      if (this.isWorkoutActive) {
        this.saveTimerState();
      }
    });
  }
  
  showTimerSetupModal() {
    if (!this.workoutSession) return;
    
    const config = {
      ...this.workoutSession.timerConfig,
      workoutType: this.day.day_type || 'STANDARD'
    };
    
    this.timerSetupModal.open(config);
  }
  
  handleTimerSetupSave(config) {
    if (!this.workoutSession) return;
    
    // Update workout session timer config
    this.workoutSession.timerConfig = config;
    
    // Update workout timer config
    this.workoutTimer.setConfig(config);
    this.workoutTimer.setWorkoutType(config.workoutType);
    
    // Start workout
    this.startWorkout();
  }
  
  handleTimerSetupCancel() {
    // Navigate back to dashboard
    this.navigation.navigateTo('dashboard');
  }
  
  startWorkout() {
    if (!this.workoutSession || !this.day) return;
    
    this.isWorkoutActive = true;
    
    // Set session start time
    this.workoutSession.startTime = new Date();
    
    // Render workout
    this.renderWorkout();
    
    // Save session
    this.saveWorkoutSession();
  }
  
  renderWorkout() {
    if (!this.day) return;
    
    // Update workout title
    const titleElement = this.container.querySelector('#workout-title');
    if (titleElement) {
      titleElement.textContent = this.day.name || 'Workout';
    }
    
    // Render based on workout type
    if (this.day.day_type === 'CIRCUIT') {
      this.renderCircuitWorkout();
    } else {
      this.renderStandardWorkout();
    }
    
    // Update stats
    this.updateWorkoutStats();
  }
  
  renderStandardWorkout() {
    if (!this.day || !this.day.exercises || this.day.exercises.length === 0) return;
    
    const currentExercise = this.day.exercises[this.currentExerciseIndex];
    
    const renderTally = (totalSets, completed) => {
      // Normalize numeric values
      const total = Number(totalSets) || 0;
      const done = Number(completed) || 0;

      // Try to infer exercise-level data when total isn't provided
      const exercise = this.day?.exercises?.[this.currentExerciseIndex];

      if (!total || total <= 0) {
        const inferredDone = exercise && Array.isArray(exercise.completed_sets) ? exercise.completed_sets.length : Math.max(0, this.currentSetIndex);
        const inferredTotal = exercise && Number(exercise.sets) ? Number(exercise.sets) : 0;
        const inferredRemaining = inferredTotal ? Math.max(0, inferredTotal - inferredDone) : 0;

        // If we know the planned sets, show done • remaining, otherwise just show done
        if (inferredTotal) {
          return `<div class="exercise-progress">${inferredDone} done • ${inferredRemaining} remaining</div>`;
        } else {
          return `<div class="exercise-progress">${inferredDone} done</div>`;
        }
      }

      const completedClamped = Math.min(done, total);
      const remaining = Math.max(0, total - completedClamped);

      const groups = [];
      // Iterate groups of 5 sets (visual group = up to 4 vertical sticks + diagonal for the 5th)
      for (let i = 0; i < total; i += 5) {
        const marks = [];
        const groupTotal = Math.min(5, total - i);
        // visible vertical marks = up to 4 (the 5th is represented by the diagonal when group complete)
        const visibleMarks = Math.min(4, groupTotal);
        const filledInGroup = Math.max(0, Math.min(completedClamped - i, visibleMarks));

        for (let m = 0; m < visibleMarks; m++) {
          const filled = m < filledInGroup ? 'filled' : '';
          marks.push(`<span class="tally-mark ${filled}" aria-hidden="true"></span>`);
        }

        // Determine if entire group of 5 is complete (completed >= i + 5) OR if groupTotal < 5 and completed fills them all
        const groupComplete = (i + 5 <= total) ? (completedClamped >= i + 5) : (completedClamped >= i + groupTotal);
        const groupClass = groupComplete ? 'tally-group complete' : 'tally-group';
        groups.push(`<div class="${groupClass}">${marks.join('')}</div>`);
      }

      // Include a visible textual summary alongside the tally marks for clarity: "X done • Y remaining"
      return `<div class="exercise-progress tally" aria-label="${completedClamped} of ${total} sets completed"><span class="visually-hidden">${completedClamped} of ${total} sets completed</span>${groups.join('')}<div class="tally-summary" aria-hidden="true">${completedClamped} done • ${remaining} remaining</div></div>`;
    };

    this.exerciseContainer.innerHTML = `
      <div class="current-exercise">
        <div class="exercise-header">
          <h3>${currentExercise.name}</h3>
          ${renderTally(currentExercise.sets, (currentExercise.completed_sets || []).length)}
        </div>
        
        <div class="exercise-details">
          <div class="exercise-target">
            <p>${this.buildTargetText(currentExercise, this.day?.day_type || 'STANDARD')}</p>
          </div>
          
${currentExercise.instructions ? `
          <div class="exercise-instructions">
            <p>${currentExercise.instructions}</p>
          </div>
        ` : ''}
        </div>
        
        <div class="exercise-image">
          ${currentExercise.imageUrl ? 
            `<img src="${currentExercise.imageUrl}" alt="${currentExercise.name}">` : 
            '<div class="placeholder-image">No image available</div>'
          }
        </div>
      </div>
    `;
    
    // Render controls
    this.controlsContainer.innerHTML = `
      <div class="workout-controls">
        <button class="btn-primary" id="finish-set-btn">Finish Set</button>
        <button class="btn-secondary" id="skip-exercise-btn">Skip Exercise</button>
        <button class="btn-danger" id="end-workout-btn">End Workout</button>
      </div>
    `;
    
    // Setup control event listeners
    this.setupStandardWorkoutControls();
  }
  
  renderCircuitWorkout() {
    if (!this.day || !this.day.exercises || this.day.exercises.length === 0) return;
    
    const roundNumber = this.currentRoundIndex + 1;
    const totalRounds = this.day.circuit_config?.target_rounds || 3;
    
    this.exerciseContainer.innerHTML = `
      <div class="circuit-workout">
        <div class="circuit-header">
          <h3>Round ${roundNumber} of ${totalRounds}</h3>
        </div>
        
        <div class="circuit-exercises">
          ${this.day.exercises.map((exercise, index) => `
            <div class="circuit-exercise-item">
              <h4>${exercise.name}</h4>
              <div class="exercise-target">
                <p>${this.buildTargetText(exercise, 'CIRCUIT')}</p>
              </div>
              <div class="exercise-inputs">
                <div class="input-group">
                  <label>Reps</label>
                  <input type="number" id="circuit-exercise-reps-${index}" min="0" max="100" value="${exercise.reps || 0}">
                </div>
                <div class="input-group">
                  <label>Weight (kg)</label>
                  <input type="number" id="circuit-exercise-weight-${index}" min="0" max="500" step="0.5" value="${exercise.weight || 0}">
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Render controls
    this.controlsContainer.innerHTML = `
      <div class="workout-controls">
        <button class="btn-primary" id="finish-round-btn">Finish Round</button>
        <button class="btn-secondary" id="skip-round-btn">Skip Round</button>
        <button class="btn-danger" id="end-workout-btn">End Workout</button>
      </div>
    `;
    
    // Setup control event listeners
    this.setupCircuitWorkoutControls();
  }
  
  buildTargetText(exercise, dayType = 'STANDARD') {
    // Normalize fields (support legacy and new field names)
    const sets = exercise.target_sets || exercise.sets || 0;
    const repsRaw = exercise.target_reps || exercise.reps || 0;
    const weightRaw = (typeof exercise.weight !== 'undefined') ? exercise.weight : (exercise.bodyweight_load_percentage ? null : 0);

    const reps = (typeof repsRaw === 'string') ? repsRaw : Number(repsRaw);
    const weight = (typeof weightRaw === 'number') ? Math.round(weightRaw) : weightRaw;

    // Detect AMRAP (flexible)
    const isAMRAP = (typeof reps === 'string' && String(reps).toUpperCase() === 'AMRAP') || exercise.amrap === true;

    if (dayType === 'CIRCUIT' && isAMRAP) {
      // For bodyweight exercises, apply bodyweight load percentage if available
      let bodyweightLabel = 'Bodyweight';
      if (this.userProfile && this.userProfile.bodyweight) {
        const bw = this.userProfile.bodyweight;
        let loadPct = 1.0;
        if (typeof exercise.getBodyweightLoadPercentage === 'function') {
          try { loadPct = exercise.getBodyweightLoadPercentage(); } catch (e) { loadPct = exercise.bodyweight_load_percentage || 1.0; }
        } else {
          loadPct = exercise.bodyweight_load_percentage || 1.0;
        }
        const computed = Math.round(bw * loadPct);
        bodyweightLabel = `${computed} kg`;
      }
      return `AMRAP • Bodyweight ${bodyweightLabel}`;
    }

    // Build parts for standard display: "Sets {sets} • {reps} reps • {weight} kg"
    const parts = [];

    if (sets && sets > 0) {
      parts.push(`Sets ${sets}`);
    }

    if (reps && String(reps) !== '0') {
      parts.push(`${reps} reps`);
    }

    if (typeof weight === 'number' && !isNaN(weight) && weight > 0) {
      parts.push(`${weight} kg`);
    }

    // Fallback if nothing available
    if (parts.length === 0) {
      return 'Target';
    }

    return parts.join(' • ');
  }

  setupStandardWorkoutControls() {
    const finishSetBtn = this.controlsContainer.querySelector('#finish-set-btn');
    const skipExerciseBtn = this.controlsContainer.querySelector('#skip-exercise-btn');
    const endWorkoutBtn = this.controlsContainer.querySelector('#end-workout-btn');
    
    if (finishSetBtn) {
      finishSetBtn.addEventListener('click', () => this.handleFinishSet());
    }
    
    if (skipExerciseBtn) {
      skipExerciseBtn.addEventListener('click', () => this.handleSkipExercise());
    }
    
    if (endWorkoutBtn) {
      endWorkoutBtn.addEventListener('click', () => this.handleEndWorkout());
    }
  }
  
  setupCircuitWorkoutControls() {
    const finishRoundBtn = this.controlsContainer.querySelector('#finish-round-btn');
    const skipRoundBtn = this.controlsContainer.querySelector('#skip-round-btn');
    const endWorkoutBtn = this.controlsContainer.querySelector('#end-workout-btn');
    
    if (finishRoundBtn) {
      finishRoundBtn.addEventListener('click', () => this.handleFinishRound());
    }
    
    if (skipRoundBtn) {
      skipRoundBtn.addEventListener('click', () => this.handleSkipRound());
    }
    
    if (endWorkoutBtn) {
      endWorkoutBtn.addEventListener('click', () => this.handleEndWorkout());
    }
  }
  
  handleFinishSet() {
    if (!this.day || !this.day.exercises || this.day.exercises.length === 0) return;
    
    const currentExercise = this.day.exercises[this.currentExerciseIndex];
    
    // Show log set modal
    this.logSetModal.open({
      exercise: currentExercise,
      plannedReps: currentExercise.reps,
      plannedWeight: currentExercise.weight
    });
  }
  
  handleLogSetSave(setData) {
    if (!this.workoutSession || !setData.exercise) return;
    
    // Add completed set to exercise
    const exercise = setData.exercise;
    if (!exercise.completed_sets) {
      exercise.completed_sets = [];
    }
    
    exercise.completed_sets.push({
      reps: setData.actualReps,
      weight: setData.actualWeight,
      notes: setData.notes,
      timestamp: setData.timestamp
    });
    
    // Update workout session
    this.updateWorkoutSession();
    
    // Start rest timer
    this.workoutTimer.startRestTimer();
    
    // Move to next set or exercise
    this.currentSetIndex++;
    if (this.currentSetIndex >= exercise.sets) {
      this.currentSetIndex = 0;
      this.currentExerciseIndex++;
      
      if (this.currentExerciseIndex >= this.day.exercises.length) {
        // Workout completed
        this.completeWorkout();
        return;
      }
    }
    
    // Re-render workout
    this.renderWorkout();
  }
  
  handleLogSetCancel() {
    // User cancelled logging set, do nothing
  }
  
  handleSkipExercise() {
    if (!this.day || !this.day.exercises || this.day.exercises.length === 0) return;
    
    // Move to next exercise
    this.currentExerciseIndex++;
    this.currentSetIndex = 0;
    
    if (this.currentExerciseIndex >= this.day.exercises.length) {
      // Workout completed
      this.completeWorkout();
      return;
    }
    
    // Re-render workout
    this.renderWorkout();
  }
  
  handleFinishRound() {
    if (!this.day || !this.day.exercises || this.day.exercises.length === 0) return;
    
    // Collect exercise data for this round
    const exercisesData = this.day.exercises.map((exercise, index) => {
      const repsInput = this.container.querySelector(`#circuit-exercise-reps-${index}`);
      const weightInput = this.container.querySelector(`#circuit-exercise-weight-${index}`);
      
      return {
        ...exercise,
        actualReps: parseInt(repsInput.value) || 0,
        actualWeight: parseFloat(weightInput.value) || 0
      };
    });
    
    // Show log round modal
    this.logRoundModal.open({
      exercises: exercisesData,
      roundNumber: this.currentRoundIndex + 1
    });
  }
  
  handleLogRoundSave(roundData) {
    if (!this.workoutSession || !roundData.exercises) return;
    
    // Add completed sets to exercises
    roundData.exercises.forEach((exercise, index) => {
      if (exercise.actualReps > 0) {
        const originalExercise = this.day.exercises[index];
        if (!originalExercise.completed_sets) {
          originalExercise.completed_sets = [];
        }
        
        originalExercise.completed_sets.push({
          reps: exercise.actualReps,
          weight: exercise.actualWeight,
          round: roundData.roundNumber,
          timestamp: roundData.timestamp
        });
      }
    });
    
    // Update workout session
    this.updateWorkoutSession();
    
    // Start rest timer
    this.workoutTimer.startRestTimer();
    
    // Move to next round
    this.currentRoundIndex++;
    
    const totalRounds = this.day.circuit_config?.target_rounds || 3;
    if (this.currentRoundIndex >= totalRounds) {
      // Workout completed
      this.completeWorkout();
      return;
    }
    
    // Re-render workout
    this.renderWorkout();
  }
  
  handleLogRoundCancel() {
    // User cancelled logging round, do nothing
  }
  
  handleSkipRound() {
    if (!this.day) return;
    
    // Move to next round
    this.currentRoundIndex++;
    
    const totalRounds = this.day.circuit_config?.target_rounds || 3;
    if (this.currentRoundIndex >= totalRounds) {
      // Workout completed
      this.completeWorkout();
      return;
    }
    
    // Re-render workout
    this.renderWorkout();
  }
  
  handleEndWorkout() {
    if (confirm('Are you sure you want to end this workout?')) {
      this.completeWorkout();
    }
  }
  
  completeWorkout() {
    if (!this.workoutSession) return;
    
    // Stop timer
    this.workoutTimer.stopWorkout();
    
    // Complete workout session
    this.workoutSession.complete();
    
    // Save session
    this.saveWorkoutSession();
    
    // Navigate to dashboard
    this.navigation.navigateTo('dashboard');
  }
  
  handleTimerEvent(event) {
    const { type, data } = event;
    
    switch (type) {
      case 'workoutStarted':
        this.isWorkoutActive = true;
        break;
        
      case 'workoutPaused':
        this.saveTimerState();
        break;
        
      case 'workoutResumed':
        this.restoreTimerState();
        break;
        
      case 'workoutStopped':
        this.isWorkoutActive = false;
        this.saveTimerState();
        break;
        
      case 'workoutComplete':
        this.completeWorkout();
        break;
        
      case 'restComplete':
        // Re-render workout after rest
        this.renderWorkout();
        break;
        
      default:
        console.log('Unhandled timer event:', type);
    }
  }
  
  updateWorkoutSession() {
    if (!this.workoutSession) return;
    
    // Calculate totals
    this.workoutSession.calculateTotals();
    
    // Calculate total volume
    this.workoutSession.calculateTotalVolume(this.userProfile.bodyweight);
    
    // Update UI
    this.updateWorkoutStats();
    
    // Save session
    this.saveWorkoutSession();
  }
  
  updateWorkoutStats() {
    if (!this.workoutSession) return;
    
    const volumeElement = this.container.querySelector('#workout-volume');
    const setsElement = this.container.querySelector('#workout-sets');
    const repsElement = this.container.querySelector('#workout-reps');
    
    if (volumeElement) {
      volumeElement.textContent = `${Math.round(this.workoutSession.totalVolume)} kg`;
    }
    
    if (setsElement) {
      setsElement.textContent = this.workoutSession.totalSets;
    }
    
    if (repsElement) {
      repsElement.textContent = this.workoutSession.totalReps;
    }
  }
  
  saveTimerState() {
    if (!this.workoutSession || !this.workoutTimer) return;
    
    // Get timer state
    const timerState = this.workoutTimer.getState();
    
    // Update workout session timer state
    this.workoutSession.timerState = {
      ...this.workoutSession.timerState,
      isActive: this.isWorkoutActive,
      currentExerciseIndex: this.currentExerciseIndex,
      currentSetIndex: this.currentSetIndex,
      currentRoundIndex: this.currentRoundIndex,
      timers: timerState.timers
    };
    
    // Save session
    this.saveWorkoutSession();
  }
  
  restoreTimerState(timerState = null) {
    if (!this.workoutSession || !this.workoutTimer) return;
    
    const state = timerState || this.workoutSession.timerState;
    if (!state) return;
    
    // Restore state
    this.isWorkoutActive = state.isActive;
    this.currentExerciseIndex = state.currentExerciseIndex || 0;
    this.currentSetIndex = state.currentSetIndex || 0;
    this.currentRoundIndex = state.currentRoundIndex || 0;
    
    // Restore timer state
    this.workoutTimer.setState(state);
  }
  
  async saveWorkoutSession() {
    if (!this.workoutSession) return;
    
    try {
      // Save to storage
      await this.storage.setItem('currentWorkoutSession', this.workoutSession.toJSON());
      
      // Save to API if session has an ID
      if (this.workoutSession.id) {
        await this.api.updateWorkoutSession(this.workoutSession.id, this.workoutSession.toJSON());
      }
    } catch (error) {
      console.error('Failed to save workout session:', error);
    }
  }
  
  showError(message) {
    // Simple error display
    this.container.innerHTML = `
      <div class="error-message">
        <h2>Error</h2>
        <p>${message}</p>
        <button class="btn-primary" id="back-to-dashboard-btn">Back to Dashboard</button>
      </div>
    `;
    
    const backBtn = this.container.querySelector('#back-to-dashboard-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.navigation.navigateTo('dashboard');
      });
    }
  }
  
  destroy() {
    // Clean up components
    if (this.workoutTimer) {
      this.workoutTimer.destroy();
    }
    
    if (this.timerSetupModal) {
      this.timerSetupModal.destroy();
    }
    
    if (this.logSetModal) {
      this.logSetModal.destroy();
    }
    
    if (this.logRoundModal) {
      this.logRoundModal.destroy();
    }
    
    // Clear container
    this.container.innerHTML = '';
    
    // Clear references
    this.container = null;
    this.api = null;
    this.storage = null;
    this.navigation = null;
    this.workoutSession = null;
    this.day = null;
    this.userProfile = null;
    this.workoutTimer = null;
    this.timerSetupModal = null;
    this.logSetModal = null;
    this.logRoundModal = null;
    this.timerContainer = null;
    this.exerciseContainer = null;
    this.controlsContainer = null;
  }
}

// Make Workout component globally available
window.Workout = Workout;
