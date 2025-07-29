/**
 * NavigationService
 * Handles app navigation and routing between views
 */

export class NavigationService {
    constructor() {
        this.currentView = 'dashboard';
        this.viewHistory = [];
        this.views = new Map();
    }

    init() {
        // Setup navigation listeners
        this.setupNavigationListeners();

        // Set initial view
        this.navigateTo('dashboard');
    }

    setupNavigationListeners() {
        // Handle browser back button
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view) {
                this.showView(event.state.view, event.state.params);
            }
        });
    }

    navigateTo(viewName, params = {}) {
        console.log(`Navigating to: ${viewName}`, params);

        // Save current view to history
        if (this.currentView !== viewName) {
            this.viewHistory.push({
                view: this.currentView,
                params: this.getCurrentParams()
            });
        }

        // Update URL state
        const url = `#${viewName}`;
        window.history.pushState({ view: viewName, params }, '', url);

        // Show the view
        this.showView(viewName, params);
    }

    showView(viewName, params = {}) {
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;

            // Update navigation state
            this.updateNavigationState(viewName);

            // Trigger view-specific initialization
            this.initializeView(viewName, params);
        } else {
            console.error(`View ${viewName} not found`);
        }
    }

    updateNavigationState(viewName) {
        // Update bottom navigation active state
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });
    }

    initializeView(viewName, params) {
        // Trigger custom events for view initialization
        const event = new CustomEvent('viewInitialized', {
            detail: { view: viewName, params }
        });
        document.dispatchEvent(event);

        // Initialize specific components
        if (viewName === 'plan-list') {
            // Initialize PlanList component
            const planListContainer = document.getElementById('plan-list-view');
            if (planListContainer) {
                const planList = new window.PlanList(planListContainer, window.grndApp.api, this);
            }
        } else if (viewName === 'plan-editor') {
            // Initialize PlanEditor component
            const planEditorContainer = document.getElementById('plan-editor-view');
            if (planEditorContainer) {
                const planEditor = new window.PlanEditor(planEditorContainer, window.grndApp.api, this);
                if (params.plan) {
                    planEditor.setPlan(params.plan);
                }
            }
        } else if (viewName === 'day-editor') {
            // Initialize DayEditor component
            const dayEditorContainer = document.getElementById('day-editor-view');
            if (dayEditorContainer) {
                const dayEditor = new window.DayEditor(dayEditorContainer, window.grndApp.api, this);
                if (params.day && params.week && params.plan) {
                    dayEditor.setDay(params.day, params.week, params.plan);
                }
            }
        } else if (viewName === 'exercise-editor') {
            // Initialize ExerciseEditor component
            const exerciseEditorContainer = document.getElementById('exercise-editor-view');
            if (exerciseEditorContainer) {
                const exerciseEditor = new window.ExerciseEditor(exerciseEditorContainer, window.grndApp.api, this);
                if (params.exercise && params.day && params.week && params.plan) {
                    exerciseEditor.setExercise(params.exercise, params.day, params.week, params.plan);
                }
            }
        }
    }

    goBack() {
        if (this.viewHistory.length > 0) {
            const previous = this.viewHistory.pop();
            this.showView(previous.view, previous.params);

            // Update URL
            window.history.replaceState(
                { view: previous.view, params: previous.params },
                '',
                `#${previous.view}`
            );
        } else {
            // Default back to dashboard
            this.navigateTo('dashboard');
        }
    }

    getCurrentParams() {
        // Get current URL parameters
        const hash = window.location.hash;
        const [view, ...params] = hash.substring(1).split('/');

        return {
            view: view || 'dashboard',
            params: params
        };
    }

    // Utility methods for specific navigation
    navigateToPlanDetail(planId) {
        this.navigateTo('plan-detail', { planId });
    }

    navigateToWorkout(dayId) {
        this.navigateTo('workout', { dayId });
    }

    navigateToExercise(exerciseId) {
        this.navigateTo('exercise', { exerciseId });
    }

    // Get current view name
    getCurrentView() {
        return this.currentView;
    }

    // Check if can go back
    canGoBack() {
        return this.viewHistory.length > 0;
    }
}