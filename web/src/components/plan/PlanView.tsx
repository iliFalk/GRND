import { useState } from 'react';
import {
  resolveCatalogueEntryByName,
  useExerciseCatalogue,
  type CatalogueEntry
} from '../../lib/catalogue';
import type { PlanBlock, PlanDay, PlanExercise, PlanWeek, TrainingPlan } from '../../lib/plans';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface PlanViewProps {
  plans?: TrainingPlan[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function hasExercises(week: PlanWeek): boolean {
  return week.days.some((day) => day.blocks.some((block) => block.exercises.length > 0));
}

function firstDayWithExercises(week: PlanWeek): number {
  const index = week.days.findIndex((day) =>
    day.blocks.some((block) => block.exercises.length > 0)
  );
  return index === -1 ? 0 : index;
}

function planHasExercises(plan: TrainingPlan): boolean {
  return plan.weeks.some(hasExercises);
}

function weightLabel(exercise: PlanExercise): string {
  return typeof exercise.weight === 'number' &&
    Number.isFinite(exercise.weight) &&
    exercise.weight > 0
    ? `${formatNumber(exercise.weight)} kg`
    : 'bodyweight';
}

function blockDetail(block: PlanBlock): string {
  const parts: string[] = [];
  if (block.blockType !== '') parts.push(block.blockType);
  if (block.rounds !== undefined) parts.push(`${formatNumber(block.rounds)} rounds`);
  if (block.targetTime !== undefined) parts.push(`${formatNumber(block.targetTime)} min`);
  return parts.join(' · ');
}

/**
 * The plan stores a name snapshot. A step written before the catalogue has no `exerciseId`; this chip
 * shows the id its name resolves to, and never invents one when the catalogue has no match.
 */
function LegacyChip({
  exercise,
  catalogue
}: {
  exercise: PlanExercise;
  catalogue?: CatalogueEntry[];
}) {
  const match = catalogue ? resolveCatalogueEntryByName(catalogue, exercise.name) : undefined;
  const label = match ? `legacy · ${match.id}` : 'legacy';
  const title = match
    ? `Legacy step · resolved to catalogue id ${match.id} by name`
    : 'Legacy step · no catalogue match by name';

  return (
    <Badge className="max-w-40 shrink-0 truncate" title={title}>
      {label}
    </Badge>
  );
}

function ExerciseRow({
  exercise,
  catalogue
}: {
  exercise: PlanExercise;
  catalogue?: CatalogueEntry[];
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium">{exercise.name}</span>
        {exercise.exerciseId ? null : <LegacyChip exercise={exercise} catalogue={catalogue} />}
      </div>
      <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{`${formatNumber(exercise.sets)} × ${formatNumber(exercise.reps)}`}</span>
        <span className="ml-1">{weightLabel(exercise)}</span>
      </div>
    </li>
  );
}

function BlockCard({
  block,
  index,
  catalogue
}: {
  block: PlanBlock;
  index: number;
  catalogue?: CatalogueEntry[];
}) {
  const detail = blockDetail(block);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle>Block {index + 1}</CardTitle>
        {detail === '' ? null : (
          <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
        )}
      </CardHeader>
      <CardContent>
        {block.exercises.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exercises in this block.</p>
        ) : (
          <ul className="divide-y divide-border">
            {block.exercises.map((exercise, exerciseIndex) => (
              <ExerciseRow
                key={`${exercise.id}-${exerciseIndex}`}
                exercise={exercise}
                catalogue={catalogue}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function WeekBody({
  week,
  catalogue
}: {
  week: PlanWeek;
  catalogue?: CatalogueEntry[];
}) {
  const [dayIndex, setDayIndex] = useState<number | null>(null);

  if (week.days.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          This week has no days yet.
        </CardContent>
      </Card>
    );
  }

  const activeDayIndex =
    dayIndex === null ? firstDayWithExercises(week) : clampIndex(dayIndex, week.days.length);
  const day: PlanDay = week.days[activeDayIndex];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day">
        {week.days.map((candidate, index) => {
          const isActive = index === activeDayIndex;
          return (
            <Button
              key={`${candidate.id}-${index}`}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              aria-pressed={isActive}
              onClick={() => setDayIndex(index)}
            >
              {candidate.name}
            </Button>
          );
        })}
      </div>

      <div>
        <h3 className="text-base font-semibold">{day.name}</h3>
        {day.dayType === '' ? null : (
          <p className="text-xs text-muted-foreground">{day.dayType}</p>
        )}
      </div>

      {day.blocks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No blocks on this day.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {day.blocks.map((block, index) => (
            <BlockCard
              key={`${block.id}-${index}`}
              block={block}
              index={index}
              catalogue={catalogue}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanBody({
  plan,
  catalogue
}: {
  plan: TrainingPlan;
  catalogue?: CatalogueEntry[];
}) {
  const [weekIndex, setWeekIndex] = useState(0);

  if (plan.weeks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">This plan has no weeks yet.</p>
        </CardContent>
      </Card>
    );
  }

  const activeWeekIndex = clampIndex(weekIndex, plan.weeks.length);
  const week = plan.weeks[activeWeekIndex];
  const isFirst = activeWeekIndex === 0;
  const isLast = activeWeekIndex === plan.weeks.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous week"
          disabled={isFirst}
          onClick={() => setWeekIndex(activeWeekIndex - 1)}
        >
          ‹
        </Button>
        <p className="text-sm font-semibold">
          Week {formatNumber(week.weekNumber)}
          <span className="ml-1 font-normal text-muted-foreground">
            · {activeWeekIndex + 1} of {plan.weeks.length}
          </span>
        </p>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next week"
          disabled={isLast}
          onClick={() => setWeekIndex(activeWeekIndex + 1)}
        >
          ›
        </Button>
      </div>

      <WeekBody key={week.id} week={week} catalogue={catalogue} />
    </div>
  );
}

export function PlanView({ plans, loading, error, onRetry }: PlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const { data: catalogue } = useExerciseCatalogue();

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm font-medium">The plan could not be loaded.</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!plans || loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading your plans…
        </CardContent>
      </Card>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">No training plans yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A plan created in the old app appears here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activePlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const emptyPlan = !planHasExercises(activePlan);

  return (
    <section aria-labelledby="plan-title" className="space-y-4">
      <div>
        <h2 id="plan-title" className="text-lg font-semibold">
          {activePlan.name}
        </h2>
        <p className="text-xs text-muted-foreground">
          {activePlan.description ?? 'Read-only plan'}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plans</p>
        <div role="group" aria-label="Training plan" className="flex flex-wrap gap-2">
          {plans.map((plan) => {
            const isActive = plan.id === activePlan.id;
            return (
              <Button
                key={plan.id}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                aria-pressed={isActive}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {plan.name}
              </Button>
            );
          })}
        </div>
      </div>

      {emptyPlan ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">This plan has no exercises yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reading only: an exercise is chosen from the catalogue in a later step.
            </p>
          </CardContent>
        </Card>
      ) : (
        <PlanBody key={activePlan.id} plan={activePlan} catalogue={catalogue} />
      )}
    </section>
  );
}
