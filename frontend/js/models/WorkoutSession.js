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
        this.startTime = data.startTime ? new Date(data.startTime) : new Date();
        this.endTime = data.endTime ? new Date(data.endTime) : null;
        this.duration = data.duration || 0; // in seconds
        this.status = data.status || 'in_progress'; // in_progress, completed, cancelled
        
        // Performance metrics
        this.totalVolume = data.totalVolume || 0;
        this.totalSets = data.totalSets || 0;
        this.totalReps = data.totalReps || 0;
        this.averageRPE = data.averageRPE || 0;
        
        // Exercise performance
        this.exercisePerformance = data.exercisePerformance || [];
        
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
    }

    calculateTotals() {
        if (!this.day) return;
        
        this.totalSets = this.day.exercises.reduce((total, exercise) => {
            return total + exercise.completedSets;
        }, 0);
        
        this.totalReps = this.day.exercises.reduce((total, exercise) => {
            return total + exercise.completedReps.reduce((sum, reps) => sum + reps, 0);
        }, 0);
        
        this.totalVolume = this.day.exercises.reduce((total, exercise) => {
            return total + exercise.totalVolume;
        }, 0);
        
        // Calculate average RPE
        const rpeValues = this.day.exercises.map(e => e.rpe).filter(rpe => rpe > 0);
        if (rpeValues.length > 0) {
            this.averageRPE = rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;
        }
    }

    addExercisePerformance(exerciseId, performance) {
        this.exercisePerformance.push({
            exerciseId,
            sets: performance.sets || [],
            notes: performance.notes || '',
            rpe: performance.rpe || 0,
            timestamp: new Date()
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
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.duration,
            status: this.status,
            totalVolume: this.totalVolume,
            totalSets: this.totalSets,
            totalReps: this.totalReps,
            averageRPE: this.averageRPE,
            exercisePerformance: this.exercisePerformance,
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