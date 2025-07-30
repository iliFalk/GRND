/**
 * Exercise Model
 * Represents a single exercise within a workout day
 */

export class Exercise {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.exercise_type = data.exercise_type || 'WEIGHTED'; // 'WEIGHTED' or 'BODYWEIGHT'
        this.bodyweight_load_percentage = data.bodyweight_load_percentage || 1.0;
        this.instructions = data.instructions || '';
        this.imageUrl = data.imageUrl || '';

        // Exercise parameters
        this.sets = data.sets || 0;
        this.reps = data.reps || 0;
        this.weight = data.weight || 0;
        this.duration = data.duration || 0; // in seconds for timed exercises
        this.restTime = data.restTime || 60; // rest between sets in seconds

        // Progress tracking
        this.completed_sets = data.completed_sets ? data.completed_sets.map(set => ({
            reps: set.reps || 0,
            weight: set.weight || 0
        })) : [];
        this.notes = data.notes || '';
    }

    get isCompleted() {
        return this.completed_sets.length >= this.sets;
    }

    get progress() {
        if (this.sets === 0) return 0;
        return (this.completed_sets.length / this.sets) * 100;
    }

    get displayName() {
        return this.name;
    }

    get displaySetsReps() {
        if (this.sets && this.reps) {
            return `${this.sets} × ${this.reps}`;
        }
        return '';
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
            id: this.id,
            name: this.name,
            exercise_type: this.exercise_type,
            bodyweight_load_percentage: this.bodyweight_load_percentage,
            instructions: this.instructions,
            imageUrl: this.imageUrl,
            sets: this.sets,
            reps: this.reps,
            weight: this.weight,
            duration: this.duration,
            restTime: this.restTime,
            completed_sets: this.completed_sets,
            notes: this.notes
        };
    }

    static fromJSON(data) {
        return new Exercise(data);
    }
}