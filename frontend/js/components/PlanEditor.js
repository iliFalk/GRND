/**
 * PlanEditor Component
 * Full-screen modal for editing training plan details
 */

import { TrainingPlan } from '../models/TrainingPlan.js';
import { Week } from '../models/Week.js';

export class PlanEditor {
    constructor(container, apiService, navigationService) {
        this.container = container;
        this.apiService = apiService;
        this.navigationService = navigationService;
        this.plan = null;
        this.isLoading = false;
        this.isSaving = false;
        this.error = null;

        this.init();
    }

    init() {
        this.render();
    }

    setPlan(plan) {
        this.plan = plan ? new TrainingPlan(plan) : new TrainingPlan();
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
            const planData = {
                ...this.plan.toJSON(),
                ...formData
            };

            if (this.plan.id) {
                await this.apiService.updateTrainingPlan(this.plan.id, planData);
            } else {
                await this.apiService.createTrainingPlan(planData);
            }

            this.navigationService.navigateTo('plan-list');
        } catch (error) {
            console.error('Failed to save plan:', error);
            this.setSaving(false, 'Failed to save plan. Please try again.');
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
            name: form.querySelector('#plan-name').value,
            description: form.querySelector('#plan-description').value,
            durationWeeks: parseInt(form.querySelector('#plan-duration').value),
            start_date: form.querySelector('#plan-start-date').value
        };
    }

    validateForm(data) {
        if (!data.name.trim()) {
            this.setError('Plan name is required');
            return false;
        }
        if (data.durationWeeks < 1 || data.durationWeeks > 52) {
            this.setError('Duration must be between 1 and 52 weeks');
            return false;
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
        this.container.innerHTML = `
            <div class="plan-editor-overlay">
                <div class="plan-editor-modal">
                    <div class="plan-editor-header">
                        <h2>${this.plan.id ? 'Edit Training Plan' : 'Create New Training Plan'}</h2>
                        <button class="close-btn" title="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
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
                                <input type="text" id="plan-name" value="${this.plan.name || ''}" required>
                            </div>

                            <div class="form-group">
                                <label for="plan-description">Description</label>
                                <textarea id="plan-description" rows="3">${this.plan.description || ''}</textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="plan-duration">Duration (weeks) *</label>
                                    <input type="number" id="plan-duration" value="${this.plan.durationWeeks || 4}"
                                           min="1" max="52" required>
                                    <label for="plan-start-date">Start Date</label>
                                    <input type="date" id="plan-start-date" value="${this.plan.start_date ? new Date(this.plan.start_date).toISOString().split('T')[0] : ''}">
                                </div>

                                <div class="form-group">
                                    <label for="plan-difficulty">Difficulty</label>
                                    <select id="plan-difficulty">
                                        <option value="beginner" ${this.plan.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
                                        <option value="intermediate" ${this.plan.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                                        <option value="advanced" ${this.plan.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="plan-goal">Goal</label>
                                    <input type="text" id="plan-goal" value="${this.plan.goal || ''}" 
                                           placeholder="e.g., Strength, Hypertrophy, Fat Loss">
                                </div>
                            </div>

                            <div class="weeks-section">
                                <div class="weeks-header">
                                    <h3>Weeks</h3>
                                    <button type="button" class="btn-secondary add-week-btn">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                        Add Week
                                    </button>
                                </div>
                                <div class="weeks-list">
                                    ${this.plan.weeks.map((week, index) => this.renderWeek(week, index)).join('')}
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="plan-editor-footer">
                        <button type="button" class="btn-secondary cancel-btn">Cancel</button>
                        <button type="button" class="btn-primary save-btn" ${this.isSaving ? 'disabled' : ''}>
                            ${this.isSaving ? 'Saving...' : 'Save Plan'}
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

        // Add week button
        const addWeekBtn = this.container.querySelector('.add-week-btn');
        addWeekBtn.addEventListener('click', () => this.handleAddWeek());

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
}