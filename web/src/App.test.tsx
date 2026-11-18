import { afterEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';
import { loadDashboardData } from './lib/suggestions';

const suggestions = {
  week_start: '2026-11-16',
  week_end: '2026-11-22',
  sessions: 2,
  groups: [
    {
      group: 'chest',
      sets: 4,
      short: 6,
      suggestions: [{ name: 'Push-ups', equipment: 'bodyweight' }]
    },
    {
      group: 'biceps',
      sets: 0,
      short: 8,
      suggestions: []
    }
  ],
  unmapped: []
};

const volume = {
  week_start: '2026-11-16',
  week_end: '2026-11-22',
  sessions: 2,
  groups: [
    {
      group: 'chest',
      sets: 4,
      status: 'below',
      target: { min: 10, target_low: 10, target_high: 20, max: 25 }
    },
    {
      group: 'biceps',
      sets: 0,
      status: 'below',
      target: { min: 8, target_low: 8, target_high: 16, max: 20 }
    }
  ]
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders a group, its sets and a suggestion chip', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes('/api/suggestions/') ? suggestions : volume;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );

  await loadDashboardData('default-user');
  const html = renderToString(<App />);

  expect(html).toContain('chest');
  expect(html).toContain('4 / 25 sets');
  expect(html).toContain('Push-ups');
});
