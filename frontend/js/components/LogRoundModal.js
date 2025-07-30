/**
 * Log Round Modal Component
 * Allows users to log their round data for circuit training with fields for all exercises
 */

export class LogRoundModal {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onSave = options.onSave || null;
    this.onCancel = options.onCancel || null;
    
    // Round data
    this.roundData = {
      exercises: options.exercises || [],
      roundNumber: options.roundNumber || 1,
      notes: options.notes || ''
    };
    
    // Modal state
    this.isOpen = false;
    this.modalElement = null;
    
    // Create modal element
    this.createModal();
  }
  
  createModal() {
    // Create modal container
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal-overlay log-round-modal hidden';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Log Round ${this.roundData.roundNumber}</h2>
          <button class="modal-close-btn" id="log-round-close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="round-info">
            <p>Complete the data for each exercise in this round:</p>
          </div>
          
          <div class="exercises-list" id="round-exercises-list">
            ${this.renderExercisesList()}
          </div>
          
          <div class="form-group">
            <label for="round-notes">Round Notes (optional)</label>
            <textarea id="round-notes" rows="3" placeholder="How did this round feel?">${this.roundData.notes}</textarea>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" id="log-round-cancel-btn">Cancel</button>
          <button class="btn-primary" id="log-round-save-btn">Log Round</button>
        </div>
      </div>
    `;
    
    // Add modal to container
    this.container.appendChild(this.modalElement);
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  renderExercisesList() {
    if (!this.roundData.exercises || this.roundData.exercises.length === 0) {
      return '<p>No exercises found for this round.</p>';
    }
    
    return this.roundData.exercises.map((exercise, index) => `
      <div class="exercise-round-item" data-exercise-index="${index}">
        <h4>${exercise.name}</h4>
        <div class="exercise-target">
          <small>Target: ${exercise.reps || 0} reps × ${exercise.weight || 0} kg</small>
        </div>
        <div class="exercise-inputs">
          <div class="input-group">
            <label for="round-exercise-reps-${index}">Reps</label>
            <input type="number" id="round-exercise-reps-${index}" min="0" max="100" value="${exercise.actualReps || exercise.reps || 0}">
          </div>
          <div class="input-group">
            <label for="round-exercise-weight-${index}">Weight (kg)</label>
            <input type="number" id="round-exercise-weight-${index}" min="0" max="500" step="0.5" value="${exercise.actualWeight || exercise.weight || 0}">
          </div>
          <div class="quick-buttons">
            <button type="button" class="btn-secondary quick-reps-btn" data-exercise-index="${index}" data-reps="${exercise.reps || 0}">
              Target
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  setupEventListeners() {
    const closeBtn = this.modalElement.querySelector('#log-round-close-btn');
    const cancelBtn = this.modalElement.querySelector('#log-round-cancel-btn');
    const saveBtn = this.modalElement.querySelector('#log-round-save-btn');
    
    // Close modal when clicking close button
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Close modal when clicking cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
    
    // Save round data when clicking save button
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }
    
    // Close modal when clicking outside modal content
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });
    
    // Handle quick buttons
    const quickRepsBtns = this.modalElement.querySelectorAll('.quick-reps-btn');
    quickRepsBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const exerciseIndex = parseInt(e.target.dataset.exerciseIndex);
        const reps = parseInt(e.target.dataset.reps);
        const repsInput = this.modalElement.querySelector(`#round-exercise-reps-${exerciseIndex}`);
        if (repsInput) {
          repsInput.value = reps;
        }
      });
    });
    
    // Handle input validation
    const repsInputs = this.modalElement.querySelectorAll('input[id^="round-exercise-reps-"]');
    const weightInputs = this.modalElement.querySelectorAll('input[id^="round-exercise-weight-"]');
    
    repsInputs.forEach(input => {
      input.addEventListener('input', (e) => this.validateRepsInput(e.target));
    });
    
    weightInputs.forEach(input => {
      input.addEventListener('input', (e) => this.validateWeightInput(e.target));
    });
  }
  
  validateRepsInput(input) {
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < min) {
      input.value = min;
    } else if (value > max) {
      input.value = max;
    }
  }
  
  validateWeightInput(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const value = parseFloat(input.value);
    
    if (isNaN(value) || value < min) {
      input.value = min;
    } else if (value > max) {
      input.value = max;
    }
  }
  
  open(roundData = {}) {
    // Update round data with provided values
    this.roundData = { ...this.roundData, ...roundData };
    
    // Update modal title
    const titleElement = this.modalElement.querySelector('.modal-header h2');
    if (titleElement) {
      titleElement.textContent = `Log Round ${this.roundData.roundNumber}`;
    }
    
    // Update exercises list
    const exercisesList = this.modalElement.querySelector('#round-exercises-list');
    if (exercisesList) {
      exercisesList.innerHTML = this.renderExercisesList();
      
      // Re-setup event listeners for the new elements
      this.setupExerciseEventListeners();
    }
    
    // Update notes
    const notesInput = this.modalElement.querySelector('#round-notes');
    if (notesInput) {
      notesInput.value = this.roundData.notes;
    }
    
    // Show modal
    this.modalElement.classList.remove('hidden');
    this.isOpen = true;
    
    // Focus on first input
    const firstRepsInput = this.modalElement.querySelector('input[id^="round-exercise-reps-"]');
    if (firstRepsInput) {
      firstRepsInput.focus();
      firstRepsInput.select();
    }
  }
  
  setupExerciseEventListeners() {
    // Handle quick buttons
    const quickRepsBtns = this.modalElement.querySelectorAll('.quick-reps-btn');
    quickRepsBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const exerciseIndex = parseInt(e.target.dataset.exerciseIndex);
        const reps = parseInt(e.target.dataset.reps);
        const repsInput = this.modalElement.querySelector(`#round-exercise-reps-${exerciseIndex}`);
        if (repsInput) {
          repsInput.value = reps;
        }
      });
    });
    
    // Handle input validation
    const repsInputs = this.modalElement.querySelectorAll('input[id^="round-exercise-reps-"]');
    const weightInputs = this.modalElement.querySelectorAll('input[id^="round-exercise-weight-"]');
    
    repsInputs.forEach(input => {
      input.addEventListener('input', (e) => this.validateRepsInput(e.target));
    });
    
    weightInputs.forEach(input => {
      input.addEventListener('input', (e) => this.validateWeightInput(e.target));
    });
  }
  
  close() {
    // Hide modal
    this.modalElement.classList.add('hidden');
    this.isOpen = false;
    
    // Notify listeners
    if (this.onCancel) {
      this.onCancel();
    }
  }
  
  save() {
    // Get form values
    const notesInput = this.modalElement.querySelector('#round-notes');
    const notes = notesInput.value.trim();
    
    // Collect exercise data
    const exercisesData = [];
    let hasValidData = false;
    
    this.roundData.exercises.forEach((exercise, index) => {
      const repsInput = this.modalElement.querySelector(`#round-exercise-reps-${index}`);
      const weightInput = this.modalElement.querySelector(`#round-exercise-weight-${index}`);
      
      const actualReps = parseInt(repsInput.value) || 0;
      const actualWeight = parseFloat(weightInput.value) || 0;
      
      exercisesData.push({
        exercise: exercise,
        plannedReps: exercise.reps || 0,
        plannedWeight: exercise.weight || 0,
        actualReps: actualReps,
        actualWeight: actualWeight
      });
      
      // Check if at least one exercise has valid data
      if (actualReps > 0) {
        hasValidData = true;
      }
    });
    
    // Validate data
    if (!hasValidData) {
      alert('Please enter valid data for at least one exercise');
      return;
    }
    
    // Create round data object
    const roundData = {
      roundNumber: this.roundData.roundNumber,
      exercises: exercisesData,
      notes: notes,
      timestamp: Date.now()
    };
    
    // Close modal
    this.modalElement.classList.add('hidden');
    this.isOpen = false;
    
    // Notify listeners
    if (this.onSave) {
      this.onSave(roundData);
    }
  }
  
  getRoundData() {
    return { ...this.roundData };
  }
  
  setRoundData(roundData) {
    this.roundData = { ...this.roundData, ...roundData };
  }
  
  destroy() {
    // Remove modal from DOM
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.parentNode.removeChild(this.modalElement);
    }
    
    // Clear references
    this.modalElement = null;
    this.container = null;
    this.onSave = null;
    this.onCancel = null;
  }
}