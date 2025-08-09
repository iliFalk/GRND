/**
 * Timer Setup Modal Component
 * Allows users to configure timer settings for a workout session
 */

export class TimerSetupModal {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onSave = options.onSave || null;
    this.onCancel = options.onCancel || null;
    
    // Default configuration
    this.config = {
      totalWorkoutTime: 20, // in minutes (changed default)
      preparationTime: 10, // in seconds
      defaultRestTime: 60, // in seconds
      ...options.config
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
    this.modalElement.className = 'modal-overlay timer-setup-modal hidden';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Timer Setup</h2>
          <button class="modal-close-btn" id="timer-setup-close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label for="total-workout-time">Total Workout Time (minutes)</label>
            <input type="number" id="total-workout-time" min="1" max="180" value="${this.config.totalWorkoutTime}">
            <small>Maximum workout duration</small>
          </div>
          
          <div class="form-group">
            <label for="preparation-time">Preparation Time (seconds)</label>
            <input type="number" id="preparation-time" min="5" max="60" value="${this.config.preparationTime}">
            <small>Time to prepare before starting</small>
          </div>
          
          <div class="form-group">
            <label for="default-rest-time">Default Rest Time (seconds)</label>
            <input type="number" id="default-rest-time" min="10" max="300" value="${this.config.defaultRestTime}">
            <small>Rest time between sets/rounds</small>
          </div>
          
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" id="timer-setup-cancel-btn">Cancel</button>
          <button class="btn-primary" id="timer-setup-save-btn">Save & Start Workout</button>
        </div>
      </div>
    `;
    
    // Add modal to container
    this.container.appendChild(this.modalElement);
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const closeBtn = this.modalElement.querySelector('#timer-setup-close-btn');
    const cancelBtn = this.modalElement.querySelector('#timer-setup-cancel-btn');
    const saveBtn = this.modalElement.querySelector('#timer-setup-save-btn');
    
    // Close modal when clicking close button
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Close modal when clicking cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
    
    // Save configuration when clicking save button
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }
    
    // Close modal when clicking outside modal content
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });
    
    // Handle input validation and enable wheel adjustments
    const inputs = this.modalElement.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
      // Keep existing validation on input
      input.addEventListener('input', (e) => this.validateInput(e.target));

      // Allow changing the numeric value with the mouse wheel while hovering.
      // We prevent the default page scroll and increment/decrement using the
      // input's `step`, `min` and `max` attributes.
      input.addEventListener('wheel', (e) => {
        // Prevent page from scrolling when adjusting values
        e.preventDefault();

        const step = parseInt(input.step, 10) || 1;
        const min = (input.min !== '') ? parseInt(input.min, 10) : -Infinity;
        const max = (input.max !== '') ? parseInt(input.max, 10) : Infinity;
        let value = parseInt(input.value, 10);
        if (isNaN(value)) value = 0;

        // Wheel up (deltaY < 0) -> increase, wheel down -> decrease
        if (e.deltaY < 0) value += step;
        else value -= step;

        // Clamp to min/max
        if (value < min) value = min;
        if (value > max) value = max;

        // Update input and trigger validation + input event listeners
        input.value = value;
        // Trigger the input event so other listeners react (and validate)
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, { passive: false });
    });
  }
  
  validateInput(input) {
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < min) {
      input.value = min;
    } else if (value > max) {
      input.value = max;
    }
  }
  
  open(config = {}) {
    // Update configuration with provided values
    this.config = { ...this.config, ...config };
    
    // Update form values
    const totalWorkoutTimeInput = this.modalElement.querySelector('#total-workout-time');
    const preparationTimeInput = this.modalElement.querySelector('#preparation-time');
    const defaultRestTimeInput = this.modalElement.querySelector('#default-rest-time');
    
    if (totalWorkoutTimeInput) {
      totalWorkoutTimeInput.value = this.config.totalWorkoutTime;
    }
    
    if (preparationTimeInput) {
      preparationTimeInput.value = this.config.preparationTime;
    }
    
    if (defaultRestTimeInput) {
      defaultRestTimeInput.value = this.config.defaultRestTime;
    }
    
    // Show modal
    this.modalElement.classList.remove('hidden');
    this.isOpen = true;
    
    // Focus on first input
    if (totalWorkoutTimeInput) {
      totalWorkoutTimeInput.focus();
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
    const totalWorkoutTimeInput = this.modalElement.querySelector('#total-workout-time');
    const preparationTimeInput = this.modalElement.querySelector('#preparation-time');
    const defaultRestTimeInput = this.modalElement.querySelector('#default-rest-time');
    
    // Update configuration
    this.config.totalWorkoutTime = parseInt(totalWorkoutTimeInput.value);
    this.config.preparationTime = parseInt(preparationTimeInput.value);
    this.config.defaultRestTime = parseInt(defaultRestTimeInput.value);
    
    // Close modal
    this.modalElement.classList.add('hidden');
    this.isOpen = false;
    
    // Notify listeners
    if (this.onSave) {
      this.onSave(this.config);
    }
  }
  
  getConfig() {
    return { ...this.config };
  }
  
  setConfig(config) {
    this.config = { ...this.config, ...config };
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
