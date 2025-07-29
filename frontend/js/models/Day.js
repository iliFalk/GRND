/**
 * Day Model
 * Represents a single training day with support for Standard and Circuit types
 */

import { Exercise } from './Exercise.js';

export class Day {
    constructor(data = {}) {
        this.id = data.id || null;
        this.dayNumber = data.dayNumber || 1;
        this.name = data.name || '';
        this.type = data.type || 'Standard'; // 'Standard' or 'Circuit'
        this.description = data.description || '';
        this.exercises = data.exercises ? data.exercises.map(e => new Exercise(e)) : [];
        this.restDay = data.restDay || false;
        this.duration = data.duration || 0; // in minutes
        this.isCompleted = data.isCompleted || false;
        this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
        this.notes = data.notes || '';
    }

    get totalSets() {
        if (this.type === 'Circuit') {
            return this.exercises.reduce((total, exercise) => total + (exercise.sets || 0), 0);
        }
        return this.exercises.length;
    }

    get totalReps() {
        if (this.type === 'Circuit') {
            return this.exercises.reduce((total, exercise) => total + (exercise.reps || 0), 0);
        }
        return this.exercises.reduce((total, exercise) => total + (exercise.reps || 0), 0);
    }

    get estimatedDuration() {
        if (this.restDay) return 0;
        
        let baseDuration = 0;
        
        if (this.type === 'Circuit') {
            // Circuit training: 30 seconds per exercise + 30 seconds rest
            baseDuration = this.exercises.length * 1; // 1 minute per exercise
        } else {
            // Standard training: 2 minutes per set + 1 minute rest
            baseDuration = this.exercises.reduce((total, exercise) => {
                return total + (exercise.sets * 3); // 3 minutes per set
            }, 0);
        }
        
        // Add warm-up and cool-down
        return baseDuration + 10 + 5; // 10 min warm-up, 5 min cool-down
    }

    addExercise(exerciseData) {
        const exercise = new Exercise(exerciseData);
        this.exercises.push(exercise);
        return exercise;
    }

    removeExercise(exerciseId) {
        this.exercises = this.exercises.filter(exercise => exercise.id !== exerciseId);
    }

    markCompleted() {
        this.isCompleted = true;
        this.completedAt = new Date();
    }

    markIncomplete() {
        this.isCompleted = false;
        this.completedAt = null;
    }

    toJSON() {
        return {
            id: this.id,
            dayNumber: this.dayNumber,
            name: this.name,
            type: this.type,
            description: this.description,
            exercises: this.exercises.map(exercise => exercise.toJSON()),
            restDay: this.restDay,
            duration: this.duration,
            isCompleted: this.isCompleted,
            completedAt: this.completedAt,
            notes: this.notes
        };
    }

    static fromJSON(data) {
        return new Day(data);
    }
}