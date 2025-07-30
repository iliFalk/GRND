/**
 * Volume Calculator Utility
 * Provides functions for calculating workout volume
 */
import { getBodyweightLoadPercentage } from './bodyweightLoadTable.js';

export class VolumeCalculator {
  /**
   * Calculate volume for a single exercise according to README formulas
   * README specifies:
   * - WEIGHTED: Set Volume = weight_used × reps_completed
   * - BODYWEIGHT: Set Volume = user_bodyweight × bodyweight_load_percentage × reps_completed
   * @param {Object} exercise - The exercise object with completed_sets array
   * @param {number} [userBodyweight=0] - User's bodyweight in kg (required for bodyweight exercises)
   * @param {number} [bodyweightLoadPercentage=1] - Percentage of bodyweight used (for bodyweight exercises)
   * @returns {number} - Calculated volume in kg
   */
  static calculateExerciseVolume(exercise, userBodyweight = 0, bodyweightLoadPercentage = 1) {
    if (!exercise || !Array.isArray(exercise.completed_sets) || exercise.completed_sets.length === 0) {
      return 0;
    }

    let totalVolume = 0;

    // Calculate volume for each completed set according to README formulas
    exercise.completed_sets.forEach(set => {
      if (exercise.exercise_type === 'WEIGHTED') {
        // WEIGHTED: Set Volume = weight_used × reps_completed
        if (set.weight !== undefined && set.weight !== null && set.reps !== undefined) {
          totalVolume += set.weight * set.reps;
        }
      } else if (exercise.exercise_type === 'BODYWEIGHT' && userBodyweight > 0) {
        // BODYWEIGHT: Set Volume = user_bodyweight × bodyweight_load_percentage × reps_completed
        if (set.reps !== undefined) {
          totalVolume += userBodyweight * bodyweightLoadPercentage * set.reps;
        }
      }
    });

    return totalVolume;
  }

  /**
   * Calculate total volume for a workout session according to README
   * README specifies: total_volume_kg is the sum of all set volumes for the session
   * @param {Array} exercises - Array of exercise objects with completed_sets
   * @param {number} [userBodyweight=0] - User's bodyweight in kg
   * @returns {number} - Total volume for all exercises in kg
   */
  static calculateTotalVolume(exercises, userBodyweight = 0) {
    if (!Array.isArray(exercises)) {
      return 0;
    }

    let totalVolume = 0;

    exercises.forEach(exercise => {
      // Get bodyweight load percentage for this exercise
      const exerciseName = exercise.exercise_name || exercise.name || '';
      const loadPercentage = getBodyweightLoadPercentage(exerciseName);

      // Calculate volume for this exercise using README formulas
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