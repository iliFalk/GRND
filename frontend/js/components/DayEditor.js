/**
 * DayEditor Component
 * Full-screen modal for editing day details with Standard/Circuit type selection
 */

import { Day } from '../models/Day.js';
import { Exercise } from '../models/Exercise.js';

export class DayEditor {
    constructor(container, apiService, navigationService) {
        this.container = container;
        this.apiService = apiService;
        this.navigationService = navigationService;
        this.day = null;
        this.week = null;
        this.plan = null;
        this.isLoading = false;
        this.isSaving = false;
        this.error = null;

        this.init();
    }

    init() {
        this.render();
    }

    setDay(day, week, plan) {
        this.day = day ? new Day(day) : new Day();
        this.week = week;
        this.plan = plan;
        this.render();
    }

    async handleSave() {
        if (this.isSaving) return;

        const formData = this.getFormData();
        if (!this.validateForm(formData)) {
            return;
        }

        this.setSaving(true, null);

        try {
            // Update day with form data
            Object.assign(this.day, formData);

            // Navigate back to week editor
            this.navigationService.navigateTo('week-editor', {
                week: this.week,
                plan: this.plan
            });
        } catch (error) {
            console.error('Failed to save day:', error);
            this.setSaving(false, 'Failed to save day. Please try again.');
        }
    }

    handleCancel() {
        this.navigationService.navigateTo('week-editor', {
            week: this.week,
            plan: this.plan
        });
    }

    handleAddExercise() {
        this.navigationService.navigateTo('exercise-editor', {
            exercise: null,
            day: this.day,
            week: this.week,
            plan: this.plan
        });
    }

    handleEditExercise(exercise) {
        this.navigationService.navigateTo('exercise-editor', {
            exercise,
            day: this.day,
            week: this.week,
            plan: this.plan
        });
    }

    handleRemoveExercise(exerciseIndex) {
        if (confirm('Are you sure you want to remove this exercise?')) {
            this.day.exercises.splice(exerciseIndex, 1);
            this.render();
        }
    }

    handleDayTypeChange(type) {
        this.day.type = type;
        this.render();
    }

    getFormData() {
        const form = this.container.querySelector('.day-form');
        const circuitRoundsInput = form.querySelector('#circuit-rounds');
        let circuitRoundsValue = 3; // Default value
        
        if (circuitRoundsInput) {
            const parsedValue = parseInt(circuitRoundsInput.value);
            if (!isNaN(parsedValue)) {
                circuitRoundsValue = parsedValue;
            }
        }
        
        return {
            name: form.querySelector('#day-name').value,
            description: form.querySelector('#day-description').value,
            day_type: form.querySelector('input[name="day-type"]:checked').value,
            circuit_config: {
                target_rounds: circuitRoundsValue,
                circuit_exercises: this.day.exercises.map(ex => ex.id)
            },
            notes: form.querySelector('#day-notes').value
        };
    }

    /**
     * Validates a numeric value with optional min and max constraints
     * @param {string|number} value - The value to validate
     * @param {number} min - Minimum allowed value (optional)
     * @param {number} max - Maximum allowed value (optional)
     * @param {boolean} required - Whether the value is required
     * @returns {Object} - Validation result { isValid: boolean, message: string }
     */
    validateNumericValue(value, min = null, max = null, required = true) {
        // Check if value is required but empty
        if (required && (value === undefined || value === null || value === '')) {
            return { isValid: false, message: 'This field is required' };
        }
        
        // If not required and empty, it's valid
        if (!required && (value === undefined || value === null || value === '')) {
            return { isValid: true, message: '' };
        }
        
        // Convert to number if it's a string
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        // Check if it's a valid number
        if (isNaN(numValue)) {
            return { isValid: false, message: 'Please enter a valid number' };
        }
        
        // Check minimum value
        if (min !== null && numValue < min) {
            return { isValid: false, message: `Value must be at least ${min}` };
        }
        
        // Check maximum value
        if (max !== null && numValue > max) {
            return { isValid: false, message: `Value cannot exceed ${max}` };
        }
        
        return { isValid: true, message: '' };
    }

    validateForm(data) {
        if (!data.name.trim()) {
            this.setError('Day name is required');
            return false;
        }
        
        // Validate circuit rounds if day type is Circuit
        if (data.day_type === 'Circuit') {
            const roundsValidation = this.validateNumericValue(
                data.circuit_config.target_rounds,
                1,
                10,
                true
            );
            
            if (!roundsValidation.isValid) {
                this.setError(`Circuit rounds: ${roundsValidation.message}`);
                return false;
            }
        }
        
        return true;
    }

    setSaving(isSaving, error = null) {
        this.isSaving = isSaving;
        this.error = error;
        this.render();
    }

    setError(message) {
        this.error = message;
        this.render();
    }

