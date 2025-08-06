/**
 * Main Application Class
 * Handles routing, navigation, and app lifecycle
 */

import { NavigationService } from '../services/NavigationService.js';
import { ApiService } from '../services/ApiService.js';
import { ImageService } from '../services/ImageService.js';
import { Dashboard } from './Dashboard.js';
import { WorkoutHistory } from './WorkoutHistory.js';

export class GRNDApp {
    constructor(telegram, storageService) {
        this.telegram = telegram;
        this.storage = storageService;
        this.navigation = null;
        this.api = null;
        this.imageService = null;

        this.currentUser = null;
        this.isInitialized = false;

        // Plan Builder components (handled globally now)
        this.planList = null;
        this.planEditor = null;
        this.dayEditor = null;
        this.exerciseEditor = null;
    }

    async init() {
        try {
            console.log('Initializing GRND App...');

            // Initialize services with error boundaries
            try {
                this.api = new ApiService();
                this.imageService = new ImageService();
                this.navigation = new NavigationService();
                // Initialize navigation so buttons work
                this.navigation.init();
            } catch (serviceError) {
                console.error('Failed to initialize services:', serviceError);
                this.showError('Failed to initialize app services');
                return;
            }

            // Setup navigation with error boundary
            try {
                this.setupNavigation();
            } catch (navError) {
                console.error('Failed to setup navigation:', navError);
                this.showError('Failed to setup navigation');
            }

            // Load user data with error boundary
            try {
                await this.loadUserData();
            } catch (userError) {
                console.error('Failed to load user data:', userError);
                // Continue with default user data
                this.currentUser = {
                    id: 1,
                    firstName: 'Default',
                    lastName: 'User',
                    username: 'defaultuser'
                };
            }

            // Initialize views with error boundary
            try {
                this.initializeViews();
            } catch (viewsError) {
                console.error('Failed to initialize views:', viewsError);
                this.showError('Failed to initialize app views');
            }

            this.isInitialized = true;
            console.log('GRND App initialized successfully');

        } catch (error) {
            console.error('Critical failure initializing GRND App:', error);
            this.showError('Critical error: Failed to initialize app');
            // Set initialized to true to prevent infinite retry loops
            this.isInitialized = true;
        }
    }

