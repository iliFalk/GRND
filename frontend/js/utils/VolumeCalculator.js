/**
 * Volume Calculator Utility
 * Provides functions for calculating workout volume
 */
import { getBodyweightLoadPercentage } from './bodyweightLoadTable.js';

export class VolumeCalculator {
  /**
   * Calculate volume for a single exercise
   * @param {Object} exercise - The exercise object
   * @param {number} exercise.sets - Number of sets
   * @param {number} exercise.reps - Number of reps
   * @param {number} [exercise.weight=0] - Weight used (for weighted exercises)
   * @param {string} [exercise.exercise_type='WEIGHTED'] - Exercise type ('WEIGHTED' or 'BODYWEIGHT')
   * @param {number} [userBodyweight=0] - User's bodyweight in kg (for bodyweight exercises)
   * @param {number} [bodyweightLoadPercentage=1] - Percentage of bodyweight used (for bodyweight exercises)
   * @returns {number} - Calculated volume
   */
  static calculateExerciseVolume(exercise, userBodyweight = 0, bodyweightLoadPercentage = 1) {
    if (!exercise || exercise.sets <= 0 || exercise.reps <= 0) {
      return 0;
    }

    let volume = 0;

    if (exercise.exercise_type === 'BODYWEIGHT' && userBodyweight > 0) {
      // Bodyweight exercise: volume = (bodyweight * loadPercentage) * reps * sets
      volume = (userBodyweight * bodyweightLoadPercentage) * exercise.reps * exercise.sets;
    } else if (exercise.weight && exercise.weight > 0) {
      // Weighted exercise: volume = weight * reps * sets
      volume = exercise.weight * exercise.reps * exercise.sets;
    } else {
      // Bodyweight exercise with default 1x bodyweight or no weight specified
      volume = exercise.reps * exercise.sets;
    }

    return volume;
  }

  /**
   * Calculate total volume for a workout session
   * @param {Array} exercises - Array of exercise objects
   * @param {number} [userBodyweight=0] - User's bodyweight in kg
   * @returns {number} - Total volume for all exercises
   */
  static calculateTotalVolume(exercises, userBodyweight = 0) {
    if (!Array.isArray(exercises)) {
      return 0;
    }

    let totalVolume = 0;

    exercises.forEach(exercise => {
      // Get bodyweight load percentage for this exercise
      const loadPercentage = getBodyweightLoadPercentage(exercise.name);

      // Calculate volume for this exercise
      const volume = this.calculateExerciseVolume(
        exercise,
        userBodyweight,
        loadPercentage
      );

      // Add to total
      totalVolume += volume;
    });

    return totalVolume;
  }

  /**
   * Calculate volume for circuit workouts
   * @param {Array} exercises - Array of exercise objects
   * @param {number} [userBodyweight=0] - User's bodyweight in kg
   * @param {number} [circuitRounds=1] - Number of rounds in the circuit
   * @returns {number} - Total volume for circuit workout
   */
  static calculateCircuitVolume(exercises, userBodyweight = 0, circuitRounds = 1) {
    if (!Array.isArray(exercises) || exercises.length === 0 || circuitRounds <= 0) {
      return 0;
    }

    let totalVolume = 0;

    exercises.forEach(exercise => {
      // Get bodyweight load percentage for this exercise
      const loadPercentage = getBodyweightLoadPercentage(exercise.name);

      // Calculate volume for this exercise
      const volume = this.calculateExerciseVolume(
        exercise,
        userBodyweight,
        loadPercentage
      );

      // Multiply by number of rounds in circuit
      totalVolume += volume * circuitRounds;
    });

    return totalVolume;
  }
}