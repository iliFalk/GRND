/**
 * Day Model
 * Represents a single training day and now supports WorkoutBlocks (Standard, Circuit, AMRAP)
 */

import { Exercise } from './Exercise.js';
import { WorkoutBlock } from './WorkoutBlock.js';

export class Day {
    constructor(data = {}) {
        // Canonical fields
        this.day_id = data.day_id || data.id || `day-${Date.now()}`;
        this.week_id = data.week_id || data.weekId || null;
        this.day_name = data.day_name || data.name || '';
        this.day_of_week = data.day_of_week || data.dayOfWeek || null;
        this.day_type = data.day_type || data.dayType || 'Rest'; // 'Workout' | 'Rest' | 'Play Training'

        // New canonical structure: workoutBlocks (array of WorkoutBlock)
        if (data.workoutBlocks && Array.isArray(data.workoutBlocks)) {
            this.workoutBlocks = data.workoutBlocks.map(b => new WorkoutBlock(b));
        } else if (data.blocks && Array.isArray(data.blocks)) {
            // accept alternate key
            this.workoutBlocks = data.blocks.map(b => new WorkoutBlock(b));
        } else {
            // Backwards compatibility: if legacy exercises array exists, migrate into a default Standard block
            if (data.exercises && Array.isArray(data.exercises) && data.exercises.length > 0) {
                const defaultBlock = new WorkoutBlock({
                    block_id: `block-${Date.now()}`,
                    block_type: 'Standard',
                    display_order: 1,
                    exercises: data.exercises.map(e => new Exercise(e).toJSON())
                });
                this.workoutBlocks = [defaultBlock];
            } else {
                this.workoutBlocks = [];
            }
        }

        // Keep legacy fields for backward compatibility
        this.exercises = data.exercises ? data.exercises.map(e => new Exercise(e)) : [];
        this.circuit_config = data.circuit_config || {
            target_rounds: 3,
            circuit_exercises: []
        };

        this.id = this.day_id;
        this.name = this.day_name;
        this.dayNumber = data.dayNumber || data.dayNumber || 1;
        this.isCompleted = data.isCompleted || false;
        this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }

    // Computed properties aggregated from workoutBlocks
    get totalBlocks() {
        return this.workoutBlocks.length;
    }

    get totalExercises() {
        return this.workoutBlocks.reduce((sum, block) => sum + block.exercisesCount, 0);
    }

    // Estimate duration by summing block-specific estimates (basic heuristic)
    get estimatedDuration() {
        let minutes = 0;
        this.workoutBlocks.forEach(block => {
            if (block.block_type === 'Circuit') {
                // assume 30s per exercise + rest -> 1 minute per exercise per round
                const exCount = block.exercisesCount || 0;
                const rounds = block.rounds || 3;
                minutes += exCount * rounds * 1;
            } else if (block.block_type === 'AMRAP') {
                // target_time is in minutes
                minutes += block.target_time || 10;
            } else {
                // Standard: assume 3 minutes per set per exercise
                minutes += block.exercises.reduce((blkSum, ex) => {
                    const sets = ex.sets || 1;
                    return blkSum + sets * 3;
                }, 0);
            }
        });

        // Add warm-up and cool-down (10 + 5 minutes)
        return Math.round(minutes + 15);
    }

    // Add a new WorkoutBlock to this day
    addWorkoutBlock(blockData = {}) {
        const order = this.workoutBlocks.length > 0
            ? Math.max(...this.workoutBlocks.map(b => b.display_order)) + 1
            : 1;
        const block = new WorkoutBlock({
            ...blockData,
            display_order: blockData.display_order || order,
            block_type: blockData.block_type || blockData.blockType || 'Standard',
            day_id: this.day_id
        });
        this.workoutBlocks.push(block);
        return block;
    }

    // Add an exercise to a specific block (by block id). If blockId omitted, add to first block or create default block.
    addExerciseToBlock(exData = {}, blockId = null) {
        let targetBlock = null;
        if (blockId) {
            targetBlock = this.workoutBlocks.find(b => b.block_id === blockId || b.id === blockId);
        }
        if (!targetBlock) {
            if (this.workoutBlocks.length === 0) {
                targetBlock = this.addWorkoutBlock({ block_type: 'Standard' });
            } else {
                targetBlock = this.workoutBlocks[0];
            }
        }
        const ex = targetBlock.addExercise(exData);
        return ex;
    }

    // Remove an exercise by id across all blocks
    removeExercise(exerciseId) {
        this.workoutBlocks.forEach(block => block.removeExercise(exerciseId));
        // Also remove from legacy array for compatibility
        this.exercises = this.exercises.filter(e => e.id !== exerciseId && e.exercise_id !== exerciseId);
    }

    // Remove a block by id
    removeBlock(blockId) {
        this.workoutBlocks = this.workoutBlocks.filter(b => b.block_id !== blockId && b.id !== blockId);
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
            // Canonical fields
            day_id: this.day_id,
            week_id: this.week_id,
            day_name: this.day_name,
            day_of_week: this.day_of_week,
            day_type: this.day_type,
            workoutBlocks: this.workoutBlocks.map(b => b.toJSON()),

            // Legacy fields for backward compatibility
            exercises: this.exercises.map(ex => ex.toJSON()),
            circuit_config: this.circuit_config,

            // Legacy convenience
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
