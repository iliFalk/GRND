import { useCallback, useEffect, useState } from 'react';
import { useExerciseCatalogue } from '../../lib/catalogue';
import { buildSessionPayload, saveWorkoutSession, type SavedSession } from '../../lib/session';
import {
  countReps,
  hasWork,
  isResting,
  nextSet,
  pause,
  restSeconds,
  startWorkout,
  totalReps,
  type WorkoutState
} from '../../lib/workout';
import { ExercisePicker } from '../plan/ExercisePicker';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
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

  const start = useCallback(() => {
    const entry = (catalogue.data ?? []).find((candidate) => candidate.id === selectedId);
    if (!entry) return;

    const weight = weightInput.trim() === '' ? undefined : Number(weightInput);
    const started = Date.now();
    setState(startWorkout(entry, Number.isFinite(weight) ? weight : undefined, started));
    setNow(started);
    setSaved(null);
    setError(null);
  }, [catalogue.data, selectedId, weightInput]);

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
              setSelectedId(null);
              setWeightInput('');
            }}
          >
            New workout
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    const entries = catalogue.data ?? [];
    return (
      <section aria-labelledby="workout-setup-title" className="space-y-4">
        <div>
          <h2 id="workout-setup-title" className="text-lg font-semibold">
            Start a workout
          </h2>
          <p className="text-xs text-muted-foreground">
            One exercise, one weight, then count the repetitions.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 py-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Weight in kg</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={weightInput}
                onChange={(event) => setWeightInput(event.target.value)}
                placeholder="Empty for bodyweight work"
                className="w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              For bodyweight work this is the load added to the body, never the body itself.
            </p>
            <Button onClick={start} disabled={!selectedId}>
              Start workout
            </Button>
          </CardContent>
        </Card>

        {catalogue.loading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Loading the catalogue…
            </CardContent>
          </Card>
        ) : (
          <ExercisePicker entries={entries} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </section>
    );
  }

  const resting = isResting(state);
  const rest = restSeconds(state, now);

  return (
    <section aria-labelledby="workout-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="workout-title" className="text-lg font-semibold">
            {state.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {`${formatNumber(state.sets.length)} sets · ${formatNumber(totalReps(state))} reps`}
          </p>
        </div>
        <Badge title="One weight per exercise">
          {state.weight === undefined ? 'bodyweight' : `${formatNumber(state.weight)} kg`}
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
            <p className="font-mono text-6xl tabular-nums">{state.counter}</p>
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
              disabled={state.counter === 0}
            >
              Pause and close the set
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
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
