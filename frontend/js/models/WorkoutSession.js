/**
 * WorkoutSession Model
 * Represents a completed workout session
 */

import { Day } from './Day.js';
import { getBodyweightLoadPercentage } from '../utils/bodyweightLoadTable.js';

export class WorkoutSession {
    constructor(data = {}) {
        // README specifies: session_id, date, total_duration, total_volume_kg, day_id_completed, performance_summary
        this.session_id = data.session_id || data.id || null;
        this.date = data.date ? new Date(data.date) : new Date();
        this.total_duration = data.total_duration || data.duration || 0; // in seconds
        this.total_volume_kg = data.total_volume_kg || data.totalVolume || 0;
        this.day_id_completed = data.day_id_completed || data.dayId || null;
        this.performance_summary = data.performance_summary || {};
        // Color for this workout session
        this.color = data.color || null;

        // Legacy fields for backward compatibility
        this.id = this.session_id;
        this.userId = data.userId || null;
        this.planId = data.planId || null;
        this.weekId = data.weekId || null;
        this.dayId = this.day_id_completed;
        this.day = data.day ? new Day(data.day) : null;
        this.startTime = data.startTime ? new Date(data.startTime) : new Date();
        this.endTime = data.endTime ? new Date(data.endTime) : null;
        this.duration = this.total_duration;
        this.totalVolume = this.total_volume_kg;
        this.status = data.status || 'in_progress'; // in_progress, completed, cancelled

        // Timer configuration
        this.timerConfig = data.timerConfig || {
            totalWorkoutTime: 60, // in minutes
            preparationTime: 10, // in seconds
            defaultRestTime: 60, // in seconds
            workoutType: 'STANDARD' // 'STANDARD' or 'CIRCUIT'
        };

        // Timer state
        this.timerState = data.timerState || {
            isActive: false,
            isPreparation: false,
            isRest: false,
            currentExerciseIndex: 0,
            currentSetIndex: 0,
            currentRoundIndex: 0,
            timers: {
                total: { currentTime: 0, isRunning: false },
                preparation: { currentTime: 0, isRunning: false },
                rest: { currentTime: 0, isRunning: false }
            }
        };

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
        this.total_duration = Math.floor((this.endTime - this.startTime) / 1000);
        this.duration = this.total_duration; // Legacy field
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
            this.total_volume_kg = 0;
            this.completedExercises.forEach(exercise => {
                // Use the hardcoded bodyweight load table as specified in README
                const exerciseName = exercise.exercise_name || exercise.name || '';
                const loadPercentage = bodyweightLoadPercentages[exerciseName] !== undefined
                    ? bodyweightLoadPercentages[exerciseName]
                    : getBodyweightLoadPercentage(exerciseName);

                const volume = WorkoutSession.calculateExerciseVolume(
                    exercise,
                    userBodyweight,
                    loadPercentage
                );
                exercise.volume = volume;
                this.total_volume_kg += volume;
            });
            this.totalVolume = this.total_volume_kg; // Legacy field
        }

    toJSON() {
        return {
            // README-compliant fields
            session_id: this.session_id,
            date: this.date,
            total_duration: this.total_duration,
            total_volume_kg: this.total_volume_kg,
            day_id_completed: this.day_id_completed,
            performance_summary: this.performance_summary,

            // Legacy fields for backward compatibility
            id: this.session_id,
            userId: this.userId,
            planId: this.planId,
            weekId: this.weekId,
            dayId: this.day_id_completed,
            day: this.day ? this.day.toJSON() : null,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.total_duration,
            status: this.status,
            timerConfig: this.timerConfig,
            timerState: this.timerState,
            totalVolume: this.total_volume_kg,
            totalSets: this.totalSets,
            totalReps: this.totalReps,
            averageRPE: this.averageRPE,
            completedExercises: this.completedExercises,
            notes: this.notes,
            mood: this.mood,
            energyLevel: this.energyLevel,
            location: this.location,
            device: this.device,
            color: this.color
        };
    }

    static fromJSON(data) {
        return new WorkoutSession(data);
    }
}
