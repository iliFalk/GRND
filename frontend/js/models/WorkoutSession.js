/**
 * WorkoutSession Model
 * Represents a completed workout session
 */

import { Day } from './Day.js';

export class WorkoutSession {
    constructor(data = {}) {
        this.id = data.id || null;
        this.userId = data.userId || null;
        this.planId = data.planId || null;
        this.weekId = data.weekId || null;
        this.dayId = data.dayId || null;
        this.day = data.day ? new Day(data.day) : null;

        // Session metadata
        this.date = data.date ? new Date(data.date) : new Date();
        this.startTime = data.startTime ? new Date(data.startTime) : new Date();
        this.endTime = data.endTime ? new Date(data.endTime) : null;
        this.duration = data.duration || 0; // in seconds
        this.status = data.status || 'in_progress'; // in_progress, completed, cancelled

        // Performance metrics
        this.totalVolume = data.totalVolume || 0;
        this.totalSets = data.totalSets || 0;
        this.totalReps = data.totalReps || 0;
        this.averageRPE = data.averageRPE || 0;

        // Completed exercises
        this.completedExercises = data.completedExercises || [];

        // Notes and feedback
        this.notes = data.notes || '';
        this.mood = data.mood || null; // 1-5 scale
        this.energyLevel = data.energyLevel || null; // 1-5 scale

        // Location and device info
        this.location = data.location || null;
        this.device = data.device || null;
    }

    get isCompleted() {
        return this.status === 'completed';
    }

    get isInProgress() {
        return this.status === 'in_progress';
    }

    get formattedDuration() {
        if (!this.duration) return '0:00';
        
        const minutes = Math.floor(this.duration / 60);
        const seconds = this.duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    get caloriesBurned() {
        // Simple estimation: 5 calories per minute of moderate exercise
        return Math.round((this.duration / 60) * 5);
    }

    complete() {
        this.endTime = new Date();
        this.duration = Math.floor((this.endTime - this.startTime) / 1000);
        this.status = 'completed';

        // Calculate totals
        this.calculateTotals();

        // Calculate volume for completed exercises
        this.calculateTotalVolume();
    }

    calculateTotals() {
        // Reset totals
        this.totalSets = 0;
        this.totalReps = 0;

        // Calculate from completed exercises
        this.completedExercises.forEach(exercise => {
            this.totalSets += exercise.sets.length;
            exercise.sets.forEach(set => {
                this.totalReps += set.reps;
            });
        });

        // Calculate average RPE
        const rpeValues = this.completedExercises.map(e => e.rpe || 0).filter(rpe => rpe > 0);
        if (rpeValues.length > 0) {
            this.averageRPE = rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;
        }
    }

    
        /**
         * Calculate volume for a single exercise
         * @param {Object} exercise - The exercise object
         * @param {number} [userBodyweight=0] - User's bodyweight in kg
         * @param {Object} [bodyweightLoadPercentages={}] - Object mapping exercise names to load percentages
         * @returns {number} - Calculated volume
         */
        static calculateExerciseVolume(exercise, userBodyweight = 0, bodyweightLoadPercentages = {}) {
            const { VolumeCalculator } = require('../utils/VolumeCalculator');

            // Determine bodyweight load percentage for this exercise
            const loadPercentage = bodyweightLoadPercentages[exercise.name] !== undefined
              ? bodyweightLoadPercentages[exercise.name]
              : 1;

            // Calculate volume using the utility
            return VolumeCalculator.calculateExerciseVolume({
                sets: exercise.sets.length,
                reps: exercise.sets.reduce((sum, set) => sum + set.reps, 0) / exercise.sets.length,
                weight: exercise.sets.reduce((sum, set) => sum + (set.weight || 0), 0) / exercise.sets.length,
                isBodyweight: !exercise.sets.some(set => set.weight !== undefined && set.weight !== null),
            }, userBodyweight, loadPercentage);
        }
    
        /**
         * Calculate total volume for all completed exercises
         * @param {number} [userBodyweight=0] - User's bodyweight in kg
         * @param {Object} [bodyweightLoadPercentages={}] - Object mapping exercise names to load percentages
         */
        calculateTotalVolume(userBodyweight = 0, bodyweightLoadPercentages = {}) {
            this.totalVolume = 0;
            this.completedExercises.forEach(exercise => {
                const volume = WorkoutSession.calculateExerciseVolume(
                    exercise,
                    userBodyweight,
                    bodyweightLoadPercentages
                );
                exercise.volume = volume;
                this.totalVolume += volume;
            });
        }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            planId: this.planId,
            weekId: this.weekId,
            dayId: this.dayId,
            day: this.day ? this.day.toJSON() : null,
            date: this.date,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.duration,
            status: this.status,
            totalVolume: this.totalVolume,
            totalSets: this.totalSets,
            totalReps: this.totalReps,
            averageRPE: this.averageRPE,
            completedExercises: this.completedExercises,
            notes: this.notes,
            mood: this.mood,
            energyLevel: this.energyLevel,
            location: this.location,
            device: this.device
        };
    }

    static fromJSON(data) {
        return new WorkoutSession(data);
    }
}