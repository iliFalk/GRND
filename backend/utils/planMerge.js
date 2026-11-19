/**
 * Saving a plan must not drop what the editor does not know about.
 *
 * The plan editor writes the fields it renders: a day with `name`, `dayType` and `blocks`, a week
 * with `id`, `weekNumber` and `days`. The server replaced `weeks` wholesale, so every save stripped
 * `dayOfWeek` and `weekId` from each day and `planId` from each week. The stored object is merged by
 * id here: an incoming field wins, an untouched field stays.
 */

function byId(list) {
  const map = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    if (item && typeof item.id === 'string') map.set(item.id, item);
  }
  return map;
}

function mergeList(existing, incoming, mergeOne) {
  const previous = byId(existing);
  return incoming.map((item) => {
    const before = item && typeof item.id === 'string' ? previous.get(item.id) : undefined;
    return before ? mergeOne(before, item) : item;
  });
}

function mergeDay(before, day) {
  return { ...before, ...day };
}

function mergeWeek(before, week) {
  const merged = { ...before, ...week };
  if (Array.isArray(week.days)) {
    merged.days = mergeList(before.days, week.days, mergeDay);
  }
  return merged;
}

/** The weeks to store: each incoming week and day merged over the one already stored. */
function mergePlanWeeks(existing, incoming) {
  if (!Array.isArray(incoming)) return existing;
  return mergeList(existing, incoming, mergeWeek);
}

module.exports = { mergePlanWeeks };
