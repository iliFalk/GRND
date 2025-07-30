/**
 * TrainingPlan Model
 * Represents a complete training program
 */

import { Week } from './Week.js';

export class TrainingPlan {
    constructor(data = {}) {
        // README specifies: plan_id, plan_name, start_date, weeks
        this.plan_id = data.plan_id || data.id || null;
        this.plan_name = data.plan_name || data.name || '';
        this.plan_type = data.plan_type || 'STANDARD'; // 'STANDARD' or 'CIRCUIT'
        this.description = data.description || '';
        this.start_date = data.start_date ? new Date(data.start_date) : new Date();
        this.weeks = data.weeks ? data.weeks.map(w => new Week(w)) : [];

        // Keep legacy fields for backward compatibility
        this.id = this.plan_id;
        this.name = this.plan_name;
        this.durationWeeks = data.durationWeeks || this.weeks.length;
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
            // README-compliant fields
            plan_id: this.plan_id,
            plan_name: this.plan_name,
            plan_type: this.plan_type,
            description: this.description,
            start_date: this.start_date,
            weeks: this.weeks.map(week => week.toJSON()),

            // Legacy fields for backward compatibility
            id: this.plan_id,
            name: this.plan_name,
            durationWeeks: this.durationWeeks,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        return new TrainingPlan(data);
    }
}