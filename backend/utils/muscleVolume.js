/**
 * Weekly sets per muscle group.
 *
 * The app counted kilograms; kilograms say nothing about whether a muscle group got enough work.
 * This engine answers the training question: how many working sets landed on each group in one week,
 * and where that number sits against the evidence-based band in `data/weekly-targets.json`.
 *
 * Counting rule (one word, one meaning):
 *   - a set counts 1.0 for every primary group of its exercise;
 *   - a set counts 0.5 for every secondary group;
 *   - a set is a completed set, or one completed round of a circuit;
 *   - a warm-up set is not counted, because it is not marked as work.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch (error) {
    console.warn(`muscleVolume: cannot read ${name}: ${error.message}`);
    return fallback;
  }
}

class MuscleVolume {
  static taxonomy() {
    return readJson('exercise-taxonomy.json', { groups: [], credit: { primary: 1, secondary: 0.5 }, exercises: {}, fallback: [] });
  }

  static targets() {
    return readJson('weekly-targets.json', { default: { min: 10, target_low: 10, target_high: 20, max: 25 }, groups: {} });
  }

  static normalizeName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Which groups an exercise works, and whether the taxonomy recognised it.
   * An explicit entry wins; a keyword fallback comes next; anything else is unmapped and is reported,
   * never counted into a group it may not belong to.
   */
  static resolve(name, taxonomy = MuscleVolume.taxonomy()) {
    const wanted = MuscleVolume.normalizeName(name);
    const entries = taxonomy.exercises || {};
    for (const [key, value] of Object.entries(entries)) {
      if (MuscleVolume.normalizeName(key) === wanted) {
        return { mapped: true, via: 'name', primary: value.primary || [], secondary: value.secondary || [], equipment: value.equipment || 'any' };
      }
    }
    for (const rule of taxonomy.fallback || []) {
      if (wanted.includes(String(rule.pattern).toLowerCase())) {
        return { mapped: true, via: `pattern:${rule.pattern}`, primary: rule.primary || [], secondary: rule.secondary || [], equipment: rule.equipment || 'any' };
      }
    }
    return { mapped: false, via: 'none', primary: [], secondary: [], equipment: 'unknown' };
  }

  /** Completed work of one exercise, as a count of sets. */
  static setCount(exercise) {
    const sets = Array.isArray(exercise.completed_sets) ? exercise.completed_sets.length : 0;
    const rounds = Array.isArray(exercise.completed_rounds) ? exercise.completed_rounds.length : 0;
    const plain = Array.isArray(exercise.sets) ? exercise.sets.length : 0;
    return sets + rounds + plain;
  }

  /** Monday 00:00 of the week that holds `date`, in local time. */
  static weekStart(date) {
    const at = new Date(date);
    const day = (at.getDay() + 6) % 7; // Monday is 0
    const start = new Date(at.getFullYear(), at.getMonth(), at.getDate() - day);
    return start;
  }

  static weekBounds(anyDate) {
    const start = MuscleVolume.weekStart(anyDate || new Date());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start, end };
  }

  /** The sessions of one user, from either `{sessions: []}` or a plain array. */
  static sessionList(sessions) {
    if (Array.isArray(sessions)) return sessions;
    if (sessions && Array.isArray(sessions.sessions)) return sessions.sessions;
    return [];
  }

  static sessionDate(session) {
    const raw = session.date || session.started_at || session.createdAt || session.created_at;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  /**
   * Sets per group for one week.
   *
   * @param {Array|Object} sessions - the sessions of a user
   * @param {Object} [options] - `week` (any date inside the wanted week) and `userId`
   * @returns {{week_start: string, week_end: string, groups: Array, unmapped: Array, sessions: number}}
   */
  static weeklyReport(sessions, options = {}) {
    const taxonomy = MuscleVolume.taxonomy();
    const credit = taxonomy.credit || { primary: 1, secondary: 0.5 };
    const targetTable = MuscleVolume.targets();
    const bounds = MuscleVolume.weekBounds(options.week);
    const wantedUser = options.userId ? String(options.userId) : '';

    const totals = {};
    for (const group of taxonomy.groups || []) {
      totals[group] = { sets: 0, primary_sets: 0, secondary_sets: 0, exercises: [] };
    }
    const unmapped = {};
    let counted = 0;

    for (const session of MuscleVolume.sessionList(sessions)) {
      if (wantedUser && session.userId && String(session.userId) !== wantedUser) continue;
      const date = MuscleVolume.sessionDate(session);
      if (!date || date < bounds.start || date >= bounds.end) continue;
      counted += 1;
      const exercises = session.completedExercises || session.exercises || [];
      for (const exercise of exercises) {
        const sets = MuscleVolume.setCount(exercise);
        if (!sets) continue;
        const name = exercise.name || exercise.exercise_name || '';
        const resolved = MuscleVolume.resolve(name, taxonomy);
        if (!resolved.mapped) {
          unmapped[name || '(unnamed)'] = (unmapped[name || '(unnamed)'] || 0) + sets;
          continue;
        }
        for (const group of resolved.primary) {
          if (!totals[group]) continue;
          totals[group].sets += sets * credit.primary;
          totals[group].primary_sets += sets * credit.primary;
          totals[group].exercises.push({ name, sets, credit: credit.primary });
        }
        for (const group of resolved.secondary) {
          if (!totals[group]) continue;
          totals[group].sets += sets * credit.secondary;
          totals[group].secondary_sets += sets * credit.secondary;
          totals[group].exercises.push({ name, sets, credit: credit.secondary });
        }
      }
    }

    const groups = Object.entries(totals).map(([group, value]) => {
      const target = { ...(targetTable.default || {}), ...((targetTable.groups || {})[group] || {}) };
      const sets = Math.round(value.sets * 10) / 10;
      return {
        group,
        sets,
        primary_sets: Math.round(value.primary_sets * 10) / 10,
        secondary_sets: Math.round(value.secondary_sets * 10) / 10,
        target,
        status: MuscleVolume.statusFor(sets, target),
        exercises: value.exercises
      };
    });

    return {
      week_start: bounds.start.toISOString().slice(0, 10),
      week_end: new Date(bounds.end.getTime() - 1).toISOString().slice(0, 10),
      groups,
      unmapped: Object.entries(unmapped).map(([name, sets]) => ({ name, sets })),
      sessions: counted
    };
  }

  /** Where a number sits against its band: below the low end, inside it, or past the top. */
  static statusFor(sets, target) {
    if (!target || target.min == null) return 'unknown';
    if (sets < target.min) return 'below';
    if (target.max != null && sets > target.max) return 'high';
    if (target.target_high != null && sets > target.target_high) return 'above';
    return 'in';
  }
}

module.exports = MuscleVolume;
