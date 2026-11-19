import { useEffect, useState } from 'react';
import {
  resolveCatalogueEntryByName,
  useExerciseCatalogue,
  type CatalogueEntry
} from '../../lib/catalogue';
import {
  DAY_TYPES,
  addBlock,
  addExercise,
  dayTypeLabel,
  isDayType,
  removeExercise,
  saveTrainingPlan,
  setDayType,
  updateBlock,
  updateExercise,
  updatePlanDay,
  type ExercisePatch,
  type PlanBlock,
  type PlanDay,
  type PlanExercise,
  type PlanWeek,
  type TrainingPlan
} from '../../lib/plans';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ExercisePicker } from './ExercisePicker';

interface PlanViewProps {
  plans?: TrainingPlan[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}

/** One day of one week, rebuilt from what the user typed. */
type DayEdit = (weekIndex: number, dayIndex: number, update: (day: PlanDay) => PlanDay) => void;

const fieldClass =
  'w-14 rounded-control border border-border bg-background px-2 py-1 text-sm text-foreground tabular-nums placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function firstDayWithExercises(week: PlanWeek): number {
  const index = week.days.findIndex((day) =>
    day.blocks.some((block) => block.exercises.length > 0)
  );
  return index === -1 ? 0 : index;
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

function numberFromInput(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

function NumberField({
  label,
  ariaLabel,
  value,
  onChange
}: {
  label: string;
  ariaLabel: string;
  value: number | string;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        className={fieldClass}
        aria-label={ariaLabel}
        value={value}
        placeholder="—"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ExerciseRow({
  exercise,
  catalogue,
  onUpdate,
  onRemove
}: {
  exercise: PlanExercise;
  catalogue?: CatalogueEntry[];
  onUpdate: (patch: ExercisePatch) => void;
  onRemove: () => void;
}) {
  return (
    <li className="space-y-1.5 py-2 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{exercise.name}</span>
          {exercise.exerciseId ? null : <LegacyChip exercise={exercise} catalogue={catalogue} />}
        </div>
        <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{`${formatNumber(exercise.sets)} × ${formatNumber(exercise.reps)}`}</span>
          <span className="ml-1">{weightLabel(exercise)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NumberField
          label="sets"
          ariaLabel={`Sets for ${exercise.name}`}
          value={exercise.sets}
          onChange={(raw) => onUpdate({ sets: numberFromInput(raw, exercise.sets) })}
        />
        <NumberField
          label="reps"
          ariaLabel={`Reps for ${exercise.name}`}
          value={exercise.reps}
          onChange={(raw) => onUpdate({ reps: numberFromInput(raw, exercise.reps) })}
        />
        <NumberField
          label="kg"
          ariaLabel={`Weight for ${exercise.name}`}
          value={exercise.weight ?? ''}
          onChange={(raw) =>
            onUpdate({
              weight: raw.trim() === '' ? undefined : numberFromInput(raw, exercise.weight ?? 0)
            })
          }
        />
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          aria-label={`Remove ${exercise.name}`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

function BlockCard({
  block,
  index,
  catalogue,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise
}: {
  block: PlanBlock;
  index: number;
  catalogue?: CatalogueEntry[];
  onAddExercise: (entry: CatalogueEntry) => void;
  onUpdateExercise: (exerciseIndex: number, patch: ExercisePatch) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
}) {
  const [picking, setPicking] = useState(false);
  const detail = blockDetail(block);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle>Block {index + 1}</CardTitle>
        {detail === '' ? null : (
          <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {block.exercises.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exercises in this block.</p>
        ) : (
          <ul className="divide-y divide-border">
            {block.exercises.map((exercise, exerciseIndex) => (
              <ExerciseRow
                key={`${exercise.id}-${exerciseIndex}`}
                exercise={exercise}
                catalogue={catalogue}
                onUpdate={(patch) => onUpdateExercise(exerciseIndex, patch)}
                onRemove={() => onRemoveExercise(exerciseIndex)}
              />
            ))}
          </ul>
        )}

        {picking ? (
          <div className="space-y-2">
            {catalogue ? (
              <ExercisePicker
                entries={catalogue}
                selectedIds={[]}
                onToggle={(exerciseId) => {
                  const entry = catalogue.find((candidate) => candidate.id === exerciseId);
                  if (!entry) return;
                  onAddExercise(entry);
                  setPicking(false);
                }}
              />
            ) : (
              <p className="rounded-card border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
                The exercise catalogue is still loading.
              </p>
            )}
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
            Add exercise
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function WeekBody({
  week,
  weekIndex,
  catalogue,
  onEditDay
}: {
  week: PlanWeek;
  weekIndex: number;
  catalogue?: CatalogueEntry[];
  onEditDay: DayEdit;
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
  const editBlock = (blockIndex: number, update: (block: PlanBlock) => PlanBlock) =>
    onEditDay(weekIndex, activeDayIndex, (current) => updateBlock(current, blockIndex, update));

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

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{day.name}</h3>
          <div role="group" aria-label="Day type" className="flex flex-wrap gap-1.5">
            {DAY_TYPES.map((type) => {
              const isActive = day.dayType === type;
              return (
                <Button
                  key={type}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  aria-pressed={isActive}
                  onClick={() =>
                    onEditDay(weekIndex, activeDayIndex, (current) => setDayType(current, type))
                  }
                >
                  {dayTypeLabel(type)}
                </Button>
              );
            })}
          </div>
        </div>
        {isDayType(day.dayType) ? null : (
          <p className="text-xs text-muted-foreground">
            {day.dayType === '' ? 'No day type set' : `Stored day type: ${day.dayType}`}
          </p>
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
              onAddExercise={(entry) => editBlock(index, (current) => addExercise(current, entry))}
              onUpdateExercise={(exerciseIndex, patch) =>
                editBlock(index, (current) => updateExercise(current, exerciseIndex, patch))
              }
              onRemoveExercise={(exerciseIndex) =>
                editBlock(index, (current) => removeExercise(current, exerciseIndex))
              }
            />
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={() => onEditDay(weekIndex, activeDayIndex, addBlock)}
      >
        Add block
      </Button>
    </div>
  );
}

function PlanBody({
  plan,
  catalogue,
  onEditDay
}: {
  plan: TrainingPlan;
  catalogue?: CatalogueEntry[];
  onEditDay: DayEdit;
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

      <WeekBody
        key={week.id}
        week={week}
        weekIndex={activeWeekIndex}
        catalogue={catalogue}
        onEditDay={onEditDay}
      />
    </div>
  );
}

export function PlanView({ plans, loading, error, onRetry }: PlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const { data: catalogue } = useExerciseCatalogue();
  const activePlan =
    plans && plans.length > 0
      ? plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]
      : undefined;

  const [draft, setDraft] = useState<TrainingPlan | undefined>(activePlan);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // The list can arrive after the first render (or after a save rewrote the cache). Keep a draft for
  // the plan that is shown; switching plans is handled where the user switches it.
  useEffect(() => {
    setDraft((current) =>
      current && activePlan && current.id === activePlan.id ? current : activePlan
    );
  }, [activePlan]);

  const editDay: DayEdit = (weekIndex, dayIndex, update) => {
    if (!draft) return;
    const next = updatePlanDay(draft, weekIndex, dayIndex, update);
    if (next === draft) return;
    setDraft(next);
    setDirty(true);
    setJustSaved(false);
  };

  const selectPlan = (plan: TrainingPlan) => {
    setSelectedPlanId(plan.id);
    setDraft(plan);
    setDirty(false);
    setSaveError(null);
    setJustSaved(false);
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveTrainingPlan(draft);
      setDraft(saved);
      setDirty(false);
      setJustSaved(true);
    } catch (cause) {
      // The edits stay on screen; only the reason is added.
      setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

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

  if (!activePlan) {
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

  const plan = draft && draft.id === activePlan.id ? draft : activePlan;
  const status = dirty ? 'Unsaved changes' : justSaved ? 'Saved' : null;

  return (
    <section aria-labelledby="plan-title" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="plan-title" className="text-lg font-semibold">
            {plan.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {plan.description ?? 'No description yet'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {status ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {status}
            </span>
          ) : null}
        </div>
      </div>

      {saveError ? (
        <p role="alert" className="text-xs text-danger">
          Save failed: {saveError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plans</p>
        <div role="group" aria-label="Training plan" className="flex flex-wrap gap-2">
          {plans.map((candidate) => {
            const isActive = candidate.id === activePlan.id;
            return (
              <Button
                key={candidate.id}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                aria-pressed={isActive}
                onClick={() => selectPlan(candidate)}
              >
                {candidate.name}
              </Button>
            );
          })}
        </div>
      </div>

      <PlanBody
        key={plan.id}
        plan={plan}
        catalogue={catalogue}
        onEditDay={editDay}
      />
    </section>
  );
}
