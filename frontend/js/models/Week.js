/**
 * Week Model
 * Represents a week within a training plan
 */

import { Day } from './Day.js';

export class Week {
    constructor(data = {}) {
        this.id = data.id || null;
        this.weekNumber = data.weekNumber || 1;
        this.name = data.name || `Week ${this.weekNumber}`;
        this.description = data.description || '';
        this.days = data.days ? data.days.map(d => new Day(d)) : [];
        this.focus = data.focus || '';
    }

    get totalExercises() {
        return this.days.reduce((total, day) => total + day.exercises.length, 0);
    }

    get completedDays() {
        return this.days.filter(day => day.isCompleted).length;
    }

    get completionRate() {
        if (this.days.length === 0) return 0;
        return (this.completedDays / this.days.length) * 100;
    }

    getDay(dayNumber) {
        return this.days.find(day => day.dayNumber === dayNumber);
    }

    addDay(dayData) {
        const day = new Day(dayData);
        this.days.push(day);
        return day;
    }

    toJSON() {
        return {
            id: this.id,
            weekNumber: this.weekNumber,
            name: this.name,
            description: this.description,
            days: this.days.map(day => day.toJSON()),
            focus: this.focus
        };
    }

    static fromJSON(data) {
        return new Week(data);
    }
}