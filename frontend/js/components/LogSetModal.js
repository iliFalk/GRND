/**
 * Log Set Modal Component
 * Allows users to log their set data with pre-filled reps/weight
 */

export class LogSetModal {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onSave = options.onSave || null;
    this.onCancel = options.onCancel || null;
    
    // Set data
    this.setData = {
      exercise: options.exercise || null,
      plannedReps: options.plannedReps || 0,
      plannedWeight: options.plannedWeight || 0,
      actualReps: options.actualReps || options.plannedReps || 0,
      actualWeight: options.actualWeight || options.plannedWeight || 0,
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
    this.modalElement.className = 'modal-overlay log-set-modal hidden';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Log Set</h2>
          <button class="modal-close-btn" id="log-set-close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          ${this.setData.exercise ? `
            <div class="exercise-info">
              <h3>${this.setData.exercise.name}</h3>
              <p>Target: ${this.setData.plannedReps} reps × ${this.setData.plannedWeight} kg</p>
            </div>
          ` : ''}
          
          <div class="form-group">
            <label for="actual-reps">Reps</label>
            <input type="number" id="actual-reps" min="0" max="100" value="${this.setData.actualReps}">
          </div>
          
          <div class="form-group">
            <label for="actual-weight">Weight (kg)</label>
            <input type="number" id="actual-weight" min="0" max="500" step="0.5" value="${this.setData.actualWeight}">
          </div>
          
          <div class="form-group">
            <label for="set-notes">Notes (optional)</label>
            <textarea id="set-notes" rows="3" placeholder="How did this set feel?">${this.setData.notes}</textarea>
          </div>
          
          <div class="quick-buttons">
            <button type="button" class="btn-secondary quick-reps-btn" data-reps="${this.setData.plannedReps}">
              Target Reps (${this.setData.plannedReps})
            </button>
            <button type="button" class="btn-secondary quick-weight-btn" data-weight="${this.setData.plannedWeight}">
              Target Weight (${this.setData.plannedWeight}kg)
            </button>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" id="log-set-cancel-btn">Cancel</button>
          <button class="btn-primary" id="log-set-save-btn">Log Set</button>
        </div>
      </div>
    `;
    
    // Add modal to container
    this.container.appendChild(this.modalElement);
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const closeBtn = this.modalElement.querySelector('#log-set-close-btn');
    const cancelBtn = this.modalElement.querySelector('#log-set-cancel-btn');
    const saveBtn = this.modalElement.querySelector('#log-set-save-btn');
    
    // Close modal when clicking close button
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Close modal when clicking cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
    
    // Save set data when clicking save button
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
        const reps = parseInt(e.target.dataset.reps);
        const repsInput = this.modalElement.querySelector('#actual-reps');
        if (repsInput) {
          repsInput.value = reps;
        }
      });
    });
    
    const quickWeightBtns = this.modalElement.querySelectorAll('.quick-weight-btn');
    quickWeightBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const weight = parseFloat(e.target.dataset.weight);
        const weightInput = this.modalElement.querySelector('#actual-weight');
        if (weightInput) {
          weightInput.value = weight;
        }
      });
    });
    
    // Handle input validation
    const repsInput = this.modalElement.querySelector('#actual-reps');
    const weightInput = this.modalElement.querySelector('#actual-weight');
    
    if (repsInput) {
      repsInput.addEventListener('input', (e) => this.validateRepsInput(e.target));
    }
    
    if (weightInput) {
      weightInput.addEventListener('input', (e) => this.validateWeightInput(e.target));
    }
    
    // Handle Enter key to save
    const inputs = this.modalElement.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.save();
        }
      });
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
  
  open(setData = {}) {
    // Update set data with provided values
    this.setData = { ...this.setData, ...setData };
    
    // Update form values
    const repsInput = this.modalElement.querySelector('#actual-reps');
    const weightInput = this.modalElement.querySelector('#actual-weight');
    const notesInput = this.modalElement.querySelector('#set-notes');
    const exerciseInfo = this.modalElement.querySelector('.exercise-info');
    
    if (repsInput) {
      repsInput.value = this.setData.actualReps;
    }
    
    if (weightInput) {
      weightInput.value = this.setData.actualWeight;
    }
    
    if (notesInput) {
      notesInput.value = this.setData.notes;
    }
    
    // Update exercise info if provided
    if (exerciseInfo && this.setData.exercise) {
      exerciseInfo.innerHTML = `
        <h3>${this.setData.exercise.name}</h3>
        <p>Target: ${this.setData.plannedReps} reps × ${this.setData.plannedWeight} kg</p>
      `;
      
      // Update quick buttons
      const quickRepsBtn = this.modalElement.querySelector('.quick-reps-btn');
      const quickWeightBtn = this.modalElement.querySelector('.quick-weight-btn');
      
      if (quickRepsBtn) {
        quickRepsBtn.textContent = `Target Reps (${this.setData.plannedReps})`;
        quickRepsBtn.dataset.reps = this.setData.plannedReps;
      }
      
      if (quickWeightBtn) {
        quickWeightBtn.textContent = `Target Weight (${this.setData.plannedWeight}kg)`;
        quickWeightBtn.dataset.weight = this.setData.plannedWeight;
      }
    }
    
    // Show modal
    this.modalElement.classList.remove('hidden');
    this.isOpen = true;
    
    // Focus on reps input
    if (repsInput) {
      repsInput.focus();
      repsInput.select();
    }
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
    const repsInput = this.modalElement.querySelector('#actual-reps');
    const weightInput = this.modalElement.querySelector('#actual-weight');
    const notesInput = this.modalElement.querySelector('#set-notes');
    
    // Update set data
    const actualReps = parseInt(repsInput.value) || 0;
    const actualWeight = parseFloat(weightInput.value) || 0;
    const notes = notesInput.value.trim();
    
    // Validate data
    if (actualReps <= 0) {
      alert('Please enter a valid number of reps');
      return;
    }
    
    // Create set data object
    const setData = {
      exercise: this.setData.exercise,
      plannedReps: this.setData.plannedReps,
      plannedWeight: this.setData.plannedWeight,
      actualReps: actualReps,
      actualWeight: actualWeight,
      notes: notes,
      timestamp: Date.now()
    };
    
    // Close modal
    this.modalElement.classList.add('hidden');
    this.isOpen = false;
    
    // Notify listeners
    if (this.onSave) {
      this.onSave(setData);
    }
  }
  
  getSetData() {
    return { ...this.setData };
  }
  
  setSetData(setData) {
    this.setData = { ...this.setData, ...setData };
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