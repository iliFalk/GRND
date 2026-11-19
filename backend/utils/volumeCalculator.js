/**
 * Volume Calculator Utility for Backend
 *
 *   WEIGHTED    volume = weight × reps
 *   BODYWEIGHT  volume = (user_bodyweight × factor + added_weight) × reps
 *
 * The factor is the catalogue's `bodyweight_factor` — one source, `data/exercise-catalogue.json`.
 * The calculator used to carry its own table of names, and `calculateTotalVolume` preferred that
 * table over the factor an exercise carried, so two answers existed for one question. An exercise
 * the catalogue does not name has no factor: the call refuses instead of guessing 1.0.
 */
const catalogue = require('./exerciseCatalogue');

class VolumeCalculator {
  /**
   * Calculate volume for a single exercise according to PRD
   * @param {Object} exercise - The exercise object
   * @param {string} exercise.exercise_type - 'WEIGHTED' or 'BODYWEIGHT'
   * @param {number} [exercise.bodyweight_load_percentage=1] - Percentage of bodyweight for bodyweight exercises
   * @param {Array} exercise.completed_sets - Array of completed sets with reps and weight
   * @param {number} userBodyweight - User's bodyweight in kg (required for bodyweight exercises)
   * @returns {number} - Calculated volume in kg
   */
  static calculateExerciseVolume(exercise, userBodyweight) {
    if (!exercise || !Array.isArray(exercise.completed_sets) || exercise.completed_sets.length === 0) {
      return 0;
    }

    // Validate user bodyweight
    if (userBodyweight !== undefined && userBodyweight !== null) {
      if (typeof userBodyweight !== 'number' || isNaN(userBodyweight)) {
        throw new Error('User bodyweight must be a valid number');
      }
      if (userBodyweight < 0) {
        throw new Error('User bodyweight cannot be negative');
      }
    }

    // Validate bodyweight load percentage if provided
    if (exercise.bodyweight_load_percentage !== undefined) {
      if (typeof exercise.bodyweight_load_percentage !== 'number' || isNaN(exercise.bodyweight_load_percentage)) {
        throw new Error('Bodyweight load percentage must be a valid number');
      }
      if (exercise.bodyweight_load_percentage < 0) {
        throw new Error('Bodyweight load percentage cannot be negative');
      }
    }

    let totalVolume = 0;

    exercise.completed_sets.forEach(set => {
      if (exercise.exercise_type === 'WEIGHTED') {
        // Weighted exercise: Set Volume = weight_used × reps_completed
        if (set.weight !== undefined && set.weight !== null && set.reps !== undefined) {
          // Validate weight
          if (typeof set.weight !== 'number' || isNaN(set.weight)) {
            throw new Error('Weight must be a valid number');
          }
          if (set.weight < 0) {
            throw new Error('Weight cannot be negative');
          }
          
          // Validate reps
          if (typeof set.reps !== 'number' || isNaN(set.reps)) {
            throw new Error('Reps must be a valid number');
          }
          if (set.reps < 0) {
            throw new Error('Reps cannot be negative');
          }
          
          totalVolume += set.weight * set.reps;
        }
      } else if (exercise.exercise_type === 'BODYWEIGHT' && !userBodyweight) {
        // A silent zero reads as "no work". Without the bodyweight the volume cannot exist.
        throw new Error('user bodyweight is required for a bodyweight exercise');
      } else if (exercise.exercise_type === 'BODYWEIGHT') {
        // Bodyweight exercise: a load ADDED to the body counts with it.
        // The factor comes from the exercise, else from the catalogue, else there is no answer.
        const name = exercise.exercise_name || exercise.name || '';
        const factor = exercise.bodyweight_load_percentage !== undefined
          ? exercise.bodyweight_load_percentage
          : catalogue.bodyweightFactor(exercise);
        if (factor === undefined) {
          throw new Error(`no bodyweight factor for "${name || '(unnamed)'}": it is not in the catalogue`);
        }
        const added = typeof set.weight === 'number' && !isNaN(set.weight) && set.weight > 0 ? set.weight : 0;
        if (set.reps !== undefined) {
          // Validate reps
          if (typeof set.reps !== 'number' || isNaN(set.reps)) {
            throw new Error('Reps must be a valid number');
          }
          if (set.reps < 0) {
            throw new Error('Reps cannot be negative');
          }
          
          totalVolume += (userBodyweight * factor + added) * set.reps;
        }
      }
    });

    return totalVolume;
  }

  /**
   * The volume of several exercises. Each one keeps the factor it carries or the catalogue gives it;
   * this method never substitutes a table of its own.
   */
  static calculateTotalVolume(exercises, userBodyweight) {
    if (!Array.isArray(exercises)) {
      return 0;
    }

    let totalVolume = 0;

    exercises.forEach(exercise => {
      totalVolume += this.calculateExerciseVolume(exercise, userBodyweight);
    });

    return totalVolume;
  }
}

module.exports = VolumeCalculator;