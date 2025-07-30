/**
 * Workout Timer Component
 * Manages all timers for a workout session including total workout timer, preparation timer, and rest timers
 */

import { Timer } from '../utils/Timer.js';

export class WorkoutTimer {
  constructor(options = {}) {
    this.container = options.container || null;
    this.workoutSession = options.workoutSession || null;
    this.onTimerEvent = options.onTimerEvent || null;
    
    // Timer configuration
    this.config = {
      totalWorkoutTime: options.totalWorkoutTime || 0, // in minutes
      preparationTime: options.preparationTime || 10, // in seconds
      defaultRestTime: options.defaultRestTime || 60, // in seconds
      ...options.config
    };
    
    // Timer states
    this.timers = {
      total: null,
      preparation: null,
      rest: null
    };
    
    // Workout state
    this.state = {
      isActive: false,
      isPreparation: false,
      isRest: false,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      currentRoundIndex: 0,
      workoutType: 'STANDARD' // 'STANDARD' or 'CIRCUIT'
    };
    
    // Initialize timers
    this.initTimers();
    
    // Setup UI if container is provided
    if (this.container) {
      this.setupUI();
    }
  }
  
  initTimers() {
    // Total workout timer (counts up)
    this.timers.total = new Timer({
      id: 'total-workout-timer',
      name: 'Total Workout Timer',
      duration: this.config.totalWorkoutTime * 60 * 1000, // Convert minutes to milliseconds
      isCountdown: false,
      onUpdate: (data) => this.handleTimerUpdate('total', data),
      onComplete: (data) => this.handleTimerComplete('total', data)
    });
    
    // Preparation timer (counts down)
    this.timers.preparation = new Timer({
      id: 'preparation-timer',
      name: 'Preparation Timer',
      duration: this.config.preparationTime * 1000, // Convert seconds to milliseconds
      isCountdown: true,
      onUpdate: (data) => this.handleTimerUpdate('preparation', data),
      onComplete: (data) => this.handleTimerComplete('preparation', data)
    });
    
    // Rest timer (counts down)
    this.timers.rest = new Timer({
      id: 'rest-timer',
      name: 'Rest Timer',
      duration: this.config.defaultRestTime * 1000, // Convert seconds to milliseconds
      isCountdown: true,
      onUpdate: (data) => this.handleTimerUpdate('rest', data),
      onComplete: (data) => this.handleTimerComplete('rest', data)
    });
  }
  