    renderExercise(exercise, index) {
        return `
            <div class="exercise-item">
                <div class="exercise-info">
                    <h4>${exercise.name}</h4>
                    <p>${exercise.type} • ${exercise.sets} sets × ${exercise.reps} reps</p>
                </div>
                <div class="exercise-actions">
                    <button class="btn-icon edit-exercise-btn" data-exercise-index="${index}" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon remove-exercise-btn" data-exercise-index="${index}" title="Remove">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    renderCircuitConfiguration() {
        return `
            <div class="circuit-config">
                <h4>Circuit Configuration</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="circuit-rounds">Target Rounds</label>
                        <input type="number" id="circuit-rounds" value="${this.day.circuit_config?.target_rounds || 3}" min="1" max="10">
                    </div>
                </div>
            </div>
        `;
    }

    renderStandardExercises() {
        return `
            <div class="exercises-section">
                <div class="exercises-header">
                    <h4>Exercises</h4>
                    <button type="button" class="btn-secondary add-exercise-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Exercise
                    </button>
                </div>
                <div class="exercises-list">
                    ${this.day.exercises.map((exercise, index) => this.renderExercise(exercise, index)).join('')}
                    ${this.day.exercises.length === 0 ? `
                        <div class="empty-exercises">
                            <p>No exercises added yet</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderCircuitExercises() {
        return `
            ${this.renderCircuitConfiguration()}
            <div class="exercises-section">
                <div class="exercises-header">
                    <h4>Circuit Exercises</h4>
                    <button type="button" class="btn-secondary add-exercise-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Exercise
                    </button>
                </div>
                <div class="exercises-list">
                    ${this.day.exercises.map((exercise, index) => this.renderExercise(exercise, index)).join('')}
                    ${this.day.exercises.length === 0 ? `
                        <div class="empty-exercises">
                            <p>No exercises added to circuit yet</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    render() {
        this.container.innerHTML = `
            <div class="day-editor-overlay">
                <div class="day-editor-modal">
                    <div class="day-editor-header">
                        <h2>Edit Day ${this.day.dayNumber || ''}</h2>
                        <button class="close-btn" title="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div class="day-editor-content">
                        ${this.error ? `
                            <div class="error-message">
                                ${this.error}
                            </div>
                        ` : ''}

                        <form class="day-form">
                            <div class="form-group">
                                <label for="day-name">Day Name *</label>
                                <input type="text" id="day-name" value="${this.day.name || ''}" required>
                            </div>

                            <div class="form-group">
                                <label for="day-description">Description</label>
                                <textarea id="day-description" rows="2">${this.day.description || ''}</textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Day Type</label>
                                    <div class="day-type-selector">
                                        <label class="day-type-option">
                                            <input type="radio" name="day-type" value="Standard" 
                                                   ${this.day.type === 'Standard' ? 'checked' : ''}>
                                            <span class="day-type-label">
                                                <strong>Standard</strong>
                                                <small>Traditional sets and reps</small>
                                            </span>
                                        </label>
                                        <label class="day-type-option">
                                            <input type="radio" name="day-type" value="Circuit" 
                                                   ${this.day.type === 'Circuit' ? 'checked' : ''}>
                                            <span class="day-type-label">
                                                <strong>Circuit</strong>
                                                <small>High-intensity circuit training</small>
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="rest-day" ${this.day.restDay ? 'checked' : ''}>
                                        <span>Rest Day</span>
                                    </label>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="day-notes">Notes</label>
                                <textarea id="day-notes" rows="3" placeholder="Any additional notes for this day...">${this.day.notes || ''}</textarea>
                            </div>

                            ${this.day.restDay ? '' : 
                                (this.day.type === 'Circuit' ? this.renderCircuitExercises() : this.renderStandardExercises())
                            }
                        </form>
                    </div>

                    <div class="day-editor-footer">
                        <button type="button" class="btn-secondary cancel-btn">Cancel</button>
                        <button type="button" class="btn-primary save-btn" ${this.isSaving ? 'disabled' : ''}>
                            ${this.isSaving ? 'Saving...' : 'Save Day'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.addEventListeners();
    }

    addEventListeners() {
        // Close button
        const closeBtn = this.container.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.handleCancel());

        // Cancel button
        const cancelBtn = this.container.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => this.handleCancel());

        // Save button
        const saveBtn = this.container.querySelector('.save-btn');
        saveBtn.addEventListener('click', () => this.handleSave());

        // Day type change
        const dayTypeInputs = this.container.querySelectorAll('input[name="day-type"]');
        dayTypeInputs.forEach(input => {
            input.addEventListener('change', (e) => this.handleDayTypeChange(e.target.value));
        });

        // Rest day toggle
        const restDayCheckbox = this.container.querySelector('#rest-day');
        restDayCheckbox.addEventListener('change', () => this.render());

        // Add exercise button
        const addExerciseBtn = this.container.querySelector('.add-exercise-btn');
        if (addExerciseBtn) {
            addExerciseBtn.addEventListener('click', () => this.handleAddExercise());
        }

        // Edit exercise buttons
        const editExerciseBtns = this.container.querySelectorAll('.edit-exercise-btn');
        editExerciseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.edit-exercise-btn').dataset.exerciseIndex);
                const exercise = this.day.exercises[index];
                this.handleEditExercise(exercise);
            });
        });

        // Remove exercise buttons
        const removeExerciseBtns = this.container.querySelectorAll('.remove-exercise-btn');
        removeExerciseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-exercise-btn').dataset.exerciseIndex);
                this.handleRemoveExercise(index);
            });
        });

        // Close on overlay click
        const overlay = this.container.querySelector('.day-editor-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.handleCancel();
            }
        });
    }
}