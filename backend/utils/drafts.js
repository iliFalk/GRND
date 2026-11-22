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

/**
 * One queued change of the draft file. A damaged file is renamed aside and the change runs on an empty
 * one: overwriting it loses the damage and every draft with it.
 */
async function withDrafts(file, now, change) {
  try {
    return await updateJson(file, {}, (current) => change(prune(current, now)));
  } catch (error) {
    if (error.name !== 'StoreError') throw error;

    const aside = `${file}.corrupt-${now}`;
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
