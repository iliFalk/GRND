/**
 * The block grid: four weeks of work, four blocks in a cycle, and what one block is worth.
 *
 * Ilja, 2026-11-23: one anchor fixes the whole grid, so every session knows its block and its week
 * without a second record. Inside a block a week is compared with the week before it; a block is
 * compared with the block before it, and only once it is closed — an open block always reads low.
 *
 * Two numbers per block, because they move apart (Ilja, 2026-11-23):
 *   WORK — every set of the block, in kilograms, times the effort factor;
 *   PEAK — the best single set of each exercise, so volume cannot hide a falling top set.
 *
 * Ilja, 2026-11-23 on the effort factor: one tap after a session, in words, never a fraction on the
 * screen. To failure counts in full, one or two left is 90 per cent, three or more is 70 per cent.
 */
const fs = require('fs');
const path = require('path');

const catalogue = require('./exerciseCatalogue');
const MuscleVolume = require('./muscleVolume');
const { pillarForMovement } = require('./pillars');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DAY_MS = 24 * 60 * 60 * 1000;

/** The effort of a session as it is asked, with the word that stands on the screen. */
const EFFORT = {
  failure: { factor: 1, percent: 100, label: 'to failure' },
  near: { factor: 0.9, percent: 90, label: '1–2 left' },
  easy: { factor: 0.7, percent: 70, label: '3 or more left' }
};

const DEFAULT_CONFIG = { anchor: '2026-11-23', block_days: 28, blocks_per_cycle: 4 };

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch (error) {
    console.warn(`period: cannot read ${name}: ${error.message}`);
    return fallback;
  }
}

/** The pillars, in the order the screen shows them. */
function pillarRows() {
  const table = readJson('pillars.json', { pillars: [] });
  return Array.isArray(table.pillars) ? table.pillars : [];
}

