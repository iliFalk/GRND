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
            // Create AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            // Add abort signal to config
            config.signal = controller.signal;

            const response = await fetch(url, config);
            
            // Clear timeout as request completed
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;

                // Try to get JSON error message if available
                try {
                    const error = await response.json();
                    errorMessage = error.message || error.error || errorMessage;
                } catch (parseError) {
                    // If response is not JSON, use the status text
                    errorMessage = response.statusText || errorMessage;
                }

                throw new Error(errorMessage);
            }

            // Check if response is JSON before parsing
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                // Handle non-JSON responses
                throw new Error(`Unexpected response format: ${contentType}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('API request timeout:', error);
                throw new Error('Request timeout after 10 seconds');
            } else {
                console.error('API request failed:', error);
                throw error;
            }
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

    // Day endpoints
    async getDay(dayId) {
        return this.request(`/days/${dayId}`);
    }

    async createTrainingPlan(planData) {
        // Get current user ID from Telegram or storage
        let userId = 'default-user'; // Fallback
        
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        } else if (window.grndApp && window.grndApp.getCurrentUser) {
            const user = window.grndApp.getCurrentUser();
            userId = user ? user.id.toString() : userId;
        }

        // Use the README-compliant endpoint
        return this.request(`/workout-data/${userId}`, {
            method: 'POST',
            body: JSON.stringify(planData)
        });
    }

    async updateTrainingPlan(planId, planData) {
        // Get current user ID from Telegram or storage
        let userId = 'default-user'; // Fallback
        
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        } else if (window.grndApp && window.grndApp.getCurrentUser) {
            const user = window.grndApp.getCurrentUser();
            userId = user ? user.id.toString() : userId;
        }

        // Use the README-compliant endpoint
        return this.request(`/workout-data/${userId}`, {
            method: 'POST',
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

        try {
            // Create AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(`${this.baseUrl}/images/upload`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            // Clear timeout as request completed
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            return response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Image upload timeout:', error);
                throw new Error('Image upload timeout after 10 seconds');
            } else {
                console.error('Image upload failed:', error);
                throw error;
            }
        }
    }

    // Health check
    async healthCheck() {
        try {
            // Create AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(`${this.baseUrl}/health`, {
                signal: controller.signal
            });

            // Clear timeout as request completed
            clearTimeout(timeoutId);

            return response.ok;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Health check timeout:', error);
                return false;
            } else {
                console.error('Health check failed:', error);
                return false;
            }
        }
    }

    // Volume calculation endpoint
    async calculateVolume(userBodyweight, exercises) {
        return this.request('/calculate-volume', {
            method: 'POST',
            body: JSON.stringify({
                user_bodyweight: userBodyweight,
                exercises: exercises
            })
        });
    }

    // README-specified endpoints
    // GET /api/workout-data/:userId - retrieve user's training plan data
    async getWorkoutData(userId) {
        return this.request(`/workout-data/${userId}`);
    }

    // POST /api/workout-data/:userId - save user's training plan data
    async saveWorkoutData(userId, trainingPlan) {
        return this.request(`/workout-data/${userId}`, {
            method: 'POST',
            body: JSON.stringify(trainingPlan)
        });
    }

    // User Profile endpoints as specified in README
    async getUserProfile(userId) {
        return this.request(`/user-profile/${userId}`);
    }

    async saveUserProfile(userId, profile) {
        return this.request(`/user-profile/${userId}`, {
            method: 'POST',
            body: JSON.stringify(profile)
        });
    }

    async deleteUserProfile(userId) {
        return this.request(`/user-profile/${userId}`, {
            method: 'DELETE'
        });
    }

    // Workout Session endpoints as specified in README
    async createWorkoutSessionLog(sessionData) {
        return this.request('/workout-session', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
    }

    async getUserWorkoutSessions(userId) {
        return this.request(`/workout-sessions/${userId}`);
    }

    async getWorkoutSessionById(sessionId) {
        return this.request(`/workout-session/${sessionId}`);
    }

    async deleteWorkoutSession(sessionId) {
        return this.request(`/workout-session/${sessionId}`, {
            method: 'DELETE'
        });
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