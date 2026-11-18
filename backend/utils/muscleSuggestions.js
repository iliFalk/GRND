/**
 * What to add when a muscle group is short.
 *
 * The volume report says a group is below its band; this engine says which exercises with the
 * equipment at home can close the gap. Only primary work counts: half a set does not close a gap.
 *
 * See docs/SUGGESTIONS.md for the contract.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DEFAULT_LIMIT = 3;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** The taxonomy file, or null when it is unreadable. */
function defaultTaxonomy() {
  const table = readJson(path.join(DATA_DIR, 'exercise-taxonomy.json'), null);
  if (table && table.exercises && typeof table.exercises === 'object') return table;
  return null;
}

/**
 * The taxonomy to read: an explicit table, a path, or the shipped file.
 * A broken option falls back to the shipped file; an unreadable file yields null.
 */
function resolveTaxonomy(option) {
  if (option && typeof option === 'object') {
    if (option.exercises && typeof option.exercises === 'object') return option;
    return defaultTaxonomy();
  }
  if (typeof option === 'string' && option.trim()) {
    const table = readJson(path.resolve(option), null);
    if (table && table.exercises && typeof table.exercises === 'object') return table;
    return defaultTaxonomy();
  }
  return defaultTaxonomy();
}

/** The ids of the equipment file whose `available` is true. An unreadable file means none. */
function defaultEquipment() {
  const file = readJson(path.join(DATA_DIR, 'equipment.json'), null);
  if (!file || !Array.isArray(file.items)) return [];
  return file.items
    .filter((item) => item && item.available === true && item.id != null)
    .map((item) => String(item.id));
}

/** The allowed equipment ids: an explicit list, or what the equipment file marks available. */
function resolveEquipment(option) {
  if (Array.isArray(option)) {
    return option.filter((id) => id != null).map((id) => String(id));
  }
  return defaultEquipment();
}

function resolveLimit(option) {
  if (typeof option === 'number' && Number.isFinite(option)) {
    return Math.max(0, Math.floor(option));
  }
  return DEFAULT_LIMIT;
}

function byName(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function byShortThenName(a, b) {
  if (b.short !== a.short) return b.short - a.short;
  if (a.group < b.group) return -1;
  if (a.group > b.group) return 1;
  return 0;
}

function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** An exercise may be used when its equipment is at home; `any` needs bodyweight. */
function equipmentAllowed(equipment, allowed) {
  if (equipment === 'any') return allowed.has('bodyweight');
  return allowed.has(equipment);
}

/** Up to `limit` exercises that train `group` as a primary group with the allowed equipment. */
function suggestionsFor(group, taxonomy, allowed, limit) {
  const eligible = [];
  for (const [name, entry] of Object.entries(taxonomy.exercises || {})) {
    if (!entry || !Array.isArray(entry.primary) || !entry.primary.includes(group)) continue;
    const equipment = entry.equipment == null ? '' : String(entry.equipment);
    if (!equipmentAllowed(equipment, allowed)) continue;
    eligible.push({
      name: String(name),
      equipment,
      primary: Array.isArray(entry.primary) ? entry.primary.slice() : [],
      secondary: Array.isArray(entry.secondary) ? entry.secondary.slice() : []
    });
  }

  eligible.sort(byName);

  const seen = new Set();
  const unique = [];
  for (const exercise of eligible) {
    const key = normalizeName(exercise.name);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(exercise);
  }

  return unique.slice(0, limit);
}

/**
 * Exercises that close the gap for every muscle group below its weekly band.
 *
 * @param {{groups?: Array<{group: string, sets: number, target: {min: number}, status: string}>}} report
 * @param {{equipment?: string[], limit?: number, taxonomy?: Object|string}} [options]
 * @returns {Array<{group: string, sets: number, short: number, suggestions: Array}>}
 */
function suggestForReport(report, options = {}) {
  const rows = report && Array.isArray(report.groups) ? report.groups : [];
  if (rows.length === 0) return [];

  const below = rows.filter((row) => row && row.status === 'below');
  if (below.length === 0) return [];

  const taxonomy = resolveTaxonomy(options ? options.taxonomy : undefined);
  if (!taxonomy) return [];

  const allowed = new Set(resolveEquipment(options ? options.equipment : undefined));
  const limit = resolveLimit(options ? options.limit : undefined);

  const entries = [];
  for (const row of below) {
    const target = row.target || {};
    if (target.min == null || !Number.isFinite(Number(target.min))) continue;
    const sets = Number(row.sets) || 0;
    entries.push({
      group: String(row.group),
      sets: row.sets,
      short: round1(Number(target.min) - sets),
      suggestions: suggestionsFor(String(row.group), taxonomy, allowed, limit)
    });
  }

  entries.sort(byShortThenName);
  return entries;
}

module.exports = { suggestForReport };