function config() {
  const loaded = readJson('periodization.json', {});
  const anchor = new Date(String(loaded.anchor || DEFAULT_CONFIG.anchor));
  return {
    anchor: Number.isNaN(anchor.getTime()) ? new Date(DEFAULT_CONFIG.anchor) : anchor,
    blockDays: Number(loaded.block_days) > 0 ? Number(loaded.block_days) : DEFAULT_CONFIG.block_days,
    blocksPerCycle: Number(loaded.blocks_per_cycle) > 0 ? Number(loaded.blocks_per_cycle) : DEFAULT_CONFIG.blocks_per_cycle
  };
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function median(values) {
  const list = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (list.length === 0) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 === 1 ? list[middle] : round1((list[middle - 1] + list[middle]) / 2);
}

/**
 * The factor a set carries: the tap of its exercise, else the tap of its session, else full weight.
 * Ilja, 2026-11-23: the tap is per exercise, and a skipped tap is an allowance, not a discount.
 */
function effortOf(session, exercise) {
  const own = String(exercise && exercise.effort ? exercise.effort : '').trim();
  const whole = String(session && session.effort ? session.effort : '').trim();
  return EFFORT[own] || EFFORT[whole] || { factor: 1, percent: 100, label: null };
}

/** Where a date sits in the grid: the block, the week inside it, and the block's bounds. */
function blockFor(date, settings) {
  const at = new Date(date);
  const { anchor, blockDays } = settings;
  const dayIndex = Math.floor((at.getTime() - anchor.getTime()) / DAY_MS);
  const block = Math.floor(dayIndex / blockDays);
  const dayInBlock = dayIndex - block * blockDays;
  const week = Math.floor(dayInBlock / 7) + 1;
  const start = new Date(anchor.getTime() + block * blockDays * DAY_MS);
  const end = new Date(start.getTime() + blockDays * DAY_MS);
  return { block, week, dayInBlock, start, end };
}

/** The pillar a movement belongs to, or `null` when no pillar claims it. */
function pillarIdOf(exercise) {
  const entry = catalogue.entryFor(exercise);
  if (!entry) return null;
  const pillar = pillarForMovement(entry.movement, pillarRows());
  return pillar ? pillar.id : null;
}

/** The kilograms one set carries: the bell, plus the body the movement lifts. */
function setLoad(exercise, set, bodyweight) {
  const weight = Number(set && set.weight);
  const load = Number.isFinite(weight) && weight > 0 ? weight : 0;
  const factor = catalogue.bodyweightFactor(exercise);
  if (factor === undefined) return load;
  const body = Number(bodyweight);
  if (!Number.isFinite(body)) return load;
  return body * factor + load;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Everything one block is worth.
 * @returns {{work: number, sessions: number, sets: number, reps: number, peak: Map, days: Map}}
 */
function blockTotals(sessions, bounds, options) {
  const wantedUser = options.userId ? String(options.userId) : '';
  const bodyweight = options.bodyweight;
  const peak = new Map();
  const rows = new Map();
  const days = new Map();
  let work = 0;
  let counted = 0;
  let sets = 0;
  let reps = 0;

  for (const session of MuscleVolume.sessionList(sessions)) {
    if (wantedUser && String(session.userId || '') !== wantedUser) continue;
    const date = MuscleVolume.sessionDate(session);
    if (!date || date < bounds.start || date >= bounds.end) continue;
    if (MuscleVolume.isCircuit(session)) continue;

    let worked = 0;
    let sessionWork = 0;

    for (const exercise of session.completedExercises || session.exercises || []) {
      const effort = effortOf(session, exercise).factor;
      const list = Array.isArray(exercise.completed_sets) ? exercise.completed_sets : [];
      for (const set of list) {
        // A warm-up set is not work: it is not counted, not weighed and not the peak.
        if (!set || set.warmup === true) continue;
        const reps_ = Number(set.reps);
        const count = Number.isFinite(reps_) ? reps_ : 0;
        const load = setLoad(exercise, set, bodyweight);
        const value = load * count * effort;

        work += value;
        sessionWork += value;
        sets += 1;
        reps += count;
        worked += 1;

        const label = String(
          (catalogue.entryFor(exercise) || {}).name || exercise.name || exercise.exercise_name || ''
        ).trim();
        const name = label.toLowerCase();
        if (!name) continue;
        peak.set(name, Math.max(peak.get(name) || 0, load * count));

        const row = rows.get(name) || {
          name: label,
          sets: 0,
          reps: 0,
          top: 0,
          bodyweight: catalogue.bodyweightFactor(exercise) !== undefined,
          pillar: pillarIdOf(exercise)
        };
        row.sets += 1;
        row.reps += count;
        const weight = Number(set && set.weight);
        if (Number.isFinite(weight) && weight > row.top) row.top = weight;
        rows.set(name, row);
      }
    }

    if (worked > 0) {
      counted += 1;
      const key = dayKey(date);
      days.set(key, (days.get(key) || 0) + sessionWork);
    }
  }

  return { work: round1(work), sessions: counted, sets, reps, peak, rows, days };
}

/** Mean over standard deviation of a week's daily load: how identical the days are. */
function monotonyOf(days) {
  const values = [...days.values()];
  if (values.length < 3) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  return deviation === 0 ? null : round1(mean / deviation);
}

/** A block is worth comparing only once its end is behind us; the open one always reads low. */
function isClosed(bounds, now) {
  return bounds.end <= now;
}

/**
 * The report the dashboard draws: the current block with its four weeks, the closed blocks before it,
 * and the difference of this block against the last closed one.
 *
 * @param {Array|Object} sessions - the journal
 * @param {{userId?: string, bodyweight?: number, now?: string|Date}} [options]
 */
function blockReport(sessions, options = {}) {
  const settings = config();
  const now = options.now ? new Date(options.now) : new Date();
  const optionsFor = { userId: options.userId, bodyweight: options.bodyweight };

  const current = blockFor(now, settings);
  const currentTotals = blockTotals(sessions, current, optionsFor);

  // The weeks of the current block, each with its own work and the change against the week before it.
  const weeks = [];
  for (let index = 0; index < 4; index += 1) {
    const start = new Date(current.start.getTime() + index * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const totals = blockTotals(sessions, { start, end }, optionsFor);
    const previous = weeks[index - 1];
    weeks.push({
      week: index + 1,
      from: dayKey(start),
      to: dayKey(new Date(end.getTime() - 1)),
      closed: end <= now,
      started: start <= now,
      work: totals.work,
      sessions: totals.sessions,
      sets: totals.sets,
      reps: totals.reps,
      // A week still running always reads low: its change appears once the week is over.
      change:
        previous && previous.work > 0 && end <= now
          ? round1((totals.work / previous.work - 1) * 100)
          : null
    });
  }

  // The closed blocks before this one, newest first: the base is the last of them.
  const closed = [];
  for (let back = 1; back <= 4; back += 1) {
    const bounds = {
      start: new Date(current.start.getTime() - back * settings.blockDays * DAY_MS),
      end: new Date(current.start.getTime() - (back - 1) * settings.blockDays * DAY_MS)
    };
    const totals = blockTotals(sessions, bounds, optionsFor);
    closed.push({
      block: current.block - back,
      from: dayKey(bounds.start),
      to: dayKey(new Date(bounds.end.getTime() - 1)),
      work: totals.work,
      sessions: totals.sessions,
      sets: totals.sets,
      reps: totals.reps,
      peak: totals.peak,
      rows: totals.rows,
      closed: isClosed(bounds, now)
    });
  }
  const base = closed.find((block) => block.closed && block.work > 0) || null;
  const baseWeek = base ? base.work / (settings.blockDays / 7) : null;
  // A block is compared per week of work it has actually covered. An open block read as a full block
  // always answers a quarter, so its number is a pace, not a level — and the screen says which.
  const elapsedDays = Math.min(
    settings.blockDays,
    Math.max(7, (Math.min(now.getTime(), current.end.getTime()) - current.start.getTime()) / DAY_MS)
  );
  const currentWeek = currentTotals.work / (elapsedDays / 7);

  // The peak axis: the best set of every exercise that both blocks carried.
  const peakChanges = [];
  if (base) {
    for (const [name, value] of currentTotals.peak) {
      const before = base.peak.get(name);
      if (before && before > 0) peakChanges.push((value / before - 1) * 100);
    }
  }
  const peakIndex = peakChanges.length > 0 ? round1(median(peakChanges) + 100) : null;
  // The tally makes the peak concrete: how many exercises moved up, down, or not at all.
  const peakUp = peakChanges.filter((change) => change > 1).length;
  const peakDown = peakChanges.filter((change) => change < -1).length;

  // The rows the panel lists: one per exercise of this block, with the change against the base.
  const exercises = [...currentTotals.rows.entries()]
    .map(([key, row]) => {
      const was = base ? base.rows.get(key) : null;
      return {
        name: row.name,
        pillar: row.pillar,
        sets: row.sets,
        reps: round1(row.reps),
        bodyweight: row.bodyweight,
        top_weight: row.top > 0 ? round1(row.top) : null,
        compared: Boolean(was),
        delta_sets: was ? row.sets - was.sets : null,
        delta_reps: was ? round1(row.reps - was.reps) : null,
        delta_top_weight: was && row.top > 0 && was.top > 0 ? round1(row.top - was.top) : null
      };
    })
    .sort((a, b) => b.sets - a.sets || b.reps - a.reps || a.name.localeCompare(b.name));
  const workIndex =
    baseWeek && baseWeek > 0 && currentTotals.work > 0 ? round1((currentWeek / baseWeek) * 100) : null;

  // Ilja, 2026-11-23: three words, one rule each. One axis up without the other falling is progress;
  // both inside 95–105 is a plateau; either below 95 is a regression.
  let verdict = 'open';
  if (workIndex !== null) {
    const peakDown = peakIndex !== null && peakIndex < 95;
    const workDown = workIndex < 95;
    const workUp = workIndex > 105;
    const peakUp = peakIndex !== null && peakIndex > 105;

    if (peakDown || workDown) verdict = 'regress';
    else if (workUp || peakUp) verdict = 'progress';
    else verdict = 'plateau';
  }

  // Two blocks at the same level in a row is a plateau, not a rest: the same stimulus stops paying.
  // Measured over the closed blocks only — the open block is not a level, it is a fragment.
  const previousClosed = closed.find((block) => block.closed && block.work > 0) || null;
  const beforePrevious = closed.find((block) => block.closed && block !== previousClosed && block.work > 0) || null;
  const previousIndex =
    previousClosed && beforePrevious && beforePrevious.work > 0
      ? round1((previousClosed.work / beforePrevious.work) * 100)
      : null;
  const plateau =
    verdict === 'hold' && previousIndex !== null && previousIndex >= 95 && previousIndex <= 105;

  // The newest session of this account: the one the effort tap belongs to, until it carries one.
  let last = null;
  for (const session of MuscleVolume.sessionList(sessions)) {
    if (options.userId && String(session.userId || '') !== String(options.userId)) continue;
    if (MuscleVolume.isCircuit(session)) continue;
    const date = MuscleVolume.sessionDate(session);
    if (!date) continue;
    if (!last || date > last.at) {
      last = { at: date, id: String(session.id || ''), effort: String(session.effort || '') };
    }
  }

  return {
    anchor: dayKey(settings.anchor),
    last_session: last ? { id: last.id, date: dayKey(last.at), effort: last.effort || null } : null,
    block: current.block,
    week: current.week,
    from: dayKey(current.start),
    to: dayKey(new Date(current.end.getTime() - 1)),
    closed: isClosed(current, now),
    weeks,
    work: currentTotals.work,
    sessions: currentTotals.sessions,
    sets: currentTotals.sets,
    reps: currentTotals.reps,
    exercises,
    work_index: workIndex,
    measured: isClosed(current, now) ? 'level' : 'pace',
    peak_index: peakIndex,
    peak_up: peakUp,
    peak_down: peakDown,
    peak_total: peakChanges.length,
    verdict,
    plateau,
    base: base
      ? { block: base.block, from: base.from, to: base.to, work: base.work, week_mean: round1(baseWeek) }
      : null,
    before: closed.map(({ peak, rows, ...rest }) => rest),
    monotony: monotonyOf(currentTotals.days)
  };
}

module.exports = { blockReport, blockFor, blockTotals, effortOf, config, EFFORT };
