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

    handleAddExercise(blockId = null) {
        // Navigate to ExerciseEditor and pass the blockId so the editor can attach the exercise to the correct block
        this.navigationService.navigateTo('exercise-editor', {
            exercise: null,
            day: this.day,
            week: this.week,
            plan: this.plan,
            blockId
        });
    }

    handleEditExercise(exercise, blockId = null) {
        // Pass blockId so ExerciseEditor can update the correct block if needed
        this.navigationService.navigateTo('exercise-editor', {
            exercise,
            day: this.day,
            week: this.week,
            plan: this.plan,
            blockId
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
        const repsText = exercise.reps ? `${exercise.reps} reps` : '';
        const setsText = exercise.sets ? `${exercise.sets} sets` : '';
        const weightText = exercise.weight ? ` • ${exercise.weight}` : '';
        const durationText = exercise.duration ? ` • ${exercise.duration}s` : '';
        return `
            <div class="exercise-item" data-exercise-id="${exercise.id || exercise.exercise_id || ''}">
                <div class="exercise-info">
                    <h4>${exercise.name || exercise.exerciseName || 'Exercise'}</h4>
                    <p>${setsText} ${repsText}${weightText}${durationText}</p>
                </div>
                <div class="exercise-actions">
                    <button class="btn-icon edit-exercise-btn" data-exercise-id="${exercise.id || exercise.exercise_id || ''}" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon remove-exercise-btn" data-exercise-id="${exercise.id || exercise.exercise_id || ''}" title="Remove">
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

    renderBlocks() {
        // Render workout blocks (each block contains exercises)
        if (!this.day || !Array.isArray(this.day.workoutBlocks)) {
            return `
                <div class="empty-exercises">
                    <p>No workout blocks added for this day.</p>
                </div>
            `;
        }

        return this.day.workoutBlocks.map((block, bIndex) => {
            const headerInfo = block.block_type === 'Circuit'
                ? `${block.rounds || block.rounds === 0 ? block.rounds : 3} rounds`
                : block.block_type === 'AMRAP'
                    ? `${block.target_time || 10} min AMRAP`
                    : 'Standard block';

            return `
                <div class="workout-block" data-block-id="${block.block_id}">
                    <div class="block-header">
                        <div class="block-title">
                            <strong>${block.block_type}</strong>
                            <span class="block-info">${headerInfo} • ${block.exercisesCount} exercise${block.exercisesCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="block-actions">
                            <button class="btn-icon edit-block-btn" data-block-id="${block.block_id}" title="Edit Block">Edit</button>
                            <button class="btn-icon remove-block-btn" data-block-id="${block.block_id}" title="Remove Block">Remove</button>
                            <button class="btn-secondary add-exercise-to-block-btn" data-block-id="${block.block_id}">
                                Add Exercise
                            </button>
                        </div>
                    </div>
                    <div class="block-exercises">
                        ${block.exercises.map((ex, exIdx) => this.renderExercise(ex, exIdx)).join('')}
                        ${block.exercises.length === 0 ? `<div class="empty-exercises"><p>No exercises yet</p></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Keep circuit configuration rendering but rely on blocks for actual exercises
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

    render() {
        if (!this.day) {
            this.day = new Day();
        }
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

                            ${this.day.restDay ? '' : this.renderBlocks()}
                            ${!this.day.restDay ? `<div class="block-controls">
                                <button type="button" class="btn-secondary add-block-btn">Add Block</button>
                            </div>` : ''}
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

        // Add exercise to block buttons
        const addToBlockBtns = this.container.querySelectorAll('.add-exercise-to-block-btn');
        addToBlockBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const blockId = e.target.closest('.add-exercise-to-block-btn').dataset.blockId;
                this.handleAddExercise(blockId);
            });
        });

        // Edit exercise buttons (block-aware)
        const editExerciseBtns = this.container.querySelectorAll('.edit-exercise-btn');
        editExerciseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const exerciseId = e.target.closest('.edit-exercise-btn').dataset.exerciseId;
                // find exercise and block containing it
                let foundEx = null;
                let foundBlockId = null;
                this.day.workoutBlocks.forEach(block => {
                    const ex = block.exercises.find(x => (x.id === exerciseId || x.exercise_id === exerciseId));
                    if (ex) {
                        foundEx = ex;
                        foundBlockId = block.block_id;
                    }
                });
                if (foundEx) {
                    this.handleEditExercise(foundEx, foundBlockId);
                }
            });
        });

        // Remove exercise buttons (block-aware)
        const removeExerciseBtns = this.container.querySelectorAll('.remove-exercise-btn');
        removeExerciseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const exerciseId = e.target.closest('.remove-exercise-btn').dataset.exerciseId;
                if (confirm('Are you sure you want to remove this exercise?')) {
                    this.day.removeExercise(exerciseId);
                    this.render();
                }
            });
        });

        // Block-level actions: edit block, remove block, add block
        const editBlockBtns = this.container.querySelectorAll('.edit-block-btn');
        editBlockBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const blockId = e.target.closest('.edit-block-btn').dataset.blockId;
                const block = this.day.workoutBlocks.find(b => b.block_id === blockId);
                // For now, editing a block opens a prompt to change block type/params (simple inline editor)
                const newType = prompt('Enter block type (Standard, Circuit, AMRAP):', block.block_type);
                if (newType) {
                    block.block_type = newType;
                    // circuit/AMRAP params can be edited in a fuller UI later
                    this.render();
                }
            });
        });

        const removeBlockBtns = this.container.querySelectorAll('.remove-block-btn');
        removeBlockBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const blockId = e.target.closest('.remove-block-btn').dataset.blockId;
                if (confirm('Remove this block and all contained exercises?')) {
                    this.day.removeBlock(blockId);
                    this.render();
                }
            });
        });

        const addBlockBtn = this.container.querySelector('.add-block-btn');
        if (addBlockBtn) {
            addBlockBtn.addEventListener('click', () => this.handleAddBlock());
        }

        // Close on overlay click
        const overlay = this.container.querySelector('.day-editor-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.handleCancel();
            }
        });
    }
}
