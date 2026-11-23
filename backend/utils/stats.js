/**
 * What the journal says about a stretch of time: sets, reps, and the weight each exercise carried.
 *
 * Ilja, 2026-11-22: the dashboard answers «how many sets, how many reps, what weight» — an exercise's
 * own working weight, not tonnage, and not a split per muscle group. One rule for the count: a set is
 * one set. A circuit is endurance work and stays out of the figures, so an AMRAP round never reads as
 * a set here.
 *
 * Ilja, 2026-11-22, second pass: a period is a block of four weeks or of four months, and every number
 * carries its difference against the block before it — four weeks against the four weeks before, four
 * months against the four months before. A block is a rolling window that ends now, so the block on
 * the screen is the one he is training in.
 */
const catalogue = require('./exerciseCatalogue');
const MuscleVolume = require('./muscleVolume');

const DAY_MS = 24 * 60 * 60 * 1000;

/** The blocks the screen offers, in days. Four weeks is a training block; four months is a season. */
const PERIODS = { '4w': 28, '4m': 120 };
const DEFAULT_PERIOD = '4w';

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** The length of a named block in days, or `null` when the name is not one of them. */
function periodDays(period) {
  const days = PERIODS[String(period || '').trim()];
  return typeof days === 'number' ? days : null;
}

/** A window of `days` that ends at `end`. */
function windowFor(end, days) {
  const to = new Date(end.getTime());
  const from = new Date(to.getTime() - days * DAY_MS);
  return { from, to };
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
 * Sets, reps and weights of every exercise inside one window.
 * @returns {{sessions: number, sets: number, reps: number, exercises: Map}}
 */
function collect(sessions, window, wantedUser) {
  const rows = new Map();
  let counted = 0;
  let setsTotal = 0;
  let repsTotal = 0;

  for (const session of MuscleVolume.sessionList(sessions)) {
    if (wantedUser && String(session.userId || '') !== wantedUser) continue;
    const date = MuscleVolume.sessionDate(session);
    // A window holds its end and not its beginning, so two neighbouring blocks never count one session twice.
    if (!date || date <= window.from || date > window.to) continue;
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

  return { sessions: counted, sets: setsTotal, reps: repsTotal, exercises: rows };
}

/** The difference between two numbers, or `null` when one of them is missing. */
function difference(now, before) {
  if (now === null || now === undefined || before === null || before === undefined) return null;
  return round1(now - before);
}

/**
 * @param {Array|Object} sessions - the journal, as stored
 * @param {{period?: string, userId?: string, now?: string|Date}} [options]
 * @returns {null|object} - `null` for a block the app does not offer
 */
function statsFor(sessions, options = {}) {
  const period = String(options.period || DEFAULT_PERIOD).trim();
  const days = periodDays(period);
  // The caller refuses an unknown block; this is the second lock on the same door.
  if (days === null) return null;

  const now = options.now ? new Date(options.now) : new Date();
  const wantedUser = options.userId ? String(options.userId) : '';

  const current = windowFor(now, days);
  // The block before this one: the same length, ending where this one begins.
  const earlier = windowFor(current.from, days);

  const today = collect(sessions, current, wantedUser);
  const before = collect(sessions, earlier, wantedUser);

  const exercises = [...today.exercises.values()]
    .map((row) => {
      const was = before.exercises.get(row.name.trim().toLowerCase());
      return {
        name: row.name,
        sets: row.sets,
        reps: round1(row.reps),
        bodyweight: row.bodyweight,
        top_weight: row.top_weight === null ? null : round1(row.top_weight),
        last_weight: row.last_weight === null ? null : round1(row.last_weight),
        // A movement the earlier block never carried has nothing to compare with.
        compared: Boolean(was),
        delta_sets: was ? difference(row.sets, was.sets) : null,
        delta_reps: was ? difference(row.reps, was.reps) : null,
        delta_top_weight: was ? difference(row.top_weight, was.top_weight) : null
      };
    })
    // The exercise with the most work first: the list answers «what did I do», not «what is its name».
    .sort((a, b) => b.sets - a.sets || b.reps - a.reps || a.name.localeCompare(b.name));

  return {
    period,
    days,
    from: current.from.toISOString().slice(0, 10),
    to: current.to.toISOString().slice(0, 10),
    before_from: earlier.from.toISOString().slice(0, 10),
    before_to: earlier.to.toISOString().slice(0, 10),
    sessions: today.sessions,
    sets: today.sets,
    reps: round1(today.reps),
    delta_sessions: difference(today.sessions, before.sessions),
    delta_sets: difference(today.sets, before.sets),
    delta_reps: difference(today.reps, before.reps),
    exercises
  };
}

module.exports = { statsFor, periodDays, PERIODS, DEFAULT_PERIOD };
