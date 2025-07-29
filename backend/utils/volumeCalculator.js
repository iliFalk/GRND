/**
 * Volume Calculator Utility for Backend
 * Provides functions for calculating workout volume
 */
class VolumeCalculator {
  /**
   * Calculate volume for a single exercise
   * @param {Object} exercise - The exercise object
   * @param {number} exercise.sets - Number of sets
   * @param {number} exercise.reps - Number of reps
   * @param {number} [exercise.weight=0] - Weight used (for weighted exercises)
   * @param {boolean} [exercise.isBodyweight=false] - Whether exercise is bodyweight
   * @param {number} [userBodyweight=0] - User's bodyweight in kg (for bodyweight exercises)
   * @param {number} [bodyweightLoadPercentage=1] - Percentage of bodyweight used (for bodyweight exercises)
   * @returns {number} - Calculated volume
   */
  static calculateExerciseVolume(exercise, userBodyweight = 0, bodyweightLoadPercentage = 1) {
    if (!exercise || exercise.sets <= 0 || exercise.reps <= 0) {
      return 0;
    }

    let volume = 0;

    if (exercise.isBodyweight && userBodyweight > 0) {
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
   * @param {Object} [bodyweightLoadPercentages={}] - Object mapping exercise names to load percentages
   * @returns {number} - Total volume for all exercises
   */
  static calculateTotalVolume(exercises, userBodyweight = 0, bodyweightLoadPercentages = {}) {
    if (!Array.isArray(exercises)) {
      return 0;
    }

    let totalVolume = 0;

    exercises.forEach(exercise => {
      // Determine bodyweight load percentage for this exercise
      const loadPercentage = bodyweightLoadPercentages[exercise.name] !== undefined
        ? bodyweightLoadPercentages[exercise.name]
        : 1;

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