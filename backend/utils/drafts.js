/**
 * The running workout, kept on the server.
 *
 * Ilja, 2026-11-21: the phone's own storage survives closing the Mini App but not killing Telegram —
 * the client drops the WebView store with the process. A draft that lives here is read by the next
 * open whatever killed the page.
 *
 * The file holds every user's draft, so its changes go through the same queue as the journal: five
 * concurrent saves used to leave one draft of five and three server errors. A file that does not parse
 * is moved aside instead of being overwritten — the damage stays for inspection and the feature keeps
 * working.
 */
const fs = require('fs').promises;
const path = require('path');

const { readJson, updateJson } = require('./store');

/** The client refuses a draft older than this, so the server keeps it no longer. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function isFresh(draft, now) {
  return Boolean(draft) && Number.isFinite(draft.savedAt) && now - draft.savedAt < MAX_AGE_MS;
}

function prune(drafts, now) {
  const next = {};
  for (const [key, value] of Object.entries(drafts)) {
    if (isFresh(value, now)) next[key] = value;
  }
  return next;
}

/** The marker a damaged file is moved aside under: `${file}.corrupt-<now>`. */
const ASIDE = '.corrupt-';

/**
 * Deletes every aside left next to `file`. One copy of the damage is worth keeping; after the file
 * parses again the copy is only a file nobody reads that grows the disk forever. Best effort: a housekeeping
 * failure must not fail a write that already landed.
 */
async function dropAsides(file) {
  const dir = path.dirname(file);
  const prefix = `${path.basename(file)}${ASIDE}`;
  try {
    const names = await fs.readdir(dir);
    await Promise.all(
      names
        .filter((name) => name.startsWith(prefix))
        .map((name) => fs.unlink(path.join(dir, name)).catch(() => {}))
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`drafts: the asides of ${file} were not cleaned (${error.message})`);
    }
  }
}

/**
 * One queued change of the draft file. A damaged file is renamed aside and the change runs on an empty
 * one: overwriting it loses the damage and every draft with it.
 */
async function withDrafts(file, now, change) {
  try {
    const drafts = await updateJson(file, {}, (current) => change(prune(current, now)));
    // A write that worked is the moment to drop the aside an earlier damage left behind.
    await dropAsides(file);
    return drafts;
  } catch (error) {
    if (error.name !== 'StoreError') throw error;

    // An older aside would sit next to the new one unread, so at most one survives.
    await dropAsides(file);
    const aside = `${file}${ASIDE}${now}`;
    await fs.rename(file, aside).catch(() => {});
    console.warn(`drafts: ${file} was damaged and moved to ${aside}`);
    return updateJson(file, {}, (current) => change(prune(current, now)));
  }
}

/** The draft of one user, or `null` when there is none, it is old, or the file does not parse. */
async function getDraft(file, userId, now = Date.now()) {
  try {
    const drafts = await readJson(file, {});
    const draft = drafts && drafts[userId];
    return isFresh(draft, now) ? draft : null;
  } catch (error) {
    if (error.name === 'StoreError') return null;
    throw error;
  }
}

/** Replaces the draft of one user and drops the ones nobody came back to. */
async function putDraft(file, userId, draft, now = Date.now()) {
  const drafts = await withDrafts(file, now, (current) => ({
    ...current,
    [userId]: { ...draft, savedAt: now }
  }));
  return drafts[userId];
}

/** Deletes one draft. The stale ones stay until the next save prunes them — a delete must not judge. */
async function removeDraft(file, userId) {
  let removed = false;
  try {
    await updateJson(file, {}, (current) => {
      removed = Boolean(current) && userId in current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
  } catch (error) {
    if (error.name !== 'StoreError') throw error;
  }
  return removed;
}

module.exports = { getDraft, putDraft, removeDraft, MAX_AGE_MS };
