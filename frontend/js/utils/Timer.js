/**
 * Timer Class
 * Provides timer functionality using Web Workers for accurate timing
 */

export class Timer {
  constructor(options = {}) {
    this.id = options.id || `timer-${Date.now()}`;
    this.name = options.name || '';
    this.duration = options.duration || 0; // in milliseconds
    this.isCountdown = options.isCountdown !== undefined ? options.isCountdown : true;
    this.autoStart = options.autoStart || false;
    
    // Timer state
    this.isRunning = false;
    this.currentTime = this.isCountdown ? this.duration : 0;
    this.startTime = null;
    this.elapsedTime = 0;
    
    // Callbacks
    this.onUpdate = options.onUpdate || null;
    this.onComplete = options.onComplete || null;
    this.onStart = options.onStart || null;
    this.onPause = options.onPause || null;
    this.onReset = options.onReset || null;
    
    // Web Worker
    this.worker = null;
    this.workerUrl = options.workerUrl || null;
    
    // Initialize worker
    this.initWorker();
    
    // Auto-start if requested
    if (this.autoStart) {
      this.start();
    }
  }
  
  initWorker() {
    try {
      // Create worker from URL or inline
      if (this.workerUrl) {
        this.worker = new Worker(this.workerUrl);
      } else {
        // Create inline worker from timerWorker.js content
        const workerCode = `
          ${this.getWorkerCode()}
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);
      }
      
      // Setup message handlers
      this.worker.onmessage = (e) => {
        const { type, payload } = e.data;
        this.handleWorkerMessage(type, payload);
      };
      
      this.worker.onerror = (error) => {
        console.error('Timer worker error:', error);
        this.fallbackToInterval();
      };
      
      // Initialize worker with timer settings
      this.worker.postMessage({
        type: 'SET_DURATION',
        payload: { duration: this.duration }
      });
      
      this.worker.postMessage({
        type: 'SET_COUNTDOWN',
        payload: { isCountdown: this.isCountdown }
      });
      
    } catch (error) {
      console.error('Failed to initialize timer worker:', error);
      this.fallbackToInterval();
    }
  }
  
  getWorkerCode() {
    // Return the worker code as a string
    return `
      let timerId = null;
      let startTime = 0;
      let remainingTime = 0;
      let isRunning = false;
      let duration = 0;
      let isCountdown = false;
      
      self.onmessage = function(e) {
        const { type, payload } = e.data;
        
        switch (type) {
          case 'START':
            startTimer(payload);
            break;
          case 'PAUSE':
            pauseTimer();
            break;
          case 'RESET':
            resetTimer();
            break;
          case 'SET_DURATION':
            setDuration(payload);
            break;
          case 'SET_COUNTDOWN':
            setCountdown(payload);
            break;
          case 'GET_STATUS':
            sendStatus();
            break;
          default:
            console.warn(\`Unknown message type: \${type}\`);
        }
      };
      
      function startTimer(payload) {
        if (isRunning) return;
        
        if (payload) {
          duration = payload.duration || duration;
          isCountdown = payload.isCountdown !== undefined ? payload.isCountdown : isCountdown;
          remainingTime = payload.remainingTime !== undefined ? payload.remainingTime : remainingTime;
        }
        
        if (isCountdown && remainingTime <= 0) {
          remainingTime = duration;
        }
        
        startTime = Date.now();
        isRunning = true;
        
        timerId = setInterval(updateTimer, 100);
        sendStatus();
      }
      
      function pauseTimer() {
        if (!isRunning) return;
        
        clearInterval(timerId);
        timerId = null;
        
        const elapsed = Date.now() - startTime;
        if (isCountdown) {
          remainingTime = Math.max(0, remainingTime - elapsed);
        } else {
          remainingTime += elapsed;
        }
        
        isRunning = false;
        sendStatus();
      }
      
      function resetTimer() {
        clearInterval(timerId);
        timerId = null;
        
        startTime = 0;
        remainingTime = 0;
        isRunning = false;
        
        sendStatus();
      }
      
      function setDuration(payload) {
        duration = payload.duration || 0;
        if (!isRunning) {
          remainingTime = isCountdown ? duration : 0;
        }
        sendStatus();
      }
      
      function setCountdown(payload) {
        isCountdown = payload.isCountdown !== undefined ? payload.isCountdown : isCountdown;
        if (!isRunning) {
          remainingTime = isCountdown ? duration : 0;
        }
        sendStatus();
      }
      
      function updateTimer() {
        if (!isRunning) return;
        
        const elapsed = Date.now() - startTime;
        let currentTime;
        
        if (isCountdown) {
          currentTime = Math.max(0, remainingTime - elapsed);
          
          if (currentTime <= 0) {
            clearInterval(timerId);
            timerId = null;
            isRunning = false;
            remainingTime = 0;
            
            self.postMessage({
              type: 'COMPLETED',
              payload: {
                duration: duration,
                elapsed: elapsed
              }
            });
          }
        } else {
          currentTime = remainingTime + elapsed;
        }
        
        self.postMessage({
          type: 'UPDATE',
          payload: {
            currentTime: currentTime,
            elapsed: elapsed,
            isRunning: isRunning,
            isCountdown: isCountdown
          }
        });
      }
      
      function sendStatus() {
        self.postMessage({
          type: 'STATUS',
          payload: {
            isRunning: isRunning,
            isCountdown: isCountdown,
            duration: duration,
            remainingTime: remainingTime,
            startTime: startTime
          }
        });
      }
    `;
  }
  
  fallbackToInterval() {
    console.warn('Using fallback interval timer');
    this.worker = null;
    this.intervalId = null;
  }
  
  handleWorkerMessage(type, payload) {
    switch (type) {
      case 'UPDATE':
        this.currentTime = payload.currentTime;
        this.elapsedTime = payload.elapsed;
        this.isRunning = payload.isRunning;
        
        if (this.onUpdate) {
          this.onUpdate({
            currentTime: this.currentTime,
            elapsedTime: this.elapsedTime,
            isRunning: this.isRunning,
            formattedTime: this.formatTime(this.currentTime)
          });
        }
        break;
        
      case 'COMPLETED':
        this.isRunning = false;
        this.currentTime = this.isCountdown ? 0 : this.currentTime;
        
        if (this.onComplete) {
          this.onComplete({
            duration: payload.duration,
            elapsedTime: payload.elapsed
          });
        }
        break;
        
      case 'STATUS':
        // Handle status updates if needed
        break;
        
      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  }
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'START',
        payload: {
          duration: this.duration,
          isCountdown: this.isCountdown,
          remainingTime: this.currentTime
        }
      });
    } else {
      // Fallback to interval
      this.intervalId = setInterval(() => this.updateFallback(), 100);
    }
    
    if (this.onStart) {
      this.onStart();
    }
  }
  
  pause() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.worker) {
      this.worker.postMessage({ type: 'PAUSE' });
    } else {
      // Fallback to interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    
    if (this.onPause) {
      this.onPause();
    }
  }
  
  reset() {
    this.isRunning = false;
    this.currentTime = this.isCountdown ? this.duration : 0;
    this.elapsedTime = 0;
    this.startTime = null;
    
    if (this.worker) {
      this.worker.postMessage({ type: 'RESET' });
    } else {
      // Fallback to interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    
    if (this.onReset) {
      this.onReset();
    }
  }
  
  updateFallback() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    this.elapsedTime = now - this.startTime;
    
    if (this.isCountdown) {
      this.currentTime = Math.max(0, this.duration - this.elapsedTime);
      
      if (this.currentTime <= 0) {
        this.isRunning = false;
        this.currentTime = 0;
        
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        
        if (this.onComplete) {
          this.onComplete({
            duration: this.duration,
            elapsedTime: this.elapsedTime
          });
        }
      }
    } else {
      this.currentTime = this.elapsedTime;
    }
    
    if (this.onUpdate) {
      this.onUpdate({
        currentTime: this.currentTime,
        elapsedTime: this.elapsedTime,
        isRunning: this.isRunning,
        formattedTime: this.formatTime(this.currentTime)
      });
    }
  }
  
  setDuration(duration) {
    this.duration = duration;
    
    if (!this.isRunning) {
      this.currentTime = this.isCountdown ? duration : 0;
    }
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'SET_DURATION',
        payload: { duration: duration }
      });
    }
  }
  
  setCountdown(isCountdown) {
    this.isCountdown = isCountdown;
    
    if (!this.isRunning) {
      this.currentTime = isCountdown ? this.duration : 0;
    }
    
    if (this.worker) {
      this.worker.postMessage({
        type: 'SET_COUNTDOWN',
        payload: { isCountdown: isCountdown }
      });
    }
  }
  
  formatTime(timeInMs) {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((timeInMs % 1000) / 10);
    
    if (this.isCountdown) {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // For count-up timers, show minutes:seconds:milliseconds
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
  }
  
  getState() {
    return {
      id: this.id,
      name: this.name,
      isRunning: this.isRunning,
      currentTime: this.currentTime,
      elapsedTime: this.elapsedTime,
      duration: this.duration,
      isCountdown: this.isCountdown,
      formattedTime: this.formatTime(this.currentTime)
    };
  }
  
  destroy() {
    this.reset();
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}