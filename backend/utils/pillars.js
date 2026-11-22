/**
 * Weekly work per ability, not per muscle.
 *
 * Ilja, 2026-11-19: the block is functional and multi-joint, so a single link is not measured. A set
 * counts ONCE for the pillar its movement belongs to — three sets of pull-ups are three, not three
 * of back plus one and a half of biceps. The mapping and the bands live in `data/pillars.json`;
 * conditioning (burpees) is endurance and belongs to the circuit, not here.
 */
const fs = require('fs');
const path = require('path');

const MuscleVolume = require('./muscleVolume');
const catalogue = require('./exerciseCatalogue');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch (error) {
    console.warn(`pillars: cannot read ${name}: ${error.message}`);
    return fallback;
  }
}

function table() {
  return readJson('pillars.json', { pillars: [], outside: {} });
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** The pillar a movement belongs to, or `null` when no pillar claims it. */
function pillarForMovement(movement, rows) {
  const wanted = String(movement || '').trim().toLowerCase();
  if (!wanted) return null;
  return rows.find((row) => (row.movements || []).map((entry) => String(entry).toLowerCase()).includes(wanted)) || null;
}

/**
 * @param {Array|Object} sessions - the sessions of a user
 * @param {{week?: string, userId?: string}} [options]
 * @returns {{week_start: string, week_end: string, sessions: number, pillars: Array,
 *   outside: Array, unmapped: Array}}
 */
function weeklyPillars(sessions, options = {}) {
  const config = table();
  const rows = Array.isArray(config.pillars) ? config.pillars : [];
  if (rows.length === 0) {
    // The volume carries the seed of data/, so a new data file is not in it until it is copied.
    console.warn('pillars: data/pillars.json carries no pillars — no set can be placed in one');
  }
  const bounds = MuscleVolume.weekBounds(options.week);
  const wantedUser = options.userId ? String(options.userId) : '';

  const totals = new Map();
  for (const row of rows) {
    // A set counts once for the pillar; the base and the power work inside it are counted again
    // under their own name, so a tile can say "12 sets, 8 of them base".
    totals.set(row.id, { sets: 0, base_sets: 0, power_sets: 0, exercises: [] });
  }

  const outside = {};
  const unmapped = {};
  const circuits = [];
  let counted = 0;

  // The week by day, so the dashboard can draw what each day carried.
  const days = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), bounds.start.getDate() + offset);
    days.push({ date: day.toISOString().slice(0, 10), sets: 0, pillars: {} });
  }
  const dayOf = new Map(days.map((day) => [day.date, day]));

  for (const session of MuscleVolume.sessionList(sessions)) {
    if (wantedUser && String(session.userId || '') !== wantedUser) continue;
    const date = MuscleVolume.sessionDate(session);
    if (!date || date < bounds.start || date >= bounds.end) continue;

    // The circuit is endurance work: it never lands in a pillar, it is reported beside them.
    if (MuscleVolume.isCircuit(session)) {
      const rounds = (session.completedExercises || session.exercises || []).reduce(
        (most, exercise) => Math.max(most, MuscleVolume.setCount(exercise)),
        0
      );
      if (rounds === 0) continue;
      counted += 1;
      circuits.push({
        date: date.toISOString().slice(0, 10),
        rounds,
        time_under_load: Number(session.duration) > 0 ? Math.round(Number(session.duration)) : 0,
        exercises: (session.completedExercises || session.exercises || [])
          .map((exercise) => exercise.name || exercise.exercise_name || '')
          .filter((name) => name !== '')
      });
      continue;
    }

    let worked = 0;
    for (const exercise of session.completedExercises || session.exercises || []) {
      const sets = MuscleVolume.setCount(exercise);
      if (!sets) continue;

      const name = exercise.name || exercise.exercise_name || '';
      const entry = catalogue.entryFor(exercise);
      if (!entry) {
        unmapped[name || '(unnamed)'] = (unmapped[name || '(unnamed)'] || 0) + sets;
        continue;
      }

      // An exercise the catalogue excludes is not counted in a pillar, though it stays pickable.
      const pillar = entry.excluded === true ? null : pillarForMovement(entry.movement, rows);
      if (!pillar) {
        outside[name || '(unnamed)'] = (outside[name || '(unnamed)'] || 0) + sets;
        continue;
      }

      const row = totals.get(pillar.id);
      row.sets += sets;

      const day = dayOf.get(date.toISOString().slice(0, 10));
      if (day) {
        day.sets += sets;
        day.pillars[pillar.id] = (day.pillars[pillar.id] || 0) + sets;
      }

      if (entry.role === 'base') row.base_sets += sets;
      if (entry.power === true) row.power_sets += sets;
      row.exercises.push({
        name: entry.name,
        sets,
        role: entry.role === 'base' ? 'base' : 'support',
        power: entry.power === true
      });
      worked += sets;
    }

    if (worked > 0) counted += 1;
  }

  const pillars = rows.map((row) => {
    const value = totals.get(row.id) || { sets: 0, base_sets: 0, power_sets: 0, exercises: [] };
    // A floor, not a band: below the floor the pillar is short, above it nothing is judged.
    const target = {
      min: row.min,
      target_low: row.min,
      target_high: row.target_high ?? null,
      max: row.max ?? null
    };
    const sets = round1(value.sets);

    return {
      id: row.id,
      label: row.label || row.id,
      movements: row.movements || [],
      // The muscle groups the pillar rests on; the screen orders its list by them.
      groups: row.groups || [],
      sets,
      base_sets: round1(value.base_sets),
      power_sets: round1(value.power_sets),
      target,
      status: MuscleVolume.statusFor(sets, target),
      short: round1(Math.max(0, (Number(row.min) || 0) - sets)),
      exercises: value.exercises
    };
  });

  return {
    week_start: bounds.start.toISOString().slice(0, 10),
    week_end: new Date(bounds.end.getTime() - 1).toISOString().slice(0, 10),
    sessions: counted,
    pillars,
    days,
    circuits,
    circuit_rounds: circuits.reduce((sum, circuit) => sum + circuit.rounds, 0),
    outside: Object.entries(outside).map(([name, sets]) => ({ name, sets })),
    unmapped: Object.entries(unmapped).map(([name, sets]) => ({ name, sets }))
  };
}

module.exports = { weeklyPillars, pillarForMovement };
