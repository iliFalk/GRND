/**
 * Every call to the server, signed.
 *
 * The server reads the Telegram `initData` on every `/api` route and answers 401 without it (AC28).
 * `initData` is the signed string; the client's own unverified parse of it proves nothing, so the
 * account behind it is asked for at `GET /api/me` and read from nowhere else (AC29).
 */

/** The signed string Telegram hands the page, trimmed; empty outside the client. */
function initData(): string {
  if (typeof window === 'undefined') return '';
  const value = window.Telegram?.WebApp?.initData;
  return typeof value === 'string' ? value.trim() : '';
}

/** Whether the page holds a string the server can verify. */
export function hasInitData(): boolean {
  return initData() !== '';
}

/** The `tma` header the server verifies. Without a signed string there is no header to send. */
export function authHeaders(): Record<string, string> {
  const signed = initData();
  return signed === '' ? {} : { Authorization: `tma ${signed}` };
}

/** Adds the header to every call, and turns a 401 into a rejection the screens can show. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(authHeaders())) headers.set(name, value);

  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) {
    throw new Error(`${path} answered 401: the Mini App could not prove who it is`);
  }
  return response;
}

/** The id `GET /api/me` has already named; `null` outside Telegram and before its first answer. */
let identified: string | null = null;
let pending: Promise<string> | null = null;

export function knownUserId(): string | null {
  return identified;
}

/** The account behind the signed `initData`: asked once, kept, and never guessed by the client. */
export function currentUserId(): Promise<string> {
  if (identified !== null) return Promise.resolve(identified);
  if (pending) return pending;

  const request = apiFetch('/api/me')
    .then(async (response) => {
      if (!response.ok) throw new Error(`GET /api/me returned ${response.status}`);
      const body: unknown = await response.json();
      const value = body && typeof body === 'object' ? (body as { userId?: unknown }).userId : undefined;
      const userId = typeof value === 'string' ? value.trim() : '';
      if (userId === '') throw new Error('GET /api/me answered without a user id');
      identified = userId;
      return userId;
    })
    .finally(() => {
      // A failed read is not an answer: the next call asks the server again.
      pending = null;
    });

  pending = request;
  return request;
}
