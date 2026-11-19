import { useCallback, useEffect, useState } from 'react';
import { resolveCatalogueEntryByName, useExerciseCatalogue } from '../../lib/catalogue';
import { buildSessionPayload, saveWorkoutSession, type SavedSession } from '../../lib/session';
import {
  activeExercise,
  countReps,
  hasWork,
  isLastExercise,
  isResting,
  nextExercise,
  nextSet,
  pause,
  restSeconds,
  startWorkout,
  totalReps,
  totalSets,
  type WorkoutChoice,
  type WorkoutState
} from '../../lib/workout';
import { useUserProfile } from '../../lib/profile';
import { useDashboardData } from '../../lib/useDashboardData';
import { ExercisePicker } from '../plan/ExercisePicker';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';

interface WorkoutScreenProps {
  userId: string;
  /** Called once the server stored the session, so the week is read again. */
  onSaved: () => void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function WorkoutScreen({ userId, onSaved }: WorkoutScreenProps) {
  const catalogue = useExerciseCatalogue();
  // The plan is not the next workout: it is what the week is short of, with the progress so far.
  const plan = useDashboardData(userId);
  // The body that moves during bodyweight work: the volume needs it, so it is editable here.
  const profile = useUserProfile(userId);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<WorkoutChoice[]>([]);
  const [state, setState] = useState<WorkoutState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The rest timer counts up, so the screen ticks while a rest is running.
  useEffect(() => {
    if (!state || !isResting(state)) return;
    const handle = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(handle);
  }, [state]);

  const entries = catalogue.data ?? [];

  const toggle = useCallback(
    (exerciseId: string) => {
      setChosen((previous) => {
        if (previous.some((choice) => choice.id === exerciseId)) {
          return previous.filter((choice) => choice.id !== exerciseId);
        }
        const entry = entries.find((candidate) => candidate.id === exerciseId);
        if (!entry) return previous;
        return [...previous, { id: entry.id, name: entry.name }];
      });
    },
    [entries]
  );

  const setWeight = useCallback((exerciseId: string, raw: string) => {
    setChosen((previous) =>
      previous.map((choice) => {
        if (choice.id !== exerciseId) return choice;
        if (raw.trim() === '') return { id: choice.id, name: choice.name };
        const value = Number(raw);
        return Number.isFinite(value) && value > 0
          ? { id: choice.id, name: choice.name, weight: value }
          : { id: choice.id, name: choice.name };
      })
    );
  }, []);

  const start = useCallback(() => {
    if (chosen.length === 0) return;
    const started = Date.now();
    setState(startWorkout(chosen, started));
    setNow(started);
    setSaved(null);
    setError(null);
  }, [chosen]);

  const finish = useCallback(async () => {
    if (!state) return;
    const payload = buildSessionPayload(state, userId);
    if (!payload) return;

    setSaving(true);
    setError(null);
    try {
      const session = await saveWorkoutSession(payload);
      setSaved(session);
      setState(null);
      onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [onSaved, state, userId]);

  if (catalogue.error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm">
          The catalogue could not be loaded: {catalogue.error.message}
        </CardContent>
      </Card>
    );
  }

  if (saved) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Session saved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {`${formatNumber(saved.totalSets ?? 0)} sets · ${formatNumber(saved.totalVolume ?? 0)} kg of volume`}
          </p>
          <Button
            onClick={() => {
              setSaved(null);
              setChosen([]);
            }}
          >
            New workout
          </Button>
        </CardContent>
      </Card>
    );
  }

