import { useCallback, useEffect, useState } from 'react';
import { setsEntries, useExerciseCatalogue } from '../../lib/catalogue';
import { revealInput, selectAllOnFocus } from '../../lib/focus';
import { buildSessionPayload, saveWorkoutSession, type SavedSession } from '../../lib/session';
import {
  activeExercise,
  countReps,
  hasWork,
  isResting,
  nextBlock,
  openCounters,
  pause,
  restSeconds,
  selectExercise,
  setsOf,
  startWorkout,
  totalReps,
  totalSets,
  type WorkoutChoice,
  type WorkoutState
} from '../../lib/workout';
import { orderForPillar, usePillars } from '../../lib/pillars';
import { AmrapScreen } from './AmrapScreen';
import { useUserProfile } from '../../lib/profile';
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

type Mode = 'sets' | 'amrap';

/** Two ways to train: counted sets, or fixed time with as many rounds as possible. */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const modes: Array<{ id: Mode; label: string }> = [
    { id: 'sets', label: 'SETS' },
    { id: 'amrap', label: 'AMRAP' }
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-control border border-border p-1">
      {modes.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={mode === entry.id}
          onClick={() => onChange(entry.id)}
          className={
            mode === entry.id
              ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-control bg-primary px-2 text-sm font-semibold text-primary-foreground'
              : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-2 text-sm font-medium text-muted-foreground'
          }
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function WorkoutScreen({ userId, onSaved }: WorkoutScreenProps) {
  const catalogue = useExerciseCatalogue();
  // The plan is not the next workout: it is the three pillars and what the week is short of.
  const plan = usePillars(userId);
  // The body that moves during bodyweight work: the volume needs it, so it is editable here.
  const profile = useUserProfile(userId);
  const [editingWeight, setEditingWeight] = useState(false);
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('sets');
  const [amrapBusy, setAmrapBusy] = useState(false);
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

  // A pillar narrows the list to its own movements; without a filter nothing is hidden.
  const filteredPillar = pillarFilter
    ? (plan.data?.pillars ?? []).find((row) => row.id === pillarFilter)
    : undefined;
  const setsList = setsEntries(entries);
  // Inside a pillar: its base first, then whatever hits the pillar hardest.
  const visibleEntries = filteredPillar
    ? orderForPillar(
        setsList.filter((entry) =>
          filteredPillar.movements
            .map((movement) => movement.toLowerCase())
            .includes(String(entry.movement ?? '').toLowerCase())
        ),
        filteredPillar.groups
      )
    : setsList;

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
        {amrapBusy ? null : <ModeSwitch mode={mode} onChange={setMode} />}

        {mode === 'amrap' ? (
          <AmrapScreen userId={userId} onSaved={onSaved} onBusyChange={setAmrapBusy} />
        ) : (
          <>
        <div>
          <h2 id="workout-setup-title" className="text-lg font-semibold">
            Start a workout
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose the exercises, give each its weight, then count the repetitions.
          </p>
        </div>

        {plan.data ? (
          <div className="flex flex-wrap gap-1.5">
            {plan.data.pillars.map((row) => {
              const active = pillarFilter === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPillarFilter(active ? null : row.id)}
                  className={
                    active
                      ? 'rounded-pill border border-primary bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground'
                      : 'inline-flex min-h-11 items-center rounded-pill border border-border px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground'
                  }
                >
                  {row.status === 'below' ? <span aria-hidden="true">• </span> : null}
                  {row.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {chosen.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{`Chosen · ${chosen.length}`}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Bodyweight</span>
                {editingWeight ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="30"
                      max="300"
                      step="0.5"
                      autoFocus
                      value={weightDraft}
                      onChange={(event) => setWeightDraft(event.target.value)}
                      onFocus={(event) => {
                        selectAllOnFocus(event);
                        revealInput(event.currentTarget);
                      }}
                      aria-label="Bodyweight in kg"
                      className="w-16 rounded-control border border-border bg-background px-1.5 py-0.5 text-right text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="text-[11px] text-muted-foreground">kg</span>
                    <Button size="sm" className="h-6 px-2 text-[11px]" onClick={saveBodyweight}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setEditingWeight(false)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setWeightDraft(
                        profile.profile?.bodyweight ? String(profile.profile.bodyweight) : ''
                      );
                      setWeightError(null);
                      setEditingWeight(true);
                    }}
                    className="rounded-control px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {profile.loading
                      ? '…'
                      : profile.profile?.bodyweight
                        ? `${formatNumber(profile.profile.bodyweight)} kg · change`
                        : 'set bodyweight'}
                  </button>
                )}
              </div>
              {weightError ? <p className="text-xs text-destructive">{weightError}</p> : null}
              <div className="h-px bg-border" aria-hidden="true" />

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
                    onFocus={(event) => {
                      selectAllOnFocus(event);
                      revealInput(event.currentTarget);
                    }}
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

        {catalogue.loading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Loading the catalogue…
            </CardContent>
          </Card>
        ) : (
          <ExercisePicker
            entries={visibleEntries}
            selectedIds={chosen.map((choice) => choice.id)}
            onToggle={toggle}
            ordered={filteredPillar !== undefined}
          />
        )}
          </>
        )}
      </section>
    );
  }

  const exercise = activeExercise(state);
  const resting = isResting(state);
  const rest = restSeconds(state, now);
  const open = openCounters(state);

  return (
    <section aria-labelledby="workout-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="workout-title" className="text-lg font-semibold">{`Block ${state.block}`}</h2>
          <p className="text-xs text-muted-foreground">
            {`${formatNumber(totalSets(state))} sets · ${formatNumber(totalReps(state))} reps`}
          </p>
        </div>
        <Badge title="Exercises counted in this block">{`${open} open`}</Badge>
      </div>

      <ul className="space-y-1.5">
        {state.exercises.map((row, index) => {
          const selected = index === state.active;
          return (
            <li key={`${row.id}-${index}`}>
              <button
                type="button"
                onClick={() => setState(selectExercise(state, index))}
                disabled={resting}
                aria-pressed={selected}
                className={
                  selected
                    ? 'flex w-full items-center justify-between gap-3 rounded-control border border-primary bg-accent px-3 py-2 text-left'
                    : 'flex w-full items-center justify-between gap-3 rounded-control border border-border bg-card px-3 py-2 text-left disabled:opacity-60'
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {[
                      row.weight === undefined ? 'bodyweight' : `${formatNumber(row.weight)} kg`,
                      `${formatNumber(setsOf(row))} sets`
                    ].join(' · ')}
                  </span>
                </span>
                {row.counter > 0 ? (
                  <span className="shrink-0 font-mono text-lg tabular-nums">{row.counter}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {resting ? (
        <Card>
          <CardContent className="space-y-3 py-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rest</p>
            <p className="font-mono text-5xl tabular-nums">{formatClock(rest)}</p>
            <Button onClick={() => setState(nextBlock(state, Date.now()))}>
              {`Start block ${state.block + 1}`}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 py-4 text-center">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{exercise?.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {exercise?.weight === undefined ? 'bodyweight' : `${formatNumber(exercise.weight)} kg`}
              </span>
            </div>
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
              className="w-full"
              onClick={() => setState(pause(state, Date.now()))}
              disabled={open === 0}
            >
              {open > 1 ? `Pause and close ${open} exercises` : 'Pause and close the set'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Button className="w-full" onClick={finish} disabled={!hasWork(state) || saving || resting}>
          {saving ? 'Saving…' : 'Finish workout'}
        </Button>
        {resting ? (
          <p className="text-xs text-muted-foreground">
            A rest cannot be skipped by finishing: start the next block first.
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
