import { afterEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { loadTrainingPlans } from '../../lib/plans';
import { PlanView } from './PlanView';

const plans = [
  {
    id: 'plan-1',
    name: 'Beginner Strength',
    description: 'A four-week program for beginners',
    durationWeeks: 2,
    weeks: [
      {
        id: 'plan-1-w1',
        weekNumber: 1,
        days: [
          {
            id: 'plan-1-w1-d1',
            dayOfWeek: 'Monday',
            dayType: 'Workout',
            blocks: [
              {
                id: 'plan-1-w1-d1-b1',
                blockType: 'Standard',
                exercises: [
                  {
                    id: 'step-1',
                    exerciseId: 'bench-press',
                    name: 'Bench Press',
                    sets: 4,
                    reps: 8,
                    weight: 60
                  },
                  {
                    id: 'step-2',
                    name: 'Push-ups',
                    sets: 3,
                    reps: 12
                  }
                ]
              }
            ]
          },
          {
            id: 'plan-1-w1-d2',
            dayOfWeek: 'Tuesday',
            dayType: 'Rest',
            blocks: []
          }
        ]
      },
      {
        id: 'plan-1-w2',
        weekNumber: 2,
        days: [
          {
            id: 'plan-1-w2-d1',
            dayOfWeek: 'Monday',
            dayType: 'Rest',
            blocks: []
          }
        ]
      }
    ]
  }
];

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders a plan name, a day and an exercise with its sets and reps', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify(plans), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );

  const loaded = await loadTrainingPlans();
  const html = renderToString(<PlanView plans={loaded} loading={false} onRetry={() => {}} />);

  expect(html).toContain('Beginner Strength');
  expect(html).toContain('Monday');
  expect(html).toContain('Bench Press');
  expect(html).toContain('4 × 8');
});
