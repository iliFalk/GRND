/**
 * What one finished session is worth, from the sets that were actually done.
 *
 * The route used to build an object with `sets: 3` and an average rep count and hand it to the
 * calculator, which reads `exercise_type` and `completed_sets` — so every saved session carried a
 * volume of 0. The work is done here, where a test can reach it without a server.
 */
const VolumeCalculator = require('./volumeCalculator');
const catalogue = require('./exerciseCatalogue');

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** The sets of one exercise, whichever of the three names the caller used. */
function completedSets(exercise) {
  if (Array.isArray(exercise && exercise.completed_sets)) return exercise.completed_sets;
  if (Array.isArray(exercise && exercise.sets)) return exercise.sets;
  return [];
}

/**
 * A bodyweight exercise is one the catalogue gives a factor; every other exercise is weighted.
 * An explicit type on the exercise wins over the catalogue.
 */
function exerciseType(exercise) {
  const explicit = exercise.exerciseType || exercise.exercise_type;
  if (explicit === 'BODYWEIGHT' || explicit === 'WEIGHTED') return explicit;
  return catalogue.bodyweightFactor(exercise) === undefined ? 'WEIGHTED' : 'BODYWEIGHT';
}

/**
 * @param {object[]} exercises - the completed exercises of one session
 * @param {number} [bodyweight] - the user's bodyweight in kg, needed for bodyweight work
 * @returns {{exercises: object[], totalVolume: number, totalSets: number}}
 * @throws when a bodyweight exercise has no bodyweight to count with
 */
function computeSessionVolume(exercises, bodyweight) {
  const list = Array.isArray(exercises) ? exercises : [];
  let totalVolume = 0;
  let totalSets = 0;

  const done = list.map((exercise) => {
    const sets = completedSets(exercise);
    const type = exerciseType(exercise);
    const volume = VolumeCalculator.calculateExerciseVolume(
      {
        exercise_type: type,
        exerciseId: exercise.exerciseId || exercise.exercise_id,
        exercise_name: exercise.name || exercise.exercise_name,
        bodyweight_load_percentage: exercise.bodyweight_load_percentage,
        completed_sets: sets
      },
      bodyweight
    );

    totalVolume += volume;
    totalSets += sets.length;

    return { ...exercise, exerciseType: type, volume: round1(volume) };
  });

  return { exercises: done, totalVolume: round1(totalVolume), totalSets };
}

module.exports = { computeSessionVolume, exerciseType, completedSets };
