/**
 * The running workout, kept on the server.
 *
 * Ilja, 2026-11-21: the phone's own storage survives closing the Mini App but not killing Telegram —
 * the client drops the WebView's store with the process. A draft that lives here is read by the next
 * open whatever killed the page. One draft per user, replaced as it changes, forgotten after a day.
 */
const fs = require('fs').promises;

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function readAll(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) {
      console.warn('drafts: the draft file is not JSON, starting empty');
      return {};
    }
    throw error;
  }
}

async function writeAll(file, drafts) {
  await fs.writeFile(file, JSON.stringify(drafts, null, 2));
}

function isFresh(draft, now) {
  return Boolean(draft) && Number.isFinite(draft.savedAt) && now - draft.savedAt < MAX_AGE_MS;
}

/** The draft of one user, or `null` when there is none or it is a day old. */
async function getDraft(file, userId, now = Date.now()) {
  const drafts = await readAll(file);
  const draft = drafts[userId];
  return isFresh(draft, now) ? draft : null;
}

/** Replaces the draft of one user and drops the ones nobody came back to. */
async function putDraft(file, userId, draft, now = Date.now()) {
  const drafts = await readAll(file);

  for (const [key, value] of Object.entries(drafts)) {
    if (!isFresh(value, now)) delete drafts[key];
  }

  drafts[userId] = { ...draft, savedAt: now };
  await writeAll(file, drafts);
  return drafts[userId];
}

async function removeDraft(file, userId) {
  const drafts = await readAll(file);
  if (!(userId in drafts)) return false;
  delete drafts[userId];
  await writeAll(file, drafts);
  return true;
}

module.exports = { getDraft, putDraft, removeDraft, MAX_AGE_MS };
