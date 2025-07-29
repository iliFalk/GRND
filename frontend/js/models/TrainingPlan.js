/**
 * TrainingPlan Model
 * Represents a complete training program
 */

export class TrainingPlan {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.description = data.description || '';
        this.durationWeeks = data.durationWeeks || 0;
        this.difficulty = data.difficulty || 'beginner';
        this.goal = data.goal || '';
        this.weeks = data.weeks ? data.weeks.map(w => new Week(w)) : [];
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    get totalDays() {
        return this.weeks.reduce((total, week) => total + week.days.length, 0);
    }

    get currentWeek() {
        const today = new Date();
        const startDate = new Date(this.createdAt);
        const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysSinceStart / 7) + 1;
        return Math.min(weekNumber, this.durationWeeks);
    }

    getWeek(weekNumber) {
        return this.weeks.find(week => week.weekNumber === weekNumber);
    }

    getTodayWorkout() {
        const currentWeek = this.getWeek(this.currentWeek);
        if (!currentWeek) return null;
        
        const today = new Date().getDay();
        const dayIndex = today === 0 ? 6 : today - 1; // Convert Sunday (0) to 6
        return currentWeek.days[dayIndex] || null;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            durationWeeks: this.durationWeeks,
            difficulty: this.difficulty,
            goal: this.goal,
            weeks: this.weeks.map(week => week.toJSON()),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        return new TrainingPlan(data);
    }
}