    setupNavigation() {
        try {
            // Setup bottom navigation
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    try {
                        const view = e.currentTarget.dataset.view;
                        if (this.navigation && this.navigation.navigateTo) {
                            this.navigation.navigateTo(view);
                        } else {
                            console.error('Navigation service not available');
                        }
                    } catch (navError) {
                        console.error('Navigation click error:', navError);
                    }
                });
            });

            // Setup back button for Telegram
            if (this.telegram) {
                this.telegram.onEvent('backButtonClicked', () => {
                    try {
                        if (this.navigation && this.navigation.goBack) {
                            this.navigation.goBack();
                        }
                    } catch (backError) {
                        console.error('Back button error:', backError);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to setup navigation:', error);
        }
    }

    async loadUserData() {
        try {
            // Get user info from Telegram
            if (this.telegram && this.telegram.initDataUnsafe?.user) {
                this.currentUser = {
                    id: this.telegram.initDataUnsafe.user.id,
                    firstName: this.telegram.initDataUnsafe.user.first_name,
                    lastName: this.telegram.initDataUnsafe.user.last_name,
                    username: this.telegram.initDataUnsafe.user.username,
                    photoUrl: this.telegram.initDataUnsafe.user.photo_url
                };

                // Store user data
                await this.storage.setItem('user', this.currentUser);
            } else {
                // Load from local storage for development
                this.currentUser = await this.storage.getItem('user') || {
                    id: 1,
                    firstName: 'Test',
                    lastName: 'User',
                    username: 'testuser'
                };
            }

            console.log('User loaded:', this.currentUser);
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    initializeViews() {
        // Initialize dashboard
        this.initializeDashboard();

        // Initialize plans view
        this.initializePlansView();

        // Initialize settings view
        this.initializeSettingsView();

        // Initialize workout history view
        this.initializeWorkoutHistoryView();

        // Initialize Plan Builder views
        this.initializePlanBuilderViews();
    }

    initializeDashboard() {
        const dashboardView = document.getElementById('dashboard-view');
        if (!dashboardView) return;

        // Initialize Dashboard component with storage service
        this.dashboard = new Dashboard(dashboardView, this.api, this.navigation, this.storage);
        this.dashboard.init();
    }

    // Removed loadDashboardData, updateTodayWorkout, and updateStats methods
    // These are now handled by the Dashboard component

    initializePlansView() {
        // Load available plans
        this.loadPlans();
    }

    async loadPlans() {
        try {
            if (!this.api) {
                console.error('API service not available');
                this.renderPlans([
                    { id: 1, name: 'Beginner Strength', duration: '4 weeks', frequency: '3 days/week' },
                    { id: 2, name: 'Advanced Muscle', duration: '8 weeks', frequency: '5 days/week' }
                ]);
                return;
            }

            const plans = await this.api.getTrainingPlans();
            this.renderPlans(plans);
        } catch (error) {
            console.error('Failed to load plans:', error);
            // Show mock data for development
            this.renderPlans([
                { id: 1, name: 'Beginner Strength', duration: '4 weeks', frequency: '3 days/week' },
                { id: 2, name: 'Advanced Muscle', duration: '8 weeks', frequency: '5 days/week' }
            ]);
        }
    }

    renderPlans(plans) {
        try {
            const plansList = document.querySelector('#plans-view .plans-list');
            if (!plansList) return;

            plansList.innerHTML = '';

            if (!Array.isArray(plans)) {
                console.error('Invalid plans data:', plans);
                plansList.innerHTML = '<p>No plans available</p>';
                return;
            }

            plans.forEach(plan => {
                try {
                    const planCard = document.createElement('div');
                    planCard.className = 'plan-card';
                    planCard.innerHTML = `
                        <h3>${plan.name || 'Unknown Plan'}</h3>
                        <p>${plan.duration || 'N/A'} • ${plan.frequency || 'N/A'}</p>
                        <button class="btn-secondary" onclick="grndApp.viewPlan(${plan.id || 0})">View Plan</button>
                    `;
                    plansList.appendChild(planCard);
                } catch (cardError) {
                    console.error('Error rendering plan card:', cardError);
                }
            });
        } catch (error) {
            console.error('Failed to render plans:', error);
        }
    }

    initializeSettingsView() {
        // Setup settings toggles
        const toggles = document.querySelectorAll('.toggle input');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const setting = e.target.closest('.setting-item').querySelector('span').textContent;
                this.updateSetting(setting, e.target.checked);
            });
        });
    }

    async updateSetting(setting, value) {
        try {
            if (!this.storage) {
                console.error('Storage service not available');
                return;
            }

            const settings = await this.storage.getItem('settings') || {};
            settings[setting] = value;
            await this.storage.setItem('settings', settings);

            console.log(`Setting ${setting} updated to ${value}`);
        } catch (error) {
            console.error('Failed to update setting:', error);
        }
    }

    viewPlan(planId) {
        try {
            if (!this.navigation || !this.navigation.navigateTo) {
                console.error('Navigation service not available');
                return;
            }
            this.navigation.navigateTo('plan-detail', { planId });
        } catch (error) {
            console.error('Failed to view plan:', error);
        }
    }

    initializePlanBuilderViews() {
        // Plan Builder views are now initialized by NavigationService
    }

    initializeWorkoutHistoryView() {
        // Workout History view is initialized by NavigationService
    }

    showError(message) {
        // Simple error display - can be enhanced with better UI
        alert(message);
    }

    // Public API methods
    getCurrentUser() {
        return this.currentUser;
    }

    isReady() {
        return this.isInitialized;
    }
}