  setupUI() {
    // Create timer display UI
    this.container.innerHTML = `
      <div class="workout-timer-container">
        <div class="timer-display" id="total-timer-display">
          <div class="timer-label">Total Time</div>
          <div class="timer-value">00:00</div>
        </div>
        
        <div class="timer-display hidden" id="preparation-timer-display">
          <div class="timer-label">Get Ready</div>
          <div class="timer-value">00:10</div>
        </div>
        
        <div class="timer-display hidden" id="rest-timer-display">
          <div class="timer-label">Rest Time</div>
          <div class="timer-value">01:00</div>
        </div>
        
        <div class="timer-controls">
          <button class="btn-primary" id="start-workout-btn">Start Workout</button>
          <button class="btn-secondary hidden" id="pause-workout-btn">Pause</button>
          <button class="btn-secondary hidden" id="resume-workout-btn">Resume</button>
          <button class="btn-danger hidden" id="stop-workout-btn">Stop Workout</button>
        </div>
      </div>
    `;
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const startBtn = this.container.querySelector('#start-workout-btn');
    const pauseBtn = this.container.querySelector('#pause-workout-btn');
    const resumeBtn = this.container.querySelector('#resume-workout-btn');
    const stopBtn = this.container.querySelector('#stop-workout-btn');
    
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startWorkout());
    }
    
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseWorkout());
    }
    
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeWorkout());
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopWorkout());
    }
  }
  
  startWorkout() {
    if (this.state.isActive) return;
    
    this.state.isActive = true;
    this.state.isPreparation = true;
    
    // Start preparation timer
    this.timers.preparation.start();
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('workoutStarted', {
      state: this.state,
      config: this.config
    });
  }
  
  pauseWorkout() {
    if (!this.state.isActive) return;
    
    // Pause all active timers
    Object.values(this.timers).forEach(timer => {
      if (timer.isRunning) {
        timer.pause();
      }
    });
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('workoutPaused', {
      state: this.state
    });
  }
  
  resumeWorkout() {
    if (!this.state.isActive) return;
    
    // Resume all timers that were running
    if (this.state.isPreparation) {
      this.timers.preparation.start();
    } else if (this.state.isRest) {
      this.timers.rest.start();
    } else {
      this.timers.total.start();
    }
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('workoutResumed', {
      state: this.state
    });
  }
  
  stopWorkout() {
    if (!this.state.isActive) return;
    
    // Stop all timers
    Object.values(this.timers).forEach(timer => {
      timer.reset();
    });
    
    // Reset state
    this.state.isActive = false;
    this.state.isPreparation = false;
    this.state.isRest = false;
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('workoutStopped', {
      state: this.state
    });
  }
  
  startRestTimer(duration = null) {
    if (!this.state.isActive) return;
    
    this.state.isRest = true;
    
    // Set rest duration if provided
    if (duration) {
      this.timers.rest.setDuration(duration * 1000);
    }
    
    // Start rest timer
    this.timers.rest.start();
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('restStarted', {
      duration: duration || this.config.defaultRestTime,
      state: this.state
    });
  }
  
  finishSet() {
    if (!this.state.isActive || this.state.isRest) return;
    
    // Start rest timer
    this.startRestTimer();
    
    // Notify listeners
    this.notifyTimerEvent('setFinished', {
      exerciseIndex: this.state.currentExerciseIndex,
      setIndex: this.state.currentSetIndex,
      state: this.state
    });
  }
  
  finishRound() {
    if (!this.state.isActive || this.state.isRest) return;
    
    // Start rest timer
    this.startRestTimer();
    
    // Notify listeners
    this.notifyTimerEvent('roundFinished', {
      roundIndex: this.state.currentRoundIndex,
      state: this.state
    });
  }
  
  nextExercise() {
    if (!this.workoutSession || !this.workoutSession.day) return;
    
    const exercises = this.workoutSession.day.exercises;
    this.state.currentExerciseIndex = (this.state.currentExerciseIndex + 1) % exercises.length;
    this.state.currentSetIndex = 0;
    
    // Notify listeners
    this.notifyTimerEvent('exerciseChanged', {
      exerciseIndex: this.state.currentExerciseIndex,
      exercise: exercises[this.state.currentExerciseIndex],
      state: this.state
    });
  }
  
  nextSet() {
    if (!this.workoutSession || !this.workoutSession.day) return;
    
    const currentExercise = this.workoutSession.day.exercises[this.state.currentExerciseIndex];
    this.state.currentSetIndex = (this.state.currentSetIndex + 1) % currentExercise.sets;
    
    // If we've completed all sets for this exercise, move to next exercise
    if (this.state.currentSetIndex === 0) {
      this.nextExercise();
    }
    
    // Notify listeners
    this.notifyTimerEvent('setChanged', {
      exerciseIndex: this.state.currentExerciseIndex,
      setIndex: this.state.currentSetIndex,
      state: this.state
    });
  }
  
  nextRound() {
    if (!this.workoutSession || !this.workoutSession.day) return;
    
    const circuitConfig = this.workoutSession.day.circuit_config;
    this.state.currentRoundIndex = (this.state.currentRoundIndex + 1) % circuitConfig.target_rounds;
    
    // Notify listeners
    this.notifyTimerEvent('roundChanged', {
      roundIndex: this.state.currentRoundIndex,
      state: this.state
    });
  }
  
  handleTimerUpdate(timerId, data) {
    // Update UI with timer data
    this.updateTimerDisplay(timerId, data);
    
    // Notify listeners
    this.notifyTimerEvent('timerUpdate', {
      timerId: timerId,
      data: data,
      state: this.state
    });
  }
  
  handleTimerComplete(timerId, data) {
    switch (timerId) {
      case 'preparation':
        this.handlePreparationComplete();
        break;
      case 'rest':
        this.handleRestComplete();
        break;
      case 'total':
        this.handleTotalWorkoutComplete();
        break;
    }
    
    // Notify listeners
    this.notifyTimerEvent('timerComplete', {
      timerId: timerId,
      data: data,
      state: this.state
    });
  }
  
  handlePreparationComplete() {
    this.state.isPreparation = false;
    
    // Start total workout timer
    this.timers.total.start();
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('preparationComplete', {
      state: this.state
    });
  }
  
  handleRestComplete() {
    this.state.isRest = false;
    
    // Auto-progress based on workout type
    if (this.state.workoutType === 'STANDARD') {
      this.nextSet();
    } else if (this.state.workoutType === 'CIRCUIT') {
      this.nextRound();
    }
    
    // Update UI
    this.updateUI();
    
    // Notify listeners
    this.notifyTimerEvent('restComplete', {
      state: this.state
    });
  }
  
  handleTotalWorkoutComplete() {
    // Stop all timers
    this.stopWorkout();
    
    // Notify listeners
    this.notifyTimerEvent('workoutComplete', {
      state: this.state
    });
  }
  
  updateTimerDisplay(timerId, data) {
    const displayElement = this.container.querySelector(`#${timerId}-timer-display .timer-value`);
    if (displayElement) {
      displayElement.textContent = data.formattedTime;
    }
  }
  
  updateUI() {
    if (!this.container) return;
    
    // Update timer display visibility
    const totalDisplay = this.container.querySelector('#total-timer-display');
    const preparationDisplay = this.container.querySelector('#preparation-timer-display');
    const restDisplay = this.container.querySelector('#rest-timer-display');
    
    // Hide all displays first
    totalDisplay.classList.add('hidden');
    preparationDisplay.classList.add('hidden');
    restDisplay.classList.add('hidden');
    
    // Show appropriate display
    if (this.state.isPreparation) {
      preparationDisplay.classList.remove('hidden');
    } else if (this.state.isRest) {
      restDisplay.classList.remove('hidden');
    } else if (this.state.isActive) {
      totalDisplay.classList.remove('hidden');
    }
    
    // Update button visibility
    const startBtn = this.container.querySelector('#start-workout-btn');
    const pauseBtn = this.container.querySelector('#pause-workout-btn');
    const resumeBtn = this.container.querySelector('#resume-workout-btn');
    const stopBtn = this.container.querySelector('#stop-workout-btn');
    
    // Hide all buttons first
    startBtn.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    
    // Show appropriate buttons
    if (!this.state.isActive) {
      startBtn.classList.remove('hidden');
    } else {
      if (this.state.isPreparation || this.state.isRest) {
        pauseBtn.classList.remove('hidden');
      } else {
        pauseBtn.classList.remove('hidden');
      }
      stopBtn.classList.remove('hidden');
    }
  }
  
  notifyTimerEvent(eventType, data) {
    if (this.onTimerEvent) {
      this.onTimerEvent({
        type: eventType,
        timestamp: Date.now(),
        data: data
      });
    }
  }
  
  setWorkoutType(type) {
    this.state.workoutType = type;
  }
  
  setConfig(config) {
    this.config = { ...this.config, ...config };
    
    // Update timer durations
    this.timers.preparation.setDuration(this.config.preparationTime * 1000);
    this.timers.rest.setDuration(this.config.defaultRestTime * 1000);
  }
  
  getState() {
    return {
      ...this.state,
      timers: {
        total: this.timers.total.getState(),
        preparation: this.timers.preparation.getState(),
        rest: this.timers.rest.getState()
      },
      config: this.config
    };
  }
  
  setState(state) {
    this.state = { ...this.state, ...state };
    
    // Update timer states if provided
    if (state.timers) {
      if (state.timers.total) {
        this.timers.total.currentTime = state.timers.total.currentTime;
        this.timers.total.isRunning = state.timers.total.isRunning;
      }
      
      if (state.timers.preparation) {
        this.timers.preparation.currentTime = state.timers.preparation.currentTime;
        this.timers.preparation.isRunning = state.timers.preparation.isRunning;
      }
      
      if (state.timers.rest) {
        this.timers.rest.currentTime = state.timers.rest.currentTime;
        this.timers.rest.isRunning = state.timers.rest.isRunning;
      }
    }
    
    // Update UI
    this.updateUI();
  }
  
  destroy() {
    // Stop all timers
    Object.values(this.timers).forEach(timer => {
      timer.destroy();
    });
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}