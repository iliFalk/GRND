/**
 * PlanList Component
 * Displays all training plans with management functionality
 */

import { TrainingPlan } from '../models/TrainingPlan.js';

export class PlanList {
    constructor(container, apiService, navigationService) {
        this.container = container;
        this.apiService = apiService;
        this.navigationService = navigationService;
        this.plans = [];
        this.isLoading = false;
        this.error = null;

        this.init();
    }

    async init() {
        this.render();
        await this.loadPlans();
    }

    async loadPlans() {
        this.setLoading(true, null);
        try {
            const plansData = await this.apiService.getTrainingPlans();
            this.plans = plansData.map(plan => new TrainingPlan(plan));
            this.render();
        } catch (error) {
            console.error('Failed to load plans:', error);
            this.setLoading(false, 'Failed to load training plans. Please try again.');
        }
    }

    setLoading(isLoading, error = null) {
        this.isLoading = isLoading;
        this.error = error;
        this.render();
    }

    showError(message) {
        this.setLoading(false, message);
    }

    handleCreatePlan() {
        this.navigationService.navigateTo('plan-editor');
    }

    handleEditPlan(plan) {
        this.navigationService.navigateTo('plan-editor', { plan });
    }

    async handleDeletePlan(planId) {
        if (confirm('Are you sure you want to delete this plan?')) {
            try {
                await this.apiService.deleteTrainingPlan(planId);
                await this.loadPlans();
            } catch (error) {
                console.error('Failed to delete plan:', error);
                this.showError('Failed to delete plan. Please try again.');
            }
        }
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    renderPlanCard(plan) {
        return `
            <div class="plan-card" data-plan-id="${plan.id}">
                <div class="plan-card-header">
                    <h3>${plan.name}</h3>
                    <div class="plan-actions">
                        <button class="btn-icon edit-btn" data-plan-id="${plan.id}" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete-btn" data-plan-id="${plan.id}" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="plan-description">${plan.description || 'No description provided'}</p>
                <div class="plan-meta">
                    <span class="plan-duration">${plan.durationWeeks} weeks</span>
                    <span class="plan-difficulty">${plan.difficulty}</span>
                    <span class="plan-goal">${plan.goal}</span>
                </div>
                <div class="plan-stats">
                    <span class="stat">
                        <strong>${plan.totalDays}</strong> total days
                    </span>
                    <span class="stat">
                        <strong>${plan.weeks.length}</strong> weeks
                    </span>
                </div>
            </div>
        `;
    }

    render() {
        this.container.innerHTML = `
            <div class="plan-list-container">
                <div class="plan-list-header">
                    <h2>Training Plans</h2>
                    <button class="btn-primary create-plan-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Create New Plan
                    </button>
                </div>

                ${this.error ? `
                    <div class="error-message">
                        ${this.error}
                    </div>
                ` : ''}

                ${this.isLoading ? `
                    <div class="loading-container">
                        <div class="spinner"></div>
                        <p>Loading plans...</p>
                    </div>
                ` : this.plans.length === 0 ? `
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"></path>
                            <path d="M21 11h-4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"></path>
                            <path d="M15 3h-4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"></path>
                        </svg>
                        <h3>No Training Plans</h3>
                        <p>Create your first training plan to get started</p>
                        <button class="btn-primary create-plan-btn-empty">Create Plan</button>
                    </div>
                ` : `
                    <div class="plans-grid">
                        ${this.plans.map(plan => this.renderPlanCard(plan)).join('')}
                    </div>
                `}
            </div>
        `;

        // Add event listeners
        this.addEventListeners();
    }

    addEventListeners() {
        // Create plan buttons
        const createButtons = this.container.querySelectorAll('.create-plan-btn, .create-plan-btn-empty');
        createButtons.forEach(btn => {
            btn.addEventListener('click', () => this.handleCreatePlan());
        });

        // Edit buttons
        const editButtons = this.container.querySelectorAll('.edit-btn');
        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.target.closest('.edit-btn').dataset.planId;
                const plan = this.plans.find(p => p.id === planId);
                if (plan) {
                    this.handleEditPlan(plan);
                }
            });
        });

        // Delete buttons
        const deleteButtons = this.container.querySelectorAll('.delete-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.target.closest('.delete-btn').dataset.planId;
                this.handleDeletePlan(planId);
            });
        });
    }
}