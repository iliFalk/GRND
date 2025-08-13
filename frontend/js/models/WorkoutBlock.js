/**
 * WorkoutBlock Model
 * Represents a block of work on a Day (Standard / Circuit / AMRAP)
 */

import { Exercise } from './Exercise.js';

export class WorkoutBlock {
    constructor(data = {}) {
        // Canonical fields
        this.block_id = data.block_id || data.id || `block-${Date.now()}`;
        this.day_id = data.day_id || data.dayId || null;
        this.block_type = data.block_type || data.blockType || 'Standard'; // 'Standard' | 'Circuit' | 'AMRAP'
        this.display_order = Number.isInteger(data.display_order) ? data.display_order : (data.displayOrder || 1);

        // Circuit-specific
        this.rounds = data.rounds || data.target_rounds || null;

        // AMRAP-specific (minutes)
        this.target_time = data.target_time || data.targetTime || null;

        // Exercises (array of Exercise objects)
        this.exercises = data.exercises ? data.exercises.map(e => new Exercise(e)) : [];

        // Legacy / convenience fields
        this.id = this.block_id;
    }

    get exercisesCount() {
        return this.exercises.length;
    }

    toJSON() {
        return {
            // Canonical fields
            block_id: this.block_id,
            day_id: this.day_id,
            block_type: this.block_type,
            display_order: this.display_order,
            rounds: this.rounds,
            target_time: this.target_time,
            exercises: this.exercises.map(ex => ex.toJSON()),

            // Legacy fields
            id: this.block_id
        };
    }

    static fromJSON(data) {
        return new WorkoutBlock(data);
    }

    addExercise(exData) {
        const ex = new Exercise(exData);
        this.exercises.push(ex);
        return ex;
    }

    removeExercise(exerciseId) {
        this.exercises = this.exercises.filter(e => e.id !== exerciseId && e.exercise_id !== exerciseId);
    }
}
