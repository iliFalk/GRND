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

            // Initialize services
            this.api = new ApiService();
            this.imageService = new ImageService();
            this.navigation = new NavigationService();

            // Setup navigation
            this.setupNavigation();

            // Load user data
            await this.loadUserData();

            // Initialize views
            this.initializeViews();

            this.isInitialized = true;
            console.log('GRND App initialized successfully');

        } catch (error) {
            console.error('Failed to initialize GRND App:', error);
            this.showError('Failed to initialize app');
        }
    }

    setupNavigation() {
        // Setup bottom navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.navigation.navigateTo(view);
            });
        });

        // Setup back button for Telegram
        if (this.telegram) {
            this.telegram.onEvent('backButtonClicked', () => {
                this.navigation.goBack();
            });
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

        // Initialize Dashboard component
        this.dashboard = new Dashboard(dashboardView, this.api, this.navigation);
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
        const plansList = document.querySelector('#plans-view .plans-list');
        if (!plansList) return;

        plansList.innerHTML = '';

        plans.forEach(plan => {
            const planCard = document.createElement('div');
            planCard.className = 'plan-card';
            planCard.innerHTML = `
                <h3>${plan.name}</h3>
                <p>${plan.duration} • ${plan.frequency}</p>
                <button class="btn-secondary" onclick="grndApp.viewPlan(${plan.id})">View Plan</button>
            `;
            plansList.appendChild(planCard);
        });
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
            const settings = await this.storage.getItem('settings') || {};
            settings[setting] = value;
            await this.storage.setItem('settings', settings);

            console.log(`Setting ${setting} updated to ${value}`);
        } catch (error) {
            console.error('Failed to update setting:', error);
        }
    }

    viewPlan(planId) {
        this.navigation.navigateTo('plan-detail', { planId });
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