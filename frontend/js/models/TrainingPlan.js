/**
 * TrainingPlan Model
 * Represents a complete training program
 */

import { Week } from './Week.js';

export class TrainingPlan {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.durationWeeks = data.durationWeeks || 0;
        this.start_date = data.start_date ? new Date(data.start_date) : new Date();
        this.weeks = data.weeks ? data.weeks.map(w => new Week(w)) : [];
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    get totalDays() {
        return this.weeks.reduce((total, week) => total + week.days.length, 0);
    }

    get currentWeek() {
        const today = new Date();
        const startDate = new Date(this.start_date);
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
            durationWeeks: this.durationWeeks,
            start_date: this.start_date,
            weeks: this.weeks.map(week => week.toJSON()),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        return new TrainingPlan(data);
    }
}