/**
 * Exercise Model
 * Represents a single exercise within a workout day
 */

export class Exercise {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.type = data.type || 'strength'; // strength, cardio, flexibility, etc.
        this.muscleGroups = data.muscleGroups || [];
        this.equipment = data.equipment || '';
        this.instructions = data.instructions || '';
        this.videoUrl = data.videoUrl || '';
        this.imageUrl = data.imageUrl || '';
        
        // Exercise parameters
        this.sets = data.sets || 0;
        this.reps = data.reps || 0;
        this.weight = data.weight || 0;
        this.duration = data.duration || 0; // in seconds for timed exercises
        this.distance = data.distance || 0; // for cardio exercises
        this.restTime = data.restTime || 60; // rest between sets in seconds
        
        // Progress tracking
        this.completedSets = data.completedSets || 0;
        this.completedReps = data.completedReps || [];
        this.completedWeight = data.completedWeight || [];
        this.notes = data.notes || '';
        this.rpe = data.rpe || 0; // Rate of Perceived Exertion (1-10)
        
        // Circuit-specific properties
        this.circuitOrder = data.circuitOrder || 0;
        this.circuitRounds = data.circuitRounds || 0;
    }

    get isCompleted() {
        return this.completedSets >= this.sets;
    }

    get progress() {
        if (this.sets === 0) return 0;
        return (this.completedSets / this.sets) * 100;
    }

    get totalVolume() {
        if (this.type === 'strength') {
            // If bodyweight exercise, use 1 as weight
            if (this.name.toLowerCase().includes('bodyweight') ||
                this.name.toLowerCase().includes('bw')) {
                return this.sets * this.reps * 1;
            }
            return this.sets * this.reps * this.weight;
        }
        return 0;
    }

    /**
     * Calculate volume using the VolumeCalculator utility
     * @param {number} [userBodyweight=0] - User's bodyweight in kg
     * @param {number} [bodyweightLoadPercentage=1] - Percentage of bodyweight used
     * @returns {number} - Calculated volume
     */
    calculateVolume(userBodyweight = 0, bodyweightLoadPercentage = 1) {
        const { VolumeCalculator } = require('../utils/VolumeCalculator');

        return VolumeCalculator.calculateExerciseVolume({
            sets: this.sets,
            reps: this.reps,
            weight: this.weight,
            isBodyweight: this.name.toLowerCase().includes('bodyweight') ||
                         this.name.toLowerCase().includes('bw'),
        }, userBodyweight, bodyweightLoadPercentage);
    }

    get displayName() {
        return this.name;
    }

    get displaySetsReps() {
        if (this.type === 'cardio') {
            return `${this.duration}s`;
        }
        if (this.sets && this.reps) {
            return `${this.sets} × ${this.reps}`;
        }
        return '';
    }

    get targetMuscleGroups() {
        return this.muscleGroups.join(', ');
    }

    addSet(reps, weight) {
        this.completedSets++;
        this.completedReps.push(reps);
        this.completedWeight.push(weight);
    }

    removeLastSet() {
        if (this.completedSets > 0) {
            this.completedSets--;
            this.completedReps.pop();
            this.completedWeight.pop();
        }
    }

    resetProgress() {
        this.completedSets = 0;
        this.completedReps = [];
        this.completedWeight = [];
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            muscleGroups: this.muscleGroups,
            equipment: this.equipment,
            instructions: this.instructions,
            videoUrl: this.videoUrl,
            imageUrl: this.imageUrl,
            sets: this.sets,
            reps: this.reps,
            weight: this.weight,
            duration: this.duration,
            distance: this.distance,
            restTime: this.restTime,
            completedSets: this.completedSets,
            completedReps: this.completedReps,
            completedWeight: this.completedWeight,
            notes: this.notes,
            rpe: this.rpe,
            circuitOrder: this.circuitOrder,
            circuitRounds: this.circuitRounds
        };
    }

    static fromJSON(data) {
        return new Exercise(data);
    }
}