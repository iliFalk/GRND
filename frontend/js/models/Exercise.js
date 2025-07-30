/**
 * Exercise Model
 * Represents a single exercise within a workout day
 */

import { getBodyweightLoadPercentage } from '../utils/bodyweightLoadTable.js';

export class Exercise {
    constructor(data = {}) {
        // README specifies: exercise_id, exercise_name, description, image_url, exercise_type,
        // bodyweight_load_percentage, target_sets, target_reps, completed_sets
        this.exercise_id = data.exercise_id || data.id || null;
        this.exercise_name = data.exercise_name || data.name || '';
        this.description = data.description || data.instructions || '';
        this.image_url = data.image_url || data.imageUrl || '';
        this.exercise_type = data.exercise_type || 'WEIGHTED'; // 'WEIGHTED' or 'BODYWEIGHT'
        this.bodyweight_load_percentage = data.bodyweight_load_percentage || 1.0;
        this.target_sets = data.target_sets || data.sets || 0;
        this.target_reps = data.target_reps || data.reps || 0;
        this.completed_sets = data.completed_sets ? data.completed_sets.map(set => ({
            reps: set.reps || 0,
            weight: set.weight || 0
        })) : [];

        // Legacy fields for backward compatibility
        this.id = this.exercise_id;
        this.name = this.exercise_name;
        this.instructions = this.description;
        this.imageUrl = this.image_url;
        this.sets = this.target_sets;
        this.reps = this.target_reps;
        this.weight = data.weight || 0;
        this.duration = data.duration || 0; // in seconds for timed exercises
        this.restTime = data.restTime || 60; // rest between sets in seconds
        this.notes = data.notes || '';
    }

    get isCompleted() {
        return this.completed_sets.length >= this.target_sets;
    }

    get progress() {
        if (this.target_sets === 0) return 0;
        return (this.completed_sets.length / this.target_sets) * 100;
    }

    get displayName() {
        return this.exercise_name || this.name;
    }

    get displaySetsReps() {
        if (this.target_sets && this.target_reps) {
            return `${this.target_sets} × ${this.target_reps}`;
        }
        return '';
    }

    // Get bodyweight load percentage from the lookup table
    getBodyweightLoadPercentage() {
        if (this.exercise_type === 'BODYWEIGHT') {
            // Use the hardcoded lookup table as specified in README
            const exerciseName = this.exercise_name || this.name;
            return getBodyweightLoadPercentage(exerciseName);
        }
        return 1.0; // Default for weighted exercises
    }

    addSet(reps, weight) {
        this.completed_sets.push({ reps, weight });
    }

    removeLastSet() {
        if (this.completed_sets.length > 0) {
            this.completed_sets.pop();
        }
    }

    resetProgress() {
        this.completed_sets = [];
    }

    toJSON() {
        return {
            // README-compliant fields
            exercise_id: this.exercise_id,
            exercise_name: this.exercise_name,
            description: this.description,
            image_url: this.image_url,
            exercise_type: this.exercise_type,
            bodyweight_load_percentage: this.bodyweight_load_percentage,
            target_sets: this.target_sets,
            target_reps: this.target_reps,
            completed_sets: this.completed_sets,

            // Legacy fields for backward compatibility
            id: this.exercise_id,
            name: this.exercise_name,
            instructions: this.description,
            imageUrl: this.image_url,
            sets: this.target_sets,
            reps: this.target_reps,
            weight: this.weight,
            duration: this.duration,
            restTime: this.restTime,
            notes: this.notes
        };
    }

    static fromJSON(data) {
        return new Exercise(data);
    }
}