import { expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { PillarsData } from '../lib/pillars';
import { Dashboard } from './Dashboard';

const data: PillarsData = {
  week_start: '2026-11-16',
  week_end: '2026-11-22',
  sessions: 5,
  pillars: [
    {
      id: 'pull',
      label: 'Pull',
      movements: ['pull'],
      groups: ['back'],
      sets: 5,
      base_sets: 5,
      power_sets: 0,
      target: { min: 4, target_low: 4, target_high: null, max: null },
      status: 'in',
      short: 0,
      exercises: [{ name: 'Chin-ups (rings)', sets: 5 }]
    },
    {
      id: 'core',
      label: 'Core',
      movements: ['core'],
      groups: ['core'],
      sets: 1,
      base_sets: 1,
      power_sets: 0,
      target: { min: 4, target_low: 4, target_high: null, max: null },
      status: 'below',
      short: 3,
      exercises: [{ name: 'Hanging leg raise', sets: 1 }]
    }
  ],
  days: [
    { date: '2026-11-16', sets: 0, pillars: {} },
    { date: '2026-11-17', sets: 4, pillars: { pull: 4 } },
    { date: '2026-11-18', sets: 0, pillars: {} },
    { date: '2026-11-19', sets: 2, pillars: { core: 2 } },
    { date: '2026-11-20', sets: 0, pillars: {} },
    { date: '2026-11-21', sets: 0, pillars: {} },
    { date: '2026-11-22', sets: 0, pillars: {} }
  ],
  circuits: [],
  circuit_rounds: 0,
  outside: [],
  unmapped: []
};

it('test_a_tile_names_the_floor_and_the_gap_to_it', () => {
  const html = renderToString(<Dashboard data={data} loading={false} onRetry={() => {}} />);

  // Five sets against a floor of four, and one set against the same floor.
  expect(html).toContain('5 / 4');
  expect(html).toContain('1 / 4');
  expect(html).toContain('Floor met');
  expect(html).toContain('3 more');
  expect(html).toContain('Pull');
});
