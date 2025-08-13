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
this.default_workout_color = data.default_workout_color || data.defaultColor || null;

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

    /**
     * Returns the plan end date (Date object) computed from start_date + durationWeeks
     */
    getPlanEndDate() {
        const start = new Date(this.start_date);
        const days = (this.durationWeeks || this.weeks.length) * 7;
        const end = new Date(start);
        end.setDate(start.getDate() + days);
        return end;
    }

    /**
     * Returns true when the user is currently in the final week of the plan.
     */
    isLastWeek() {
        return this.currentWeek === (this.durationWeeks || this.weeks.length);
    }

    /**
     * Returns true when today is the final training day (a Workout day) in the final week.
     */
    isLastTraining() {
        const lastWeekNumber = this.durationWeeks || this.weeks.length;
        const lastWeek = this.getWeek(lastWeekNumber);
        if (!lastWeek) return false;

        // Find last day index in the week that contains a workout (blocks or exercises)
        let lastWorkoutIndex = -1;
        for (let i = lastWeek.days.length - 1; i >= 0; i--) {
            const day = lastWeek.days[i];
            const hasWorkoutBlocks = Array.isArray(day.workoutBlocks) && day.workoutBlocks.length > 0;
            const hasExercises = Array.isArray(day.exercises) && day.exercises.length > 0;
            if (hasWorkoutBlocks || hasExercises) {
                lastWorkoutIndex = i;
                break;
            }
        }
        if (lastWorkoutIndex === -1) return false;

        const today = new Date().getDay();
        const todayIndex = today === 0 ? 6 : today - 1;
        const currentWeekNumber = this.currentWeek;
        return (currentWeekNumber === lastWeekNumber) && (todayIndex === lastWorkoutIndex);
    }

    /**
     * Returns true if the plan's end date has passed.
     */
    isPlanDone() {
        const now = new Date();
        const end = this.getPlanEndDate();
        return now > end;
    }

    applyDefaultColorToNewWorkout(workout) {
        if (!workout) return null;
        // If the workout doesn't have a color, apply the plan's default color if available
        if (!workout.color && this.default_workout_color) {
            workout.color = this.default_workout_color;
        }
        return workout;
    }

    toJSON() {
        return {
            // README-compliant fields
            plan_id: this.plan_id,
            plan_name: this.plan_name,
            plan_type: this.plan_type,
            description: this.description,
            // Ensure dates are serialized as ISO strings for backend validation
            start_date: this.start_date instanceof Date ? this.start_date.toISOString() : this.start_date,
            weeks: this.weeks.map(week => week.toJSON()),
            default_workout_color: this.default_workout_color,
    
            // Legacy fields for backward compatibility
            id: this.plan_id,
            name: this.plan_name,
            durationWeeks: this.durationWeeks,
            createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
            updatedAt: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : this.updatedAt
        };
    }

    static fromJSON(data) {
        return new TrainingPlan(data);
    }
}
