/**
 * Day Model
 * Represents a single training day with support for Standard and Circuit types
 */

import { Exercise } from './Exercise.js';

export class Day {
    constructor(data = {}) {
        // README specifies: day_id, day_name, day_type, exercises OR circuit_config
        this.day_id = data.day_id || data.id || null;
        this.day_name = data.day_name || data.name || '';
        this.day_type = data.day_type || 'STANDARD'; // 'STANDARD' or 'CIRCUIT'
        this.exercises = data.exercises ? data.exercises.map(e => new Exercise(e)) : [];
        this.circuit_config = data.circuit_config || {
            target_rounds: 3,
            circuit_exercises: []
        };

        // Legacy fields for backward compatibility
        this.id = this.day_id;
        this.name = this.day_name;
        this.dayNumber = data.dayNumber || 1;
        this.isCompleted = data.isCompleted || false;
        this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }

    get totalSets() {
        if (this.day_type === 'CIRCUIT') {
            return this.exercises.reduce((total, exercise) => total + (exercise.sets || 0), 0);
        }
        return this.exercises.length;
    }

    get totalReps() {
        if (this.day_type === 'CIRCUIT') {
            return this.exercises.reduce((total, exercise) => total + (exercise.reps || 0), 0);
        }
        return this.exercises.reduce((total, exercise) => total + (exercise.reps || 0), 0);
    }

    get estimatedDuration() {
        let baseDuration = 0;

        if (this.day_type === 'CIRCUIT') {
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
            // README-compliant fields
            day_id: this.day_id,
            day_name: this.day_name,
            day_type: this.day_type,
            exercises: this.exercises.map(exercise => exercise.toJSON()),
            circuit_config: this.circuit_config,

            // Legacy fields for backward compatibility
            id: this.day_id,
            name: this.day_name,
            dayNumber: this.dayNumber,
            isCompleted: this.isCompleted,
            completedAt: this.completedAt
        };
    }

    static fromJSON(data) {
        return new Day(data);
    }
}