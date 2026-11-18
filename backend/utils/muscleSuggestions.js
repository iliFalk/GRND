const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function readJsonFile(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * suggestForReport(report, options) -> Array<{ group, sets, short, suggestions }>
 *
 * report: { groups: [{ group, sets, target: { min, ... }, status }] }
 * options: { equipment, limit, taxonomy }
 *
 *  - Only groups with status "below" get an entry.
 *  - short = target.min - sets, rounded to one decimal.
 *  - Exercise eligible when group is a primary group and equipment is allowed.
 *    equipment "any" is allowed when bodyweight is allowed.
 *  - No duplicate exercise per group.
 *  - Groups sorted by short descending, then name ascending.
 *  - Exercises sorted by name ascending, limited by options.limit (default 3).
 *  - Empty/unknown equipment list → group entry with suggestions: [].
 *  - No groups below band → [].
 *  - Never throws for missing files.
 */
function suggestForReport(report, options = {}) {
  const equipmentOpts = options.equipment;
  const limit = typeof options.limit === 'number' ? Math.max(0, options.limit) : 3;

  // Determine bodyweight availability and allowed equipment set
  let bodyweightAllowed = false;
  const allowedSet = new Set();

  if (!equipmentOpts || equipmentOpts.length === 0) {
    // Empty/unknown equipment list → rule 7: entries with suggestions: []
    bodyweightAllowed = true;
  } else {
    for (const id of equipmentOpts) {
      allowedSet.add(id);
      if (id === 'bodyweight') bodyweightAllowed = true;
    }
    // Bodyweight is always allowed (special rule)
    allowedSet.add('bodyweight');
    bodyweightAllowed = true;
  }

  // Get groups below the band
  const belowGroups = (report.groups || []).filter((g) => g.status === 'below');

  if (belowGroups.length === 0) return [];

  // If equipment list is empty or unknown, return entries with suggestions: []
  if (!equipmentOpts || equipmentOpts.length === 0) {
    return belowGroups
      .map((g) => ({
        group: g.group,
        sets: g.sets,
        short: Math.round((g.target.min - g.sets) * 10) / 10,
        suggestions: [],
      }))
      .sort((a, b) => {
        if (b.short !== a.short) return b.short - a.short;
        return a.group.localeCompare(b.group);
      });
  }

  // Read taxonomy
  const taxonomy = readJsonFile(options.taxonomy || 'exercise-taxonomy.json');
  const exercises = (taxonomy && taxonomy.exercises) || {};

  // Find eligible exercises for each below group
  const results = [];

  for (const group of belowGroups) {
    const targetMin = group.target.min;
    const sets = group.sets;
    const short = Math.round((targetMin - sets) * 10) / 10;

    const seen = new Set();
    const eligible = [];

    for (const [name, ex] of Object.entries(exercises)) {
      const primaryGroups = ex.primary || [];

      // Rule 3: exercise must have the group as a primary group
      if (!primaryGroups.includes(group.group)) continue;

      // Rule 4: no duplicate exercise per group
      const norm = name.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);

      // Rule 3: check equipment eligibility
      const equip = ex.equipment || 'any';
      let ok = false;

      if (equip === 'any') {
        // "any" is allowed when bodyweight is allowed
        ok = bodyweightAllowed;
      } else {
        ok = allowedSet.has(equip);
      }

      if (ok) {
        eligible.push({
          name,
          equipment: equip,
          primary: ex.primary || [],
          secondary: ex.secondary || [],
        });
      }
    }

    // Sort exercises by name ascending (rule 5)
    eligible.sort((a, b) => a.name.localeCompare(b.name));

    // Apply limit (rule 5)
    const limited = eligible.slice(0, limit);

    results.push({
      group: group.group,
      sets,
      short,
      suggestions: limited,
    });
  }

  // Sort results by short descending, then group name ascending (rule 5)
  results.sort((a, b) => {
    if (b.short !== a.short) return b.short - a.short;
    return a.group.localeCompare(b.group);
  });

  return results;
}

module.exports = { suggestForReport };