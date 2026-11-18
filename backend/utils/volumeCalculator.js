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
      } else if (exercise.exercise_type === 'BODYWEIGHT' && !userBodyweight) {
        // A silent zero reads as "no work". Without the bodyweight the volume cannot exist.
        throw new Error('user bodyweight is required for a bodyweight exercise');
      } else if (exercise.exercise_type === 'BODYWEIGHT') {
        // Bodyweight exercise: a load ADDED to the body counts with it.
        //   volume = (user_bodyweight × percentage + added_weight) × reps
        // A chin-up on rings at 80 kg with a 13 kg backpack is 93 kg per rep, not 80.
        // The factor comes from the exercise, else from the table by name, else 1.
        // Reading only the explicit field made a direct call count the whole bodyweight for Push-ups.
        const name = exercise.exercise_name || exercise.name || '';
        const table = VolumeCalculator.getDefaultBodyweightLoadPercentages();
        const loadPercentage = exercise.bodyweight_load_percentage !== undefined
          ? exercise.bodyweight_load_percentage
          : (table[name] !== undefined ? table[name] : 1);
        const added = typeof set.weight === 'number' && !isNaN(set.weight) && set.weight > 0 ? set.weight : 0;
        if (set.reps !== undefined) {
          // Validate reps
          if (typeof set.reps !== 'number' || isNaN(set.reps)) {
            throw new Error('Reps must be a valid number');
          }
          if (set.reps < 0) {
            throw new Error('Reps cannot be negative');
          }
          
          totalVolume += (userBodyweight * loadPercentage + added) * set.reps;
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
      // Get bodyweight load percentage from the hardcoded table
      const exerciseName = exercise.exercise_name || exercise.name || '';
      const bodyweightLoadPercentages = this.getDefaultBodyweightLoadPercentages();
      const loadPercentage = bodyweightLoadPercentages[exerciseName] || 1.0;

      // Update exercise to include the load percentage for calculation
      const exerciseWithLoadPercentage = {
        ...exercise,
        bodyweight_load_percentage: loadPercentage
      };

      totalVolume += this.calculateExerciseVolume(exerciseWithLoadPercentage, userBodyweight);
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