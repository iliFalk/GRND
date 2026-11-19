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

it('test_the_base_comes_first_whatever_its_impact', () => {
  const row = entry('row', { primary: ['back', 'biceps'], secondary: ['core'] });
  const chinUp = entry('chin-up', { primary: ['back'], role: 'base' });

  expect(orderForPillar([row, chinUp], PULL).map((row) => row.id)).toEqual(['chin-up', 'row']);
});

it('test_the_stronger_impact_comes_next', () => {
  const weak = entry('weak', { primary: ['biceps'] });
  const strong = entry('strong', { primary: ['back', 'biceps'] });

  expect(orderForPillar([weak, strong], PULL).map((row) => row.id)).toEqual(['strong', 'weak']);
});

it('test_equal_impact_falls_back_to_the_name', () => {
  const b = entry('b', { primary: ['back'] });
  const a = entry('a', { primary: ['back'] });

  expect(orderForPillar([b, a], PULL).map((row) => row.id)).toEqual(['a', 'b']);
});

it('test_an_exercise_outside_the_pillar_scores_nothing', () => {
  expect(impactOn(entry('flyes', { primary: ['chest'] }), PULL)).toBe(0);
});
