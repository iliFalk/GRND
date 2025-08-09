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
    // Track whether the UI should show the "playing" (running) state.
    this._isPlaying = false;
    
    // Setup UI if container is provided
    if (this.container) {
      this.setupUI();
    }
    
    // Install defensive observer to hide any stray start buttons that may be inserted later
    if (typeof MutationObserver !== 'undefined') {
      try {
        this.installStartButtonObserver = this.installStartButtonObserver || function () {};
      } catch (e) {
        // noop
      }
    }
  }
  
  initTimers() {
    // Total workout timer (counts down - show remaining time)
    this.timers.total = new Timer({
      id: 'total-workout-timer',
      name: 'Total Workout Timer',
      duration: this.config.totalWorkoutTime * 60 * 1000, // Convert minutes to milliseconds
      isCountdown: true,
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
    // Create timer display UI (split elapsed / remaining so we can colour them)
    this.container.innerHTML = `
      <div class="workout-timer-container">
        <div class="timer-display" id="total-timer-display">
          <div class="timer-label">Total Time</div>
          <div class="timer-values">
            <span class="timer-elapsed">00:00.00</span>
            <span class="timer-remaining">—</span>
          </div>
        </div>
        
        <div class="timer-display hidden" id="preparation-timer-display">
          <div class="timer-label">Get Ready</div>
          <div class="timer-values">
            <span class="timer-elapsed">00:10</span>
            <span class="timer-remaining">—</span>
          </div>
        </div>
        
        <div class="timer-display hidden" id="rest-timer-display">
          <div class="timer-label">Rest Time</div>
          <div class="timer-values">
            <span class="timer-elapsed">01:00</span>
            <span class="timer-remaining">—</span>
          </div>
        </div>
        
        <div class="timer-controls">
          <button class="btn-primary" id="start-workout-btn">Start Workout</button>
          <button class="btn-primary btn-toggle hidden" id="play-pause-toggle" aria-label="Pause">
            <!-- Pause and Play SVGs sized to 48x48 to ensure consistent icon sizing across platforms -->
            <svg class="icon icon-pause" width="48" height="48" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <!-- Use square bars (no rounding) for a true "||" appearance -->
              <rect x="6" y="5" width="4" height="14" rx="0" fill="currentColor"/>
              <rect x="14" y="5" width="4" height="14" rx="0" fill="currentColor"/>
            </svg>
            <svg class="icon icon-play" width="48" height="48" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="display: none;">
              <path d="M7 5v14l12-7z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Ensure we only attach delegated listeners once (defensive).
    if (this._eventsInitialized) return;
    this._eventsInitialized = true;

    // Delegate clicks inside the timer container so the handler survives small re-renders.
    this.container.addEventListener('click', (e) => {
      const startBtn = e.target.closest && e.target.closest('#start-workout-btn');
      const toggleBtn = e.target.closest && e.target.closest('#play-pause-toggle');

      if (startBtn) {
        // Defensive: stop propagation and handle start
        e.stopPropagation();
        this.startWorkout();
        return;
      }

      if (toggleBtn) {
        // Defensive: stop propagation so other handlers don't interfere
        e.stopPropagation();

        // Ensure button is enabled
        try { toggleBtn.disabled = false; } catch (err) { /* ignore */ }

        // Log for debugging (inspect in DevTools to diagnose toggling issues)
        console.log('[WorkoutTimer] toggle clicked — before:', {
          isPlaying: this._isPlaying,
          totalRunning: !!(this.timers.total && this.timers.total.isRunning),
          prepRunning: !!(this.timers.preparation && this.timers.preparation.isRunning),
          restRunning: !!(this.timers.rest && this.timers.rest.isRunning)
        });

        // Flip UI playing state and immediately update visuals, then call pause/resume.
        this._isPlaying = !this._isPlaying;

        {
          const playIcon = toggleBtn.querySelector && toggleBtn.querySelector('.icon-play');
          const pauseIcon = toggleBtn.querySelector && toggleBtn.querySelector('.icon-pause');

          if (this._isPlaying) {
            if (pauseIcon) pauseIcon.style.display = '';
            if (playIcon) playIcon.style.display = 'none';
            toggleBtn.setAttribute('aria-label', 'Pause');
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-primary');
            this.resumeWorkout();
          } else {
            if (pauseIcon) pauseIcon.style.display = 'none';
            if (playIcon) playIcon.style.display = '';
            toggleBtn.setAttribute('aria-label', 'Resume');
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
            this.pauseWorkout();
          }
        }

        // Log result for easier debugging
        console.log('[WorkoutTimer] toggle handled — after:', {
          isPlaying: this._isPlaying,
          totalRunning: !!(this.timers.total && this.timers.total.isRunning),
          prepRunning: !!(this.timers.preparation && this.timers.preparation.isRunning),
          restRunning: !!(this.timers.rest && this.timers.rest.isRunning)
        });
      }
    });
  }
  
  // Defensive MutationObserver: if some render recreates a Start button after we've started,
  // this will hide it immediately when the workout is active.
  installStartButtonObserver() {
    try {
      const observer = new MutationObserver((mutations) => {
        if (!this.state || !this.state.isActive) return;
        mutations.forEach(m => {
          (m.addedNodes || []).forEach(node => {
            try {
              // Direct node with ID
              if (node && node.id === 'start-workout-btn') {
                node.classList.add('hidden');
                return;
              }
              // Node subtree contains the start button
              if (node && node.querySelector) {
                const btn = node.querySelector('#start-workout-btn');
                if (btn) btn.classList.add('hidden');
              }
            } catch (e) {
              // ignore
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      this._startBtnObserver = observer;
    } catch (e) {
      // ignore
    }
  }
  
  startWorkout() {
    if (this.state.isActive) return;
    
    this.state.isActive = true;
    // When a workout starts we consider it playing (preparation will run)
    this._isPlaying = true;
    this.state.isPreparation = true;
    
    // Hide all start buttons immediately to avoid visual flicker (defensive)
    try {
      const startButtons = document.querySelectorAll('#start-workout-btn');
      startButtons.forEach(btn => btn.classList.add('hidden'));
    } catch (e) {
      // ignore
    }
    
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
    
    // Mark as paused (UI state)
    this._isPlaying = false;
    
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
    
    // Set UI state to playing
    this._isPlaying = true;
    
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
    // Reset playing flag
    this._isPlaying = false;
    
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
    if (!this.container) return;
    
    const displayContainer = this.container.querySelector(`#${timerId}-timer-display`);
    if (!displayContainer) return;
    
    const elapsedEl = displayContainer.querySelector('.timer-elapsed');
    const remainingEl = displayContainer.querySelector('.timer-remaining');
    const timerInstance = this.timers && this.timers[timerId] ? this.timers[timerId] : null;
    
    // Determine elapsed and remaining values
    let elapsedMs = 0;
    let remainingMs = null;
    if (timerInstance) {
      if (timerInstance.isCountdown) {
        // data.currentTime is remaining for countdown timers
        remainingMs = data.currentTime;
        elapsedMs = Math.max(0, (timerInstance.duration || 0) - remainingMs);
      } else {
        // count-up timer: data.currentTime is elapsed
        elapsedMs = data.currentTime;
        if (timerInstance.duration && timerInstance.duration > 0) {
          remainingMs = Math.max(0, timerInstance.duration - elapsedMs);
        } else {
          remainingMs = null;
        }
      }
    } else {
      // Fallback: use provided formattedTime for elapsed, leave remaining blank
      if (elapsedEl) elapsedEl.textContent = data.formattedTime || '';
      if (remainingEl) remainingEl.textContent = '';
      return;
    }
    
    // Format using the timer's formatter if available, otherwise basic fallback
    const fmt = (ms) => {
      try {
        return timerInstance.formatTime(ms);
      } catch (e) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    };
    
    if (elapsedEl) {
      elapsedEl.textContent = fmt(elapsedMs);
      elapsedEl.classList.add('timer-elapsed-active');
    }
    
    if (remainingEl) {
      remainingEl.textContent = remainingMs != null ? fmt(remainingMs) : '—';
      // Add a class for red styling
      if (remainingMs != null) remainingEl.classList.add('timer-remaining-active');
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
    const toggleBtn = this.container.querySelector('#play-pause-toggle');
    
    // Hide both first (defensive: check existence)
    if (startBtn) startBtn.classList.add('hidden');
    if (toggleBtn) toggleBtn.classList.add('hidden');
    
    // Show appropriate control
    if (!this.state.isActive) {
      if (startBtn) startBtn.classList.remove('hidden');
    } else {
      const anyRunning = (this.timers.total && this.timers.total.isRunning) ||
                         (this.timers.preparation && this.timers.preparation.isRunning) ||
                         (this.timers.rest && this.timers.rest.isRunning);
      if (toggleBtn) {
        toggleBtn.classList.remove('hidden');
        // Use the UI-controlled _isPlaying flag as the source of truth for the toggle icon.
        {
          const playIcon = toggleBtn.querySelector && toggleBtn.querySelector('.icon-play');
          const pauseIcon = toggleBtn.querySelector && toggleBtn.querySelector('.icon-pause');

          if (this._isPlaying) {
            if (pauseIcon) pauseIcon.style.display = '';
            if (playIcon) playIcon.style.display = 'none';
            toggleBtn.setAttribute('aria-label', 'Pause');
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-primary');
          } else {
            if (pauseIcon) pauseIcon.style.display = 'none';
            if (playIcon) playIcon.style.display = '';
            toggleBtn.setAttribute('aria-label', 'Resume');
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
          }
        }
      }
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
    
    // Update total workout timer to reflect configured total time (in minutes)
    if (this.timers.total) {
      const totalMs = (this.config.totalWorkoutTime || 0) * 60 * 1000;
      this.timers.total.setDuration(totalMs);
      // Ensure total timer is configured as a countdown (shows remaining time)
      this.timers.total.setCountdown(true);
    }
    
    // Update timer display to show remaining time immediately (if UI ready)
    try {
      if (this.timers.total && this.container) {
        // Ensure total display is visible so user sees remaining time from settings
        const totalDisplay = this.container.querySelector('#total-timer-display');
        const preparationDisplay = this.container.querySelector('#preparation-timer-display');
        if (totalDisplay) totalDisplay.classList.remove('hidden');
        if (preparationDisplay) preparationDisplay.classList.add('hidden');
        // Refresh displayed values
        this.updateTimerDisplay('total', this.timers.total.getState());
        this.updateUI();
      }
    } catch (e) {
      // Fail silently if UI not ready yet
      console.warn('Failed to refresh timer UI after setConfig:', e);
    }
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
