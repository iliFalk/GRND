/**
 * Reading and writing the JSON files that hold the data.
 *
 * Three defects lived in every route that saved something:
 *   - `fs.writeFile` truncates first, so a crash or a full disk mid-write left half a file and the whole
 *     journal was gone. The file is written to a sibling temp and renamed; the rename is atomic on one
 *     disk. Ilja, 2026-11-21.
 *   - two read-change-write cycles that overlap lose one record. The cycles for one file are queued.
 *   - a file that does not parse answered an empty set, so a damaged journal read as "a week without
 *     training". A damaged file is an error the log names, and it is never overwritten.
 */
const fs = require('fs').promises;
const path = require('path');

class StoreError extends Error {
  constructor(file, cause) {
    super(`store: ${path.basename(file)} cannot be read (${cause.message})`);
    this.name = 'StoreError';
    this.file = file;
  }
}

/** One chain per file: every change of a file waits for the one before it. */
const chains = new Map();

function queued(file, work) {
  const previous = chains.get(file) || Promise.resolve();
  const next = previous.then(work, work);
  // The chain must not keep a rejection alive for the next caller.
  chains.set(file, next.catch(() => {}));
  return next;
}

async function writeAtomic(file, data) {
  // The pid and the millisecond are not enough: a second write inside the same millisecond picked the
  // same temp file, the first rename ate it and the second failed with ENOENT.
  const stamp = Math.random().toString(36).slice(2, 8);
  const temp = `${file}.${process.pid}.${Date.now()}.${stamp}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2));
  await fs.rename(temp, file);
}

/**
 * The parsed file, or `fallback` when it does not exist. A file that exists and does not parse throws:
 * a damaged journal must not read as an empty one.
 */
async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) {
      console.error(`store: ${file} is not JSON — refusing to treat it as empty`);
      throw new StoreError(file, error);
    }
    throw error;
  }
}

/** Replaces the file in one queued, atomic step. */
async function writeJson(file, data) {
  return queued(file, () => writeAtomic(file, data));
}

/**
 * One read-change-write cycle under the file's lock. `change` gets the parsed content and returns what
 * to write; a damaged file throws before anything is written, so the damage is never baked in.
 */
async function updateJson(file, fallback, change) {
  return queued(file, async () => {
    const current = await readJson(file, fallback);
    const next = await change(current);
    await writeAtomic(file, next);
    return next;
  });
}

module.exports = { readJson, writeJson, updateJson, writeAtomic, StoreError };
