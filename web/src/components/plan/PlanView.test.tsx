import { afterEach, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  addExercise,
  buildPlanUpdatePayload,
  loadTrainingPlans,
  updateBlock,
  updatePlanDay
} from '../../lib/plans';
import { PlanView } from './PlanView';

const backSquat = {
  id: 'back-squat',
  name: 'Back Squat',
  equipment: 'barbell',
  primary: ['quads'],
  secondary: []
};

function stubPlans(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify(plans), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );
}

function withAddedSquat(loaded: Awaited<ReturnType<typeof loadTrainingPlans>>) {
  return updatePlanDay(loaded[0], 0, 0, (day) =>
    updateBlock(day, 0, (block) =>
      addExercise(block, backSquat, { sets: 5, reps: 3, weight: 80 })
    )
  );
}

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
  stubPlans();

  const loaded = await loadTrainingPlans();
  const html = renderToString(<PlanView plans={loaded} loading={false} onRetry={() => {}} />);

  expect(html).toContain('Beginner Strength');
  expect(html).toContain('Monday');
  expect(html).toContain('Bench Press');
  expect(html).toContain('4 × 8');
});

it('shows an exercise added from the catalogue with its sets and reps', async () => {
  stubPlans();

  const edited = withAddedSquat(await loadTrainingPlans());
  const html = renderToString(<PlanView plans={[edited]} loading={false} onRetry={() => {}} />);

  expect(html).toContain('Back Squat');
  expect(html).toContain('5 × 3');
  expect(html).toContain('80 kg');
});

it('builds a save payload with weeks, days, blocks and catalogue exercise ids', async () => {
  stubPlans();

  const edited = withAddedSquat(await loadTrainingPlans());
  const payload = buildPlanUpdatePayload(edited);

  const exercises = payload.weeks[0].days[0].blocks[0].exercises;
  expect(exercises[0]).toMatchObject({ exerciseId: 'bench-press', name: 'Bench Press' });
  expect(exercises[exercises.length - 1]).toMatchObject({
    exerciseId: 'back-squat',
    name: 'Back Squat',
    sets: 5,
    reps: 3,
    weight: 80
  });
  expect(payload.weeks[0].days[1]).toMatchObject({
    id: 'plan-1-w1-d2',
    dayType: 'Rest',
    blocks: []
  });
});
