/**
 * Volume Calculator Utility for Backend
 * Provides functions for calculating workout volume according to PRD requirements
 */
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
      } else if (exercise.exercise_type === 'BODYWEIGHT' && userBodyweight) {
        // Bodyweight exercise: Set Volume = user_bodyweight × bodyweight_load_percentage × reps_completed
        const loadPercentage = exercise.bodyweight_load_percentage !== undefined
          ? exercise.bodyweight_load_percentage
          : 1;
        if (set.reps !== undefined) {
          // Validate reps
          if (typeof set.reps !== 'number' || isNaN(set.reps)) {
            throw new Error('Reps must be a valid number');
          }
          if (set.reps < 0) {
            throw new Error('Reps cannot be negative');
          }
          
          totalVolume += userBodyweight * loadPercentage * set.reps;
        }
      }
    });

    return totalVolume;
  }

  /**
   * Calculate total volume for multiple exercises
   * @param {Array} exercises - Array of exercise objects
   * @param {number} userBodyweight - User's bodyweight in kg
   * @returns {number} - Total volume for all exercises in kg
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

  /**
   * Get default bodyweight load percentages for common exercises
   * @returns {Object} - Object mapping exercise names to default load percentages
   */
  static getDefaultBodyweightLoadPercentages() {
    return {
      'Push-ups': 0.75, // 75% bodyweight
      'Pull-ups': 1.0,  // 100% bodyweight
      'Squats': 0.85,   // 85% bodyweight
      'Lunges': 0.7,    // 70% bodyweight
      'Dips': 0.8,      // 80% bodyweight
      'Plank': 0.5,     // 50% bodyweight (approximation)
      'Burpees': 1.0,   // 100% bodyweight
      'Mountain Climbers': 0.6, // 60% bodyweight
      'Bodyweight Rows': 0.9, // 90% bodyweight
      'Calisthenics': 0.8 // 80% bodyweight
    };
  }
}

module.exports = VolumeCalculator;