  const saveBodyweight = async () => {
    const kg = Number(weightDraft);
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      setWeightError('Between 30 and 300 kg.');
      return;
    }
    try {
      await profile.saveBodyweight(kg);
      setEditingWeight(false);
      setWeightError(null);
    } catch (cause: unknown) {
      setWeightError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (!state) {
    return (
      <section aria-labelledby="workout-setup-title" className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Bodyweight</span>
          {editingWeight ? (
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="30"
                max="300"
                step="0.5"
                value={weightDraft}
                onChange={(event) => setWeightDraft(event.target.value)}
                aria-label="Bodyweight in kg"
                className="w-20 rounded-control border border-border bg-background px-2 py-1 text-right text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground">kg</span>
              <Button size="sm" onClick={saveBodyweight}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingWeight(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setWeightDraft(profile.profile?.bodyweight ? String(profile.profile.bodyweight) : '');
                setWeightError(null);
                setEditingWeight(true);
              }}
              className="rounded-control px-2 py-1 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {profile.loading
                ? '…'
                : profile.profile?.bodyweight
                  ? `${formatNumber(profile.profile.bodyweight)} kg · change`
                  : 'set your weight'}
            </button>
          )}
        </div>
        {weightError ? <p className="text-xs text-destructive">{weightError}</p> : null}

        <div>
          <h2 id="workout-setup-title" className="text-lg font-semibold">
            Start a workout
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose the exercises, give each its weight, then count the repetitions.
          </p>
        </div>

        {plan.data && plan.data.groups.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Plan · what is short</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.data.groups.map((group) => {
                const max =
                  typeof group.target.max === 'number' && group.target.max > 0
                    ? group.target.max
                    : group.sets + group.short;
                const percent = max > 0 ? Math.min(100, (group.sets / max) * 100) : 0;

                return (
                  <div key={group.group} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium capitalize">{group.group}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {`${formatNumber(group.sets)} / ${formatNumber(max)} · ${formatNumber(group.short)} short`}
                      </span>
                    </div>
                    <Progress value={percent} />
                    <div className="flex flex-wrap gap-1.5">
                      {group.suggestions.map((suggestion) => {
                        const entry = resolveCatalogueEntryByName(entries, suggestion.name);
                        const picked = entry ? chosen.some((choice) => choice.id === entry.id) : false;
                        return (
                          <button
                            key={suggestion.name}
                            type="button"
                            disabled={!entry}
                            onClick={() => {
                              if (entry) toggle(entry.id);
                            }}
                            className={
                              picked
                                ? 'rounded-pill border border-primary bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground'
                                : 'rounded-pill border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground'
                            }
                          >
                            {picked ? `${suggestion.name} ✓` : suggestion.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Tap a name to add it to the workout.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {catalogue.loading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Loading the catalogue…
            </CardContent>
          </Card>
        ) : (
          <ExercisePicker
            entries={entries}
            selectedIds={chosen.map((choice) => choice.id)}
            onToggle={toggle}
          />
        )}

        {chosen.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{`Chosen · ${chosen.length}`}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {chosen.map((choice) => (
                <label key={choice.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{choice.name}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={choice.weight ?? ''}
                    onChange={(event) => setWeight(choice.id, event.target.value)}
                    placeholder="kg"
                    aria-label={`Weight in kg for ${choice.name}`}
                    className="w-24 shrink-0 rounded-control border border-border bg-background px-2 py-1 text-right text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                Empty is bodyweight work; a number there is the load added to the body.
              </p>
              <Button className="w-full" onClick={start}>
                Start workout
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </section>
    );
  }

  const exercise = activeExercise(state);
  const resting = isResting(state);
  const rest = restSeconds(state, now);
  const remaining = state.exercises.slice(state.active + 1).map((entry) => entry.name);

  return (
    <section aria-labelledby="workout-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="workout-title" className="text-lg font-semibold">
            {exercise?.name ?? ''}
          </h2>
          <p className="text-xs text-muted-foreground">
            {`Exercise ${state.active + 1} of ${state.exercises.length} · ${formatNumber(
              totalSets(state)
            )} sets · ${formatNumber(totalReps(state))} reps`}
          </p>
        </div>
        <Badge title="One weight per exercise">
          {exercise?.weight === undefined ? 'bodyweight' : `${formatNumber(exercise.weight)} kg`}
        </Badge>
      </div>

      {resting ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rest</p>
            <p className="font-mono text-5xl tabular-nums">{formatClock(rest)}</p>
            <Button onClick={() => setState(nextSet(state))}>Start next set</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Repetitions</p>
            <p className="font-mono text-6xl tabular-nums">{exercise?.counter ?? 0}</p>
            <div className="flex justify-center gap-3">
              <Button className="h-16 flex-1 text-lg" onClick={() => setState(countReps(state, 1))}>
                +1
              </Button>
              <Button className="h-16 flex-1 text-lg" onClick={() => setState(countReps(state, 3))}>
                +3
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => setState(pause(state, Date.now()))}
              disabled={(exercise?.counter ?? 0) === 0}
            >
              Pause and close the set
            </Button>
          </CardContent>
        </Card>
      )}

      {remaining.length > 0 ? (
        <p className="text-xs text-muted-foreground">{`Then: ${remaining.join(', ')}`}</p>
      ) : null}

      <div className="space-y-2">
        {!isLastExercise(state) ? (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setState(nextExercise(state))}
            disabled={resting || (exercise?.sets.length ?? 0) === 0}
          >
            Next exercise
          </Button>
        ) : null}
        <Button
          className="w-full"
          onClick={finish}
          disabled={!hasWork(state) || saving || resting}
        >
          {saving ? 'Saving…' : 'Finish workout'}
        </Button>
        {resting ? (
          <p className="text-xs text-muted-foreground">
            The workout cannot end during a rest: start the next set first.
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
