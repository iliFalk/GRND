import { afterEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';
import { loadPillars } from './lib/pillars';

const pillars = {
  week_start: '2026-11-16',
  week_end: '2026-11-22',
  sessions: 2,
  pillars: [
    {
      id: 'pull',
      label: 'Pull',
      movements: ['pull', 'core'],
      sets: 4,
      target: { min: 10, target_low: 10, target_high: 20, max: 25 },
      status: 'below',
      short: 6,
      exercises: [{ name: 'Pull-ups', sets: 4 }]
    },
    {
      id: 'push',
      label: 'Push',
      movements: ['push'],
      sets: 12,
      target: { min: 10, target_low: 10, target_high: 20, max: 25 },
      status: 'in',
      short: 0,
      exercises: [{ name: 'Dips', sets: 12 }]
    },
    {
      id: 'legs',
      label: 'Legs',
      movements: ['squat', 'hinge', 'power'],
      sets: 0,
      target: { min: 12, target_low: 12, target_high: 24, max: 30 },
      status: 'below',
      short: 12,
      exercises: []
    }
  ],
  circuits: [],
  circuit_rounds: 0,
  outside: [],
  unmapped: []
};

const catalogue = {
  exercises: [
    { id: 'pull-ups', name: 'Pull-ups', equipment: 'pull-up-bar', primary: ['back'], secondary: [], movement: 'pull' },
    { id: 'dips', name: 'Dips', equipment: 'bodyweight', primary: ['triceps'], secondary: [], movement: 'push' },
    { id: 'air-squats', name: 'Air squats', equipment: 'bodyweight', primary: ['quads'], secondary: [], movement: 'squat' }
  ]
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders the three pillars with their progress', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes('/api/pillars/') ? pillars : catalogue;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );

  await loadPillars('default-user');
  const html = renderToString(<App />);

  expect(html).toContain('Pull');
  expect(html).toContain('Push');
  expect(html).toContain('Legs');
  expect(html).toContain('6 more');
  expect(html).toContain('12 more');
  expect(html).toContain('2 to close');
});
