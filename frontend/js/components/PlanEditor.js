/**
 * PlanEditor Component
 * Full-screen modal for editing training plan details
 */

import { TrainingPlan } from '../models/TrainingPlan.js';
import { Week } from '../models/Week.js';
import { Day } from '../models/Day.js';
import { Workout } from '../models/Workout.js';

export class PlanEditor {
    constructor(container, apiService, navigationService) {
        this.container = container;
        this.apiService = apiService;
        this.navigationService = navigationService;
        this.plan = null;
        this.isLoading = false;
        this.isSaving = false;
        this.error = null;

        console.log('PlanEditor constructor called with container:', container);
        console.log('API service available:', !!apiService);
        console.log('Navigation service available:', !!navigationService);

        // Don't call init() automatically - let it be called explicitly
    }

    init() {
        console.log('PlanEditor init() called');
        this.render();
    }

    setPlan(plan) {
        console.log('PlanEditor setPlan called with:', plan);
        
        // If plan is null or undefined, create a new empty plan
        if (!plan) {
            this.plan = new TrainingPlan();
            console.log('Created new empty plan');
        } else {
            // If plan is provided, create a new TrainingPlan object from it
            this.plan = new TrainingPlan(plan);
            console.log('Set existing plan:', this.plan);
        }
        
        this.render();
    }

