const fs = require('fs').promises;
const path = require('path');

// Migration script to convert old data format to new PRD-compliant format
async function migrateData() {
  try {
    // Read all user files from data directory
    const dataDir = path.join(__dirname, 'data');
    const files = await fs.readdir(dataDir);

    // Filter for JSON files
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(dataDir, file);
      const data = await fs.readFile(filePath, 'utf8');
      const userData = JSON.parse(data);

      // Check if this is old format data
      if (userData.workouts && Array.isArray(userData.workouts)) {
        console.log(`Migrating data for user: ${file}`);

        // Convert to new format
        const newData = migrateWorkoutData(userData);

        // Write back to file
        await fs.writeFile(filePath, JSON.stringify(newData, null, 2));
        console.log(`Successfully migrated: ${file}`);
      }
    }

    console.log('Data migration completed successfully!');
  } catch (error) {
    console.error('Error during data migration:', error);
  }
}

function migrateWorkoutData(oldData) {
  // Create new training plan structure
  const trainingPlan = {
    id: `${oldData.userId}-plan-${Date.now()}`,
    name: 'Migrated Training Plan',
    start_date: new Date().toISOString(),
    weeks: []
  };

  // Group workouts by week (simple approach - one week per workout)
  oldData.workouts.forEach((workout, index) => {
    const week = {
      week_number: index + 1,
      days: [
        {
          id: `day-${index + 1}`,
          name: workout.name || `Day ${index + 1}`,
          day_type: 'STANDARD',
          exercises: []
        }
      ]
    };

    // Convert exercises
    workout.exercises.forEach(exercise => {
      const newExercise = {
        id: `exercise-${Math.random().toString(36).substr(2, 9)}`,
        name: exercise.name,
        exercise_type: exercise.weight && exercise.weight > 0 ? 'WEIGHTED' : 'BODYWEIGHT',
        target_sets: exercise.sets || 3,
        target_reps: exercise.reps || 10,
        completed_sets: []
      };

      // For weighted exercises, create completed sets
      if (newExercise.exercise_type === 'WEIGHTED') {
        for (let i = 0; i < newExercise.target_sets; i++) {
          newExercise.completed_sets.push({
            reps: newExercise.target_reps,
            weight: exercise.weight || 0
          });
        }
      } else {
        // For bodyweight exercises
        newExercise.bodyweight_load_percentage = 0.75; // Default
        for (let i = 0; i < newExercise.target_sets; i++) {
          newExercise.completed_sets.push({
            reps: newExercise.target_reps
          });
        }
      }

      week.days[0].exercises.push(newExercise);
    });

    trainingPlan.weeks.push(week);
  });

  return trainingPlan;
}

// Run migration if called directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };