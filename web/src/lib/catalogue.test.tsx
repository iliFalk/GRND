import { expect, it } from 'vitest';
import { amrapEntries, setsEntries, type CatalogueEntry } from './catalogue';

const entry = (id: string, extra: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  id,
  name: id,
  equipment: 'bodyweight',
  primary: [],
  secondary: [],
  ...extra
});

const catalogue = [
  entry('pull-ups', { movement: 'pull' }),
  entry('air-squats', { movement: 'squat', is_circuit: true, amrap_only: true, excluded: true }),
  entry('push-ups', { movement: 'push', is_circuit: true }),
  entry('dumbbell-flyes', { movement: 'push', is_circuit: true, amrap_only: true, excluded: true }),
  entry('dips', { movement: 'push' })
];

it('test_the_sets_list_hides_what_only_a_circuit_uses', () => {
  expect(setsEntries(catalogue).map((row) => row.id)).toEqual(['pull-ups', 'push-ups', 'dips']);
});

it('test_the_circuit_list_holds_the_flagged_exercises', () => {
  expect(amrapEntries(catalogue).map((row) => row.id)).toEqual([
    'air-squats',
    'push-ups',
    'dumbbell-flyes'
  ]);
});