    async handleSave() {
        if (this.isSaving) return;

        // Ensure plan exists
        if (!this.plan) {
            this.plan = new TrainingPlan();
        }

        const formData = this.getFormData();
        if (!this.validateForm(formData)) {
            return;
        }

        this.setSaving(true, null);

        try {
            // Build a canonical weeks/days skeleton according to durationWeeks
            const duration = Number.isInteger(formData.durationWeeks) ? formData.durationWeeks : 4;
            const existingWeeks = (this.plan && this.plan.weeks && this.plan.weeks.length > 0) ? this.plan.weeks : [];

            // If reducing duration, confirm destructive deletion of out-of-range weeks
            if (this.plan && this.plan.weeks && this.plan.weeks.length > duration) {
                const from = duration + 1;
                const to = this.plan.weeks.length;
                if (!confirm(`Changing the duration to ${duration} weeks will permanently delete Week ${from} to Week ${to} and all of their workouts. Are you sure you want to continue?`)) {
                    // user cancelled - stop save
                    this.setSaving(false, null);
                    return;
                }
                // Truncate existingWeeks to the new duration
                existingWeeks.length = duration;
            }

            // Generate or normalize weeks array to match requested duration
            const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const weeksSkeleton = [];

            // Use existing weeks where possible (preserve user data), otherwise create new weeks
            for (let i = 0; i < duration; i++) {
                const weekNumber = i + 1;
                let week = existingWeeks[i];
                if (week) {
                    // Ensure week.weekNumber is accurate
                    week.weekNumber = weekNumber;
                    week.name = week.name || `Week ${weekNumber}`;
                    weeksSkeleton.push(week);
                    continue;
                }

                // Create new week with 7 default days (Rest)
                const newDays = daysOfWeek.map((dow, idx) => ({
                    day_id: `day-${weekNumber}-${idx + 1}-${Date.now()}`,
                    week_id: `week-${Date.now()}-${weekNumber}`,
                    day_name: dow,
                    day_of_week: dow,
                    day_type: 'Rest',
                    workoutBlocks: []
                }));

                const newWeek = new Week({
                    weekNumber,
                    name: `Week ${weekNumber}`,
                    days: newDays
                });

                weeksSkeleton.push(newWeek);
            }

            // Create plan data structure according to README requirements (client-side shape)
            const planData = {
                plan_id: this.plan.plan_id || this.plan.id || `plan-${Date.now()}`,
                plan_name: formData.plan_name,
                name: formData.plan_name, // Keep for backward compatibility
                description: formData.description,
                plan_type: formData.plan_type,
                start_date: formData.start_date || new Date().toISOString(),
                weeks: weeksSkeleton,
                durationWeeks: duration,
                createdAt: this.plan.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Server-facing payload for POST /api/training-plans (minimal fields)
            const serverPayload = {
                name: formData.plan_name,
                description: formData.description,
                startDate: formData.start_date || new Date().toISOString(),
                durationWeeks: duration
            };

            // Send to backend. Use the new /training-plans endpoint for creation and
            // consume the returned created plan (which includes generated weeks/days).
            if (this.plan && this.plan.id) {
                // Update flow - attempt to call the update endpoint. If the server does not
                // implement PUT yet, this will surface an error which will be handled by catch.
                const updated = await this.apiService.updateTrainingPlan(this.plan.id, serverPayload);
                // If API returned an updated plan object, use it; otherwise fall back to client planData
                this.plan = new TrainingPlan(updated && typeof updated === 'object' ? updated : planData);
                this.showSuccessMessage('Plan updated successfully.');
            } else {
                const createdPlan = await this.apiService.createTrainingPlan(serverPayload);
                // API returns the created plan with weeks/days; update local plan model from that.
                this.plan = new TrainingPlan(createdPlan);
                this.showSuccessMessage('Plan created successfully! You can now add weeks and exercises.');
            }

            this.setSaving(false, null);

            // After creating/updating, open the Day Editor for the first day so user can add exercises
            const firstWeek = this.plan.weeks && this.plan.weeks.length > 0 ? this.plan.weeks[0] : null;
            const firstDay = firstWeek && firstWeek.days && firstWeek.days.length > 0 ? firstWeek.days[0] : null;

            // If a first day exists, navigate to DayEditor for immediate editing.
            if (firstDay && this.navigationService && typeof this.navigationService.navigateTo === 'function') {
                // Use the DayEditor route which expects (day, week, plan)
                this.navigationService.navigateTo('day-editor', { day: firstDay, week: firstWeek, plan: this.plan });
                // No explicit render required as navigation will initialize DayEditor view
            } else {
                // Otherwise, stay in the plan editor and re-render so user can add weeks
                this.render();
            }

        } catch (error) {
            console.error('Failed to save plan:', error);
            let errorMsg = 'Failed to save plan. Please try again.';
            if (error && error.message) {
                errorMsg += `\n${error.message}`;
            }
            if (error && error.response && error.response.data) {
                errorMsg += `\n${JSON.stringify(error.response.data)}`;
            }
            this.setSaving(false, errorMsg);
        }
    }

    async handleDuplicatePlan() {
        if (!this.plan || !this.plan.id) return;

        const duplicateName = prompt('Enter a name for the duplicated plan:', `${this.plan.plan_name || this.plan.name} (Copy)`);
        
        if (!duplicateName || !duplicateName.trim()) {
            return; // User cancelled or entered empty name
        }

        this.setSaving(true, null);

        try {
            // Create a copy of the current plan with new name and ID
            const duplicateData = {
                ...this.plan.toJSON(),
                plan_id: `plan-${Date.now()}`,
                plan_name: duplicateName.trim(),
                name: duplicateName.trim(),
                start_date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Remove the original ID to ensure it's treated as a new plan
            delete duplicateData.id;

            const duplicatedPlan = await this.apiService.createTrainingPlan(duplicateData);
            
            this.setSaving(false, null);
            
            // Show success message and navigate to the duplicated plan
            this.showSuccessMessage(`Plan "${duplicateName}" created successfully!`);
            
            // Navigate to the duplicated plan in the editor
            setTimeout(() => {
                this.navigationService.navigateTo('plan-editor', { plan: duplicatedPlan });
            }, 1000);

        } catch (error) {
            console.error('Failed to duplicate plan:', error);
            this.setSaving(false, 'Failed to duplicate plan. Please try again.');
        }
    }

    async handleDeletePlan() {
        if (!this.plan) return;
        const planId = this.plan.id || this.plan.plan_id;
        if (!planId) return;

        if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
            return;
        }

        this.setSaving(true, null);

        try {
            await this.apiService.deleteTrainingPlan(planId);
            this.setSaving(false, null);

            // Show a quick success message
            this.showSuccessMessage('Plan deleted successfully.');

            // Navigate back to plan list
            if (this.navigationService && typeof this.navigationService.navigateTo === 'function') {
                // Slight delay so user sees success message
                setTimeout(() => {
                    this.navigationService.navigateTo('plan-list');
                }, 600);
            }
        } catch (error) {
            console.error('Failed to delete plan:', error);
            let errorMsg = 'Failed to delete plan. Please try again.';
            if (error && error.message) {
                errorMsg += `\n${error.message}`;
            }
            this.setSaving(false, errorMsg);
        }
    }

    showSuccessMessage(message) {
        // Create and show a success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <div class="success-content">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>${message}</span>
            </div>
        `;
        
        // Insert after the header
        const header = this.container.querySelector('.plan-editor-header');
        if (header) {
            header.parentNode.insertBefore(successDiv, header.nextSibling);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.parentNode.removeChild(successDiv);
                }
            }, 3000);
        }
    }

    handleCancel() {
        this.navigationService.navigateTo('plan-list');
    }

    handleAddWeek() {
        const newWeekNumber = this.plan.weeks.length + 1;
        const newWeek = new Week({
            weekNumber: newWeekNumber,
            name: `Week ${newWeekNumber}`
        });
        this.plan.weeks.push(newWeek);
        this.render();
    }

    handleRemoveWeek(index) {
        if (this.plan.weeks.length > 1) {
            this.plan.weeks.splice(index, 1);
            // Re-number weeks
            this.plan.weeks.forEach((week, i) => {
                week.weekNumber = i + 1;
                week.name = `Week ${i + 1}`;
            });
            this.render();
        }
    }

    handleEditWeek(week) {
        // Navigate to week editor (will be implemented later)
        console.log('Edit week:', week);
    }

    getFormData() {
        const form = this.container.querySelector('.plan-form');
        return {
            plan_name: form.querySelector('#plan-name').value,
            name: form.querySelector('#plan-name').value, // Keep for backward compatibility
            description: form.querySelector('#plan-description').value,
            plan_type: form.querySelector('#plan-type').value,
            durationWeeks: parseInt(form.querySelector('#plan-duration').value) || 4,
            start_date: form.querySelector('#plan-start-date').value || null,
            default_workout_color: form.querySelector('#plan-default-workout-color').value
        };
    }

    /**
     * Validate form data without producing side effects.
     * Returns an object { valid: boolean, errors: { field: message } }
     */
    validateFormData(data) {
        const errors = {};

        if (!data.plan_name || !data.plan_name.trim()) {
            errors.plan_name = 'Plan name is required';
        }

        if (!data.plan_type || (data.plan_type !== 'STANDARD' && data.plan_type !== 'CIRCUIT')) {
            errors.plan_type = 'Plan type is required';
        }

        // durationWeeks must be integer between 1 and 52
        const duration = parseInt(data.durationWeeks, 10);
        if (!Number.isInteger(duration) || duration < 1 || duration > 52) {
            errors.durationWeeks = 'Duration must be an integer between 1 and 52';
        }

        // If start_date is provided, it must not be in the past
        if (data.start_date) {
            const start = new Date(data.start_date);
            if (isNaN(start.getTime())) {
                errors.start_date = 'Start date is invalid';
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                start.setHours(0, 0, 0, 0);
                if (start < today) {
                    errors.start_date = 'Start date cannot be in the past';
                }
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }

    validateForm(data) {
        // Backwards-compatible wrapper used by handleSave that sets visible error
        const result = this.validateFormData(data);
        if (!result.valid) {
            // Show first error message
            const firstKey = Object.keys(result.errors)[0];
            this.setError(result.errors[firstKey]);
            return false;
        }
        // Clear any previous error
        this.setError(null);
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

    renderWeek(week, index) {
        return `
            <div class="week-item">
                <div class="week-header">
                    <h4>${week.name}</h4>
                    <div class="week-actions">
                        <button class="btn-icon edit-week-btn" data-week-index="${index}" title="Edit Week">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon remove-week-btn ${this.plan.weeks.length === 1 ? 'disabled' : ''}" 
                                data-week-index="${index}" 
                                ${this.plan.weeks.length === 1 ? 'disabled' : ''}
                                title="Remove Week">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="week-description">${week.description || 'No description'}</p>
                <div class="week-stats">
                    <span>${week.days.length} days</span>
                    <span>${week.totalExercises} exercises</span>
                </div>
            </div>
        `;
    }

    render() {
        // Ensure plan exists, create empty one if null
        if (!this.plan) {
            this.plan = new TrainingPlan();
        }
        const plan = this.plan || {};
        this.container.innerHTML = `
            <div class="plan-editor-overlay">
                <div class="plan-editor-modal">
                    <div class="plan-editor-header">
                        <h2>${plan.id ? 'Edit Training Plan' : 'Create New Training Plan'}</h2>
                        <div class="header-actions">
                            ${plan.id ? `
                                <button class="btn-danger delete-btn" title="Delete Plan">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 6h18"></path>
                                        <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"></path>
                                        <path d="M10 11v6"></path>
                                        <path d="M14 11v6"></path>
                                    </svg>
                                    Delete
                                </button>
                                <button class="btn-secondary duplicate-btn" title="Duplicate Plan">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Duplicate
                                </button>
                            ` : ''}
                            <button class="close-btn" title="Close">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="plan-editor-content">
                        ${this.error ? `
                            <div class="error-message">
                                ${this.error}
                            </div>
                        ` : ''}

                        <form class="plan-form">
                            <div class="form-group">
                                <label for="plan-name">Plan Name *</label>
                                <input type="text" id="plan-name" value="${plan.plan_name || plan.name || ''}" 
                                       placeholder="Enter plan name" required>
                            </div>

                            <div class="form-group">
                                <label for="plan-type">Plan Type *</label>
                                <select id="plan-type" required>
                                    <option value="">Select plan type</option>
                                    <option value="STANDARD" ${plan.plan_type === 'STANDARD' ? 'selected' : ''}>
                                        Standard (Sets & Reps)
                                    </option>
                                    <option value="CIRCUIT" ${plan.plan_type === 'CIRCUIT' ? 'selected' : ''}>
                                        Circuit (Rounds)
                                    </option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="plan-description">Description</label>
                                <textarea id="plan-description" rows="3" 
                                          placeholder="Describe your training plan...">${plan.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="plan-default-workout-color">Default Workout Color</label>
                                <input type="color" id="plan-default-workout-color" value="${plan.default_workout_color || '#0085E0'}">
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="plan-duration">Duration (weeks)</label>
                                    <input type="number" id="plan-duration" value="${plan.durationWeeks || 4}"
                                           min="1" max="52" placeholder="4">
                                </div>

                                <div class="form-group">
                                    <label for="plan-start-date">Start Date (Optional)</label>
                                    <input type="date" id="plan-start-date" 
                                           value="${plan.start_date ? new Date(plan.start_date).toISOString().split('T')[0] : ''}"
                                           placeholder="Set start date">
                                </div>
                            </div>

                            <div class="plan-info">
                                <p><strong>Note:</strong> After creating the plan, you can add weeks and customize exercises.</p>
                            </div>
                        </form>
                    </div>

                    <div class="plan-editor-footer">
                        <button type="button" class="btn-secondary add-week-btn">Add Week</button>
                        <button type="button" class="btn-secondary cancel-btn">Cancel</button>
                        <button type="button" class="btn-primary save-btn" ${this.isSaving ? 'disabled' : ''}>
                            ${this.isSaving ? 'Saving...' : (plan.id ? 'Update Plan' : 'Create Plan')}
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

        // Duplicate and delete buttons (only for existing plans)
        const duplicateBtn = this.container.querySelector('.duplicate-btn');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => this.handleDuplicatePlan());
        }

        const deleteBtn = this.container.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeletePlan());
        }

        // Add week button
        const addWeekBtn = this.container.querySelector('.add-week-btn');
        if (addWeekBtn) {
            addWeekBtn.addEventListener('click', () => this.handleAddWeek());
        }

        // Remove week buttons
        const removeWeekBtns = this.container.querySelectorAll('.remove-week-btn:not(.disabled)');
        removeWeekBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-week-btn').dataset.weekIndex);
                this.handleRemoveWeek(index);
            });
        });

        // Edit week buttons
        const editWeekBtns = this.container.querySelectorAll('.edit-week-btn');
        editWeekBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.edit-week-btn').dataset.weekIndex);
                const week = this.plan.weeks[index];
                this.navigationService.navigateTo('week-editor', { week, plan: this.plan });
            });
        });

        // Close on overlay click
        const overlay = this.container.querySelector('.plan-editor-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.handleCancel();
            }
        });
    }

    applyDefaultColorToNewWorkout(workout) {
        if (!workout) return null;
        if (this.plan && typeof this.plan.applyDefaultColorToNewWorkout === 'function') {
            return this.plan.applyDefaultColorToNewWorkout(workout);
        }
        return workout;
    }

    createNewWorkoutForPlan(data) {
        const w = new Workout(data);
        return this.applyDefaultColorToNewWorkout(w);
    }
}
