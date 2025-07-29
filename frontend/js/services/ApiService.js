/**
 * ApiService
 * Handles all backend API communication
 */

export class ApiService {
    constructor(baseUrl = 'http://localhost:3000/api') {
        this.baseUrl = baseUrl;
        this.token = null;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // User endpoints
    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getUser(userId) {
        return this.request(`/users/${userId}`);
    }

    async updateUser(userId, userData) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    // Training Plan endpoints
    async getTrainingPlans() {
        return this.request('/training-plans');
    }

    async getTrainingPlan(planId) {
        return this.request(`/training-plans/${planId}`);
    }

    async createTrainingPlan(planData) {
        return this.request('/training-plans', {
            method: 'POST',
            body: JSON.stringify(planData)
        });
    }

    async updateTrainingPlan(planId, planData) {
        return this.request(`/training-plans/${planId}`, {
            method: 'PUT',
            body: JSON.stringify(planData)
        });
    }

    async deleteTrainingPlan(planId) {
        return this.request(`/training-plans/${planId}`, {
            method: 'DELETE'
        });
    }

    // User Plan endpoints
    async assignPlanToUser(userId, planId) {
        return this.request(`/users/${userId}/plans`, {
            method: 'POST',
            body: JSON.stringify({ planId })
        });
    }

    async getUserPlans(userId) {
        return this.request(`/users/${userId}/plans`);
    }

    async getUserCurrentPlan(userId) {
        return this.request(`/users/${userId}/current-plan`);
    }

    // Workout Session endpoints
    async createWorkoutSession(sessionData) {
        return this.request('/workout-sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
    }

    async getWorkoutSessions(userId, filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/users/${userId}/workout-sessions?${query}`);
    }

    async getWorkoutSession(sessionId) {
        return this.request(`/workout-sessions/${sessionId}`);
    }

    async updateWorkoutSession(sessionId, sessionData) {
        return this.request(`/workout-sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(sessionData)
        });
    }

    // Progress endpoints
    async getUserProgress(userId) {
        return this.request(`/users/${userId}/progress`);
    }

    async getExerciseHistory(userId, exerciseId) {
        return this.request(`/users/${userId}/exercises/${exerciseId}/history`);
    }

    // Stats endpoints
    async getUserStats(userId) {
        return this.request(`/users/${userId}/stats`);
    }

    async getLeaderboard() {
        return this.request('/leaderboard');
    }

    // Image endpoints
    async uploadImage(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const response = await fetch(`${this.baseUrl}/images/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload image');
        }
        
        return response.json();
    }

    // Health check
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
    
    // Dashboard specific methods
    async getTodaysWorkout() {
        // This would be implemented to get today's specific workout
        // For now, we'll return a mock implementation
        return {
            id: 'day-1',
            name: 'Upper Body Strength',
            description: 'Focus on chest, back, and shoulders',
            lastPerformance: [
                { exercise: 'Bench Press', result: '80kg x 5 reps' },
                { exercise: 'Rows', result: '70kg x 8 reps' }
            ]
        };
    }
    
    async getQuickStats() {
        // This would fetch quick stats for the dashboard
        // For now, we'll return a mock implementation
        return {
            weeklyVolume: 1200,
            lastWorkout: 'Upper Body Strength',
            streak: 7
        };
    }
}