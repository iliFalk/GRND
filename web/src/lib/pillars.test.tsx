import { expect, it } from 'vitest';
import type { CatalogueEntry } from './catalogue';
import { impactOn, orderForPillar } from './pillars';

const entry = (id: string, extra: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  id,
  name: id,
  equipment: 'bodyweight',
  primary: [],
  secondary: [],
  ...extra
});

const PULL = ['back', 'biceps', 'core'];

it('test_a_primary_group_weighs_more_than_a_secondary', () => {
  const row = entry('row', { primary: ['back'], secondary: ['biceps'] });
  const pullUp = entry('pull-up', { primary: ['back'] });

  expect(impactOn(row, PULL)).toBe(3);
  expect(impactOn(pullUp, PULL)).toBe(2);
});

it('test_the_order_he_chose_wins', () => {
  // His Push: dips, thruster, snatch, push-ups — the impact score does not reorder it.
  const dips = entry('dips', { order: 1, primary: ['chest'] });
  const snatch = entry('snatch', { order: 3, primary: ['shoulders', 'chest', 'triceps'] });
  const pushUps = entry('push-ups', { order: 4, primary: ['chest'] });

  expect(orderForPillar([pushUps, snatch, dips], PULL).map((row) => row.id)).toEqual([
    'dips',
    'snatch',
    'push-ups'
  ]);
});

it('test_what_he_has_not_placed_falls_in_behind_the_placed_ones', () => {
  const placed = entry('placed', { order: 9, primary: [] });
  const unplaced = entry('unplaced', { primary: ['back', 'biceps'] });

  expect(orderForPillar([unplaced, placed], PULL).map((row) => row.id)).toEqual(['placed', 'unplaced']);
});

it('test_unplaced_exercises_order_by_impact_then_name', () => {
  const weak = entry('weak', { primary: ['biceps'] });
  const strong = entry('strong', { primary: ['back', 'biceps'] });
  const alsoWeak = entry('also-weak', { primary: ['core'] });

  expect(orderForPillar([weak, strong, alsoWeak], PULL).map((row) => row.id)).toEqual([
    'strong',
    'also-weak',
    'weak'
  ]);
});

it('test_an_exercise_outside_the_pillar_scores_nothing', () => {
  expect(impactOn(entry('flyes', { primary: ['chest'] }), PULL)).toBe(0);
});
