/**
 * What the journal says about a stretch of time: sets, reps, and the weight each exercise carried.
 *
 * Ilja, 2026-11-22: the dashboard answers «how many sets, how many reps, what weight» — an exercise's
 * own working weight, not tonnage, and not a split per muscle group. One rule for the count: a set is
 * one set. A circuit is endurance work and stays out of the figures, so an AMRAP round never reads as
 * a set here.
 *
 * The period is a rolling window that ends now, in days. A calendar period would read zero on the
 * first day of a month, and the screen exists to show the work that happened.
 */
const catalogue = require('./exerciseCatalogue');
const MuscleVolume = require('./muscleVolume');

const DAY_MS = 24 * 60 * 60 * 1000;

/** The periods the screen offers, named as the app names them, in days back from now. */
const PERIODS = { week: 7, month: 30, '3m': 90, '6m': 180, y: 365 };
const DEFAULT_PERIOD = 'month';

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** The length of a named period in days, or `null` when the name is not one of them. */
function periodDays(period) {
  const days = PERIODS[String(period || '').trim()];
  return typeof days === 'number' ? days : null;
}

/** A window of `days` that ends at `now`. */
function windowFor(days, now) {
  const end = new Date(now.getTime());
  const start = new Date(end.getTime() - days * DAY_MS);
  return { start, end };
}

/** The sets of one exercise that are work: a warm-up is not. */
function workSets(exercise) {
  const list = Array.isArray(exercise && exercise.completed_sets) ? exercise.completed_sets : [];
  return list.filter((set) => set && set.warmup !== true);
}

/** Whether the body carries the load. An explicit type on the exercise wins over the catalogue. */
function isBodyweight(exercise) {
  const explicit = exercise.exerciseType || exercise.exercise_type;
  if (explicit === 'BODYWEIGHT' || explicit === 'WEIGHTED') return explicit === 'BODYWEIGHT';
  return catalogue.bodyweightFactor(exercise) !== undefined;
}

/**
 * @param {Array|Object} sessions - the journal, as stored
 * @param {{period?: string, userId?: string, now?: string|Date}} [options]
 * @returns {null|{period: string, days: number, from: string, to: string, sessions: number,
 *   sets: number, reps: number, exercises: Array}} - `null` for a period the app does not offer
 */
function statsFor(sessions, options = {}) {
  const period = String(options.period || DEFAULT_PERIOD).trim();
  const days = periodDays(period);
  // The caller refuses an unknown period; this is the second lock on the same door.
  if (days === null) return null;

  const now = options.now ? new Date(options.now) : new Date();
  const { start, end } = windowFor(days, now);
  const wantedUser = options.userId ? String(options.userId) : '';

  const rows = new Map();
  let counted = 0;
  let setsTotal = 0;
  let repsTotal = 0;

  for (const session of MuscleVolume.sessionList(sessions)) {
    if (wantedUser && String(session.userId || '') !== wantedUser) continue;
    const date = MuscleVolume.sessionDate(session);
    if (!date || date < start || date > end) continue;
    // A circuit moves no set of this report: it is rounds and time under load.
    if (MuscleVolume.isCircuit(session)) continue;

    let worked = 0;
    for (const exercise of session.completedExercises || session.exercises || []) {
      const sets = workSets(exercise);
      if (sets.length === 0) continue;

      const stored = exercise.name || exercise.exercise_name || '';
      const entry = catalogue.entryFor(exercise);
      const name = (entry && entry.name) || stored || '(unnamed)';
      const key = name.trim().toLowerCase();

      let row = rows.get(key);
      if (!row) {
        row = {
          name,
          sets: 0,
          reps: 0,
          bodyweight: isBodyweight(exercise),
          top_weight: null,
          last_weight: null,
          last_at: 0
        };
        rows.set(key, row);
      }

      const reps = sets.reduce((sum, set) => {
        const value = Number(set.reps);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      row.sets += sets.length;
      row.reps += reps;

      for (const set of sets) {
        const weight = Number(set.weight);
        if (!Number.isFinite(weight) || weight <= 0) continue;
        if (row.top_weight === null || weight > row.top_weight) row.top_weight = weight;
      }

      // The working weight today: the final set of the latest session that carried this exercise.
      const stamp = date.getTime();
      if (stamp >= row.last_at) {
        const weight = Number(sets[sets.length - 1].weight);
        row.last_weight = Number.isFinite(weight) ? weight : null;
        row.last_at = stamp;
      }

      setsTotal += sets.length;
      repsTotal += reps;
      worked += sets.length;
    }

    if (worked > 0) counted += 1;
  }

  const exercises = [...rows.values()]
    .map((row) => ({
      name: row.name,
      sets: row.sets,
      reps: round1(row.reps),
      bodyweight: row.bodyweight,
      top_weight: row.top_weight === null ? null : round1(row.top_weight),
      last_weight: row.last_weight === null ? null : round1(row.last_weight)
    }))
    // The exercise with the most work first: the list answers «what did I do», not «what is its name».
    .sort((a, b) => b.sets - a.sets || b.reps - a.reps || a.name.localeCompare(b.name));

  return {
    period,
    days,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    sessions: counted,
    sets: setsTotal,
    reps: round1(repsTotal),
    exercises
  };
}

module.exports = { statsFor, periodDays, PERIODS, DEFAULT_PERIOD };
