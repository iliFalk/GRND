/**
 * The catalogue is the single list of exercises: one id, one name, the equipment, the groups and
 * the default bodyweight factor. Nothing else may invent an exercise, a factor or a group.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'exercise-catalogue.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = Array.isArray(raw) ? raw : raw.exercises || [];
  } catch (error) {
    console.warn(`exerciseCatalogue: cannot read the catalogue: ${error.message}`);
    cache = [];
  }
  return cache;
}

/** Drops the cache; tests and a re-read after a deploy use it. */
function reset() {
  cache = null;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

/** The catalogue entry for an exercise selected by id, else by name. `null` when it is not there. */
function entryFor(exercise) {
  const wanted = normalize(
    exercise && (exercise.exerciseId || exercise.exercise_id || exercise.name || exercise.exercise_name)
  );
  if (!wanted) return null;

  const entries = load();
  return (
    entries.find((entry) => normalize(entry.id) === wanted) ||
    entries.find((entry) => normalize(entry.name) === wanted) ||
    null
  );
}

/** The bodyweight factor the catalogue carries, or `undefined` when it carries none. */
function bodyweightFactor(exercise) {
  const entry = entryFor(exercise);
  return entry && typeof entry.bodyweight_factor === 'number' ? entry.bodyweight_factor : undefined;
}

module.exports = { load, reset, entryFor, bodyweightFactor };
