import { useCallback, useEffect, useRef, useState } from 'react';
import { setsEntries, useExerciseCatalogue } from '../../lib/catalogue';
import { revealInput, selectAllOnFocus } from '../../lib/focus';
import { EFFORTS, invalidateBlock, recordEffort, type Effort } from '../../lib/block';
import { buildSessionPayload, discardSession, saveWorkoutSession, type SavedSession } from '../../lib/session';
import { clearDraft, loadDraft, useDraftSync } from '../../lib/draft';
import { STALE_AFTER_MS, clearSaved, readSaved, writeSaved } from '../../lib/persistence';
import { orderForPillar, usePillars } from '../../lib/pillars';
import { useUserProfile } from '../../lib/profile';
import {
  activeExercise,
  countReps,
  elapsedSeconds,
  hasWork,
  isResting,
  nextBlock,
  openCounters,
  pause,
  restSeconds,
  resumeWorkout,
  selectExercise,
  setsOf,
  startWorkout,
  totalReps,
  totalSets,
  type WorkoutChoice,
  type WorkoutState
} from '../../lib/workout';
import { AmrapScreen } from './AmrapScreen';
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
  // ?mode=amrap renders the circuit state: a headless render cannot press a switch it cannot reach.
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof location === 'undefined') return 'sets';
    return new URLSearchParams(location.search).get('mode') === 'amrap' ? 'amrap' : 'sets';
  });
  const [amrapBusy, setAmrapBusy] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const storageKey = `grnd-workout-${userId}`;
  const localStamp = useRef(0);
  const [chosen, setChosen] = useState<WorkoutChoice[]>([]);
  const [state, setState] = useState<WorkoutState | null>(() => {
    // A workout that was running when the app closed comes back where it stopped.
    const saved = readSaved<WorkoutState>(storageKey, Date.now());
    if (!saved) return null;
    localStamp.current = saved.savedAt;
    return resumeWorkout(saved.value, saved.elapsed, Date.now());
  });

  // The server draft outlives the WebView store, so it wins when it is the newer one.
  useEffect(() => {
    let active = true;
    void loadDraft<WorkoutState>(userId).then((draft) => {
      if (!active || !draft || draft.mode !== 'sets') return;
      if (Date.now() - (draft.savedAt ?? 0) > STALE_AFTER_MS) return;
      if (localStamp.current >= (draft.savedAt ?? 0)) return;
      setState(resumeWorkout(draft.state, draft.elapsed, Date.now()));
    });
    return () => {
      active = false;
    };
  }, [userId]);
  const [now, setNow] = useState(() => Date.now());
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // The finish button asks before it ends the workout: the question takes its own place.
  const [confirming, setConfirming] = useState(false);
  // The state of the workout the app has just stored, kept so he can step back into it.
  const lastState = useRef<WorkoutState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The screen carries a running clock, so it ticks while the workout runs and while a rest runs.
  useEffect(() => {
    if (!state) return;
    const handle = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(handle);
  }, [state]);

  // Any counted repetition answers the finish question by itself: he is still working.
  useEffect(() => {
    setConfirming(false);
  }, [state]);

  // Every counted repetition is written twice: to the phone and, half a second later, to the server.
  useEffect(() => {
    if (!state) return;
    const at = Date.now();
    writeSaved(storageKey, state, elapsedSeconds(state, at), at);
  }, [state, storageKey]);

  useDraftSync(userId, 'sets', state, (current, now) => elapsedSeconds(current, now));

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

  const [efforts, setEfforts] = useState<Record<string, Effort>>({});

  /** One tap per exercise: it writes the effort into the journal and the block reads it next time. */
  const tapEffort = async (exercise: string, effort: Effort) => {
    if (!saved) return;
    setEfforts((current) => ({ ...current, [exercise]: effort }));
    try {
      await recordEffort(saved.id, effort, exercise);
      invalidateBlock(userId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const finish = useCallback(async () => {
    if (!state) return;
    const payload = buildSessionPayload(state, userId);
    if (!payload) return;

    setSaving(true);
    setError(null);
    try {
      const session = await saveWorkoutSession(payload);
      clearSaved(storageKey);
      void clearDraft(userId);
      // The workout is kept in memory, so the effort screen can hand it back.
      lastState.current = state;
      setSaved(session);
      setState(null);
      onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [onSaved, state, storageKey, userId]);

  /**
   * Back from the effort screen into the workout it came from: the stored session leaves the journal
   * first, then the workout continues where it stopped. A refused delete keeps him on this screen —
   * finishing twice must never store the same work twice.
   */
  const backToWorkout = useCallback(async () => {
    if (!saved) return;
    const restored = lastState.current;
    if (!restored) return;

    setRestoring(true);
    setError(null);
    try {
      await discardSession(saved.id);
      setSaved(null);
      setEfforts({});
      setState(restored);
      setNow(Date.now());
      invalidateBlock(userId);
      onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRestoring(false);
    }
  }, [onSaved, saved, userId]);

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
    const list = saved.completedExercises ?? [];
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Session saved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {`${formatNumber(saved.totalSets ?? 0)} sets · ${formatNumber(saved.totalVolume ?? 0)} kg of volume`}
          </p>
          {list.length > 0 ? (
            <>
              {/* Ilja, 2026-11-23: the tap is per exercise, and it is asked here, while the session is fresh. */}
              <p className="text-muted-foreground">How hard was each exercise?</p>
              {list.map((exercise) => (
                <div className="flex flex-col gap-1" key={exercise.name}>
                  <span className="arc-item__title">{exercise.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {EFFORTS.map((effort) => (
                      <button
                        key={effort.id}
                        type="button"
                        className={
                          efforts[exercise.name] === effort.id ? 'arc-chip arc-chip--selected' : 'arc-chip'
                        }
                        onClick={() => void tapEffort(exercise.name, effort.id)}
                      >
                        {effort.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : null}
          {/* Ilja, 2026-11-24: a finish tapped too early is undone here — the workout continues. */}
          <div className="flex flex-wrap gap-2">
            {lastState.current ? (
              <Button variant="secondary" onClick={() => void backToWorkout()} disabled={restoring}>
                {restoring ? 'Opening…' : 'Back to the workout'}
              </Button>
            ) : null}
            <Button
              onClick={() => {
                lastState.current = null;
                setSaved(null);
                setChosen([]);
                setEfforts({});
              }}
            >
              New workout
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
                  className={active ? 'arc-chip arc-chip--selected' : 'arc-chip'}
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
              <div className="arc-row">
                <span className="arc-kv__key">Bodyweight</span>
                {editingWeight ? (
                  <span className="flex items-center gap-2">
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
                      className="arc-input w-20 text-right"
                    />
                    <span className="arc-kv__value">kg</span>
                    <button type="button" className="arc-btn arc-btn--primary" onClick={saveBodyweight}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="arc-btn arc-btn--ghost"
                      onClick={() => setEditingWeight(false)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="arc-btn arc-btn--ghost"
                    onClick={() => {
                      setWeightDraft(
                        profile.profile?.bodyweight ? String(profile.profile.bodyweight) : ''
                      );
                      setWeightError(null);
                      setEditingWeight(true);
                    }}
                  >
                    {profile.loading
                      ? '…'
                      : profile.profile?.bodyweight
                        ? `${formatNumber(profile.profile.bodyweight)} kg · change`
                        : 'set bodyweight'}
                  </button>
                )}
              </div>
              {weightError ? <div className="arc-alert arc-alert--error">{weightError}</div> : null}
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
          <div className="flex items-baseline gap-2">
            <h2 id="workout-title" className="text-lg font-semibold">{`Block ${state.block}`}</h2>
            {/* Ilja, 2026-11-24: the total time of the workout reads beside the block, and it runs. */}
            <span
              className="font-mono text-base tabular-nums text-foreground"
              aria-label="Total workout time"
            >
              {formatClock(elapsedSeconds(state, now))}
            </span>
          </div>
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
        <div className="arc-panel">
          <div className="arc-readout arc-readout--center arc-readout--attention">
            <span className="arc-readout__label">Rest</span>
            <span className="arc-readout__value">{formatClock(rest)}</span>
          </div>
            <button type="button" className="arc-btn arc-btn--primary" onClick={() => setState(nextBlock(state, Date.now()))}>
              {`Start block ${state.block + 1}`}
            </button>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-3 py-4 text-center">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{exercise?.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {exercise?.weight === undefined ? 'bodyweight' : `${formatNumber(exercise.weight)} kg`}
              </span>
            </div>
            <div className="arc-readout arc-readout--center">
              <span className="arc-readout__label">Reps</span>
              <span className="arc-readout__value">{exercise?.counter ?? 0}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {/* Ilja, 2026-11-24: the count goes both ways — three steps down on the left, three up
                  on the right, and the smallest change sits nearest the other side. */}
              {[-3, -2, -1, 1, 2, 3].map((step) => (
                <Button
                  key={step}
                  variant={step < 0 ? 'secondary' : 'default'}
                  className="h-14 px-0"
                  aria-label={step < 0 ? `Minus ${-step} reps` : `Plus ${step} reps`}
                  onClick={() => setState(countReps(state, step))}
                >
                  <span className="arc-h1">{step > 0 ? `+${step}` : `${step}`}</span>
                </Button>
              ))}
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
        {/* Ilja, 2026-11-24: a wrong tap on Finish must not end the workout — the question takes the
            place of the button, and two more taps are needed. */}
        {confirming ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" className="w-full" onClick={() => void finish()} disabled={saving}>
              {saving ? 'Saving…' : 'Yes, finish'}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setConfirming(false)}
              disabled={saving}
            >
              Keep going
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={() => setConfirming(true)}
            disabled={!hasWork(state) || saving || resting}
          >
            Finish workout
          </Button>
        )}
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
