/**
 * Bodyweight Load Percentage Table
 * Provides default bodyweight load percentages for common exercises
 */

export const bodyweightLoadTable = {
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

/**
 * Get bodyweight load percentage for an exercise
 * @param {string} exerciseName - Name of the exercise
 * @returns {number} - Bodyweight load percentage (default: 1.0)
 */
export function getBodyweightLoadPercentage(exerciseName) {
    return bodyweightLoadTable[exerciseName] || 1.0;
}