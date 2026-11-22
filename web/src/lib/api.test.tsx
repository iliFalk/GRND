import { afterEach, expect, it, vi } from 'vitest';

const SIGNED = 'auth_date=1763884800&hash=ab12&user=%7B%22id%22%3A931142831%7D';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('test_AC28_every_api_call_sends_the_signed_init_data_as_a_tma_header', async () => {
  vi.stubGlobal('window', { Telegram: { WebApp: { initData: SIGNED } } });

  const calls: Array<{ url: string; headers: Headers }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return jsonResponse({ userId: '931142831' });
    })
  );

  const { authHeaders, apiFetch } = await import('./api');

  expect(authHeaders()).toEqual({ Authorization: `tma ${SIGNED}` });

  await apiFetch('/api/me');
  await apiFetch('/api/pillars/931142831');
  await apiFetch('/api/workout-session', { method: 'POST', body: '{}' });

  expect(calls.map((call) => call.url)).toEqual([
    '/api/me',
    '/api/pillars/931142831',
    '/api/workout-session'
  ]);
  for (const call of calls) {
    expect(call.headers.get('Authorization')).toBe(`tma ${SIGNED}`);
  }
});

it('test_a_refused_call_rejects_instead_of_reading_an_account', async () => {
  vi.stubGlobal('window', { Telegram: { WebApp: { initData: SIGNED } } });
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'unauthorized' }, 401)));

  const { apiFetch } = await import('./api');

  await expect(apiFetch('/api/pillars/931142831')).rejects.toThrow('401');
});

it('test_AC29_the_identity_is_the_one_the_me_route_names_not_the_unverified_parse', async () => {
  // The client's own parse and an injected global both claim another account; neither is read.
  vi.stubGlobal('window', {
    Telegram: { WebApp: { initData: SIGNED, initDataUnsafe: { user: { id: 111 } } } },
    __GRND_USER_ID__: '222'
  });

  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return jsonResponse({ userId: '4242' });
    })
  );

  const { currentUserId, knownUserId } = await import('./api');
  const { resolveUserId } = await import('./user');

  expect(calls).toEqual([]);
  expect(await currentUserId()).toBe('4242');

  // Asked once: the second reader takes the answer already given.
  expect(await currentUserId()).toBe('4242');
  expect(calls).toEqual(['/api/me']);

  expect(knownUserId()).toBe('4242');
  expect(resolveUserId()).toBe('4242');
});

it('test_AC29_outside_telegram_there_is_no_identity_and_no_account_is_read', async () => {
  // The host page may set anything it likes; without the signed string there is no account.
  vi.stubGlobal('window', { __GRND_USER_ID__: '222' });

  const fetchStub = vi.fn(async () => jsonResponse({ userId: '4242' }));
  vi.stubGlobal('fetch', fetchStub);

  const { hasInitData, knownUserId } = await import('./api');
  const { resolveUserId } = await import('./user');

  expect(hasInitData()).toBe(false);
  expect(resolveUserId()).toBeNull();
  expect(knownUserId()).toBeNull();
  expect(fetchStub).not.toHaveBeenCalled();
});
