/**
 * Timer Web Worker
 * Provides accurate timing functionality for workout timers
 */

let timerId = null;
let startTime = 0;
let remainingTime = 0;
let isRunning = false;
let duration = 0;
let isCountdown = false;

// Message handler
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
      console.warn(`Unknown message type: ${type}`);
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
  
  // Start the timer loop
  timerId = setInterval(updateTimer, 100); // Update every 100ms for accuracy
  
  sendStatus();
}

function pauseTimer() {
  if (!isRunning) return;
  
  clearInterval(timerId);
  timerId = null;
  
  // Calculate remaining time
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
    
    // Check if timer has completed
    if (currentTime <= 0) {
      clearInterval(timerId);
      timerId = null;
      isRunning = false;
      remainingTime = 0;
      
      // Send completion event
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
  
  // Send update event
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