import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_CHOICES,
  buildAmrapPayload,
  completeRound,
  elapsedSeconds,
  isTimeUp,
  remainingSeconds,
  resumeAmrap,
  setPartial,
  setsFor,
  startAmrap,
  type AmrapChoice,
  type AmrapState
} from '../../lib/amrap';
import { amrapEntries, useExerciseCatalogue } from '../../lib/catalogue';
import { clearDraft, loadDraft, useDraftSync } from '../../lib/draft';
import { STALE_AFTER_MS, clearSaved, readSaved, writeSaved } from '../../lib/persistence';
import { revealInput, selectAllOnFocus } from '../../lib/focus';
import { saveWorkoutSession, type SavedSession } from '../../lib/session';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface AmrapScreenProps {
  userId: string;
  onSaved: () => void;
  /** The parent hides its mode switch while a circuit runs. */
  onBusyChange: (busy: boolean) => void;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

const DURATIONS = [10, 15, 20];

export function AmrapScreen({ userId, onSaved, onBusyChange }: AmrapScreenProps) {
  const catalogue = useExerciseCatalogue();
  const [minutes, setMinutes] = useState('12');
  const [choices, setChoices] = useState<AmrapChoice[]>([]);
  const storageKey = `grnd-amrap-${userId}`;
  const localStamp = useRef(0);
  const [state, setState] = useState<AmrapState | null>(() => {
    // A circuit that was running when the app closed picks up its clock.
    const saved = readSaved<AmrapState>(storageKey, Date.now());
    if (!saved) return null;
    localStamp.current = saved.savedAt;
    return resumeAmrap(saved.value, saved.elapsed, Date.now());
  });

  // The server draft survives a killed client, so it wins when it is the newer one.
  useEffect(() => {
    let active = true;
    void loadDraft<AmrapState>(userId).then((draft) => {
      if (!active || !draft || draft.mode !== 'amrap') return;
      if (Date.now() - (draft.savedAt ?? 0) > STALE_AFTER_MS) return;
      if (localStamp.current >= (draft.savedAt ?? 0)) return;
      setState(resumeAmrap(draft.state, draft.elapsed, Date.now()));
    });
    return () => {
      active = false;
    };
  }, [userId]);
  const [now, setNow] = useState(() => Date.now());
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = amrapEntries(catalogue.data ?? []);

  useEffect(() => {
    onBusyChange(state !== null);
  }, [onBusyChange, state]);

  // The rounds are written as they happen, to the phone and to the server.
  useEffect(() => {
    if (!state) return;
    const at = Date.now();
    writeSaved(storageKey, state, elapsedSeconds(state, at), at);
  }, [state, storageKey]);

  useDraftSync(
    userId,
    'amrap',
    state,
    state ? elapsedSeconds(state, Date.now()) : 0
  );

  useEffect(() => {
    if (!state || isTimeUp(state, now)) return;
    const handle = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(handle);
  }, [now, state]);

  const toggle = useCallback(
    (id: string) => {
      setChoices((previous) => {
        if (previous.some((choice) => choice.id === id)) {
          return previous.filter((choice) => choice.id !== id);
        }
        if (previous.length >= MAX_CHOICES) return previous;
        const entry = entries.find((candidate) => candidate.id === id);
        return entry ? [...previous, { id: entry.id, name: entry.name, reps: 10 }] : previous;
      });
    },
    [entries]
  );

  const setReps = (id: string, raw: string) => {
    const reps = Number(raw);
    setChoices((previous) =>
      previous.map((choice) =>
        choice.id === id
          ? { ...choice, reps: Number.isFinite(reps) && reps > 0 ? Math.floor(reps) : choice.reps }
          : choice
      )
    );
  };

  const setWeight = (id: string, raw: string) => {
    setChoices((previous) =>
      previous.map((choice) => {
        if (choice.id !== id) return choice;
        if (raw.trim() === '') return { id: choice.id, name: choice.name, reps: choice.reps };
        const weight = Number(raw);
        return Number.isFinite(weight) && weight > 0
          ? { ...choice, weight }
          : { id: choice.id, name: choice.name, reps: choice.reps };
      })
    );
  };

  const start = () => {
    const total = Number(minutes) * 60;
    if (!Number.isFinite(total) || total <= 0 || choices.length === 0) return;
    const started = Date.now();
    setState(startAmrap(choices, total, started));
    setNow(started);
    setError(null);
    setSaved(null);
  };

  const finish = async () => {
    if (!state) return;
    const payload = buildAmrapPayload(state, userId);
    if (!payload) return;

    setSaving(true);
    setError(null);
    try {
      const session = await saveWorkoutSession(payload);
      clearSaved(storageKey);
      void clearDraft(userId);
      setSaved(session);
      setState(null);
      setChoices([]);
      onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Circuit saved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {`${formatNumber(saved.totalSets ?? 0)} sets · ${formatNumber(saved.totalVolume ?? 0)} kg of volume`}
          </p>
          <Button onClick={() => setSaved(null)}>New circuit</Button>
        </CardContent>
      </Card>
    );
  }

  if (state) {
    const up = isTimeUp(state, now);
    const remaining = remainingSeconds(state, now);

    return (
      <section className="space-y-3">
        <Card>
          <CardContent className="space-y-2 py-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {up ? 'Time is up' : 'Time left'}
            </p>
            <p className="font-mono text-5xl tabular-nums">{clock(remaining)}</p>
            <p className="text-sm text-muted-foreground">
              {`${state.rounds} ${state.rounds === 1 ? 'round' : 'rounds'} done`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-3">
            {state.choices.map((choice, index) => (
              <div key={choice.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{choice.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[
                    `${formatNumber(choice.reps)} reps × ${setsFor(state, index)}`,
                    choice.weight === undefined ? '' : `${formatNumber(choice.weight)} kg`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {up ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Unfinished round</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                How many exercises of the last round did you get through?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: state.choices.length + 1 }, (_, count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={state.partial === count}
                    onClick={() => setState(setPartial(state, count))}
                    className={
                      state.partial === count
                        ? 'rounded-pill border border-primary bg-primary px-3 py-1 text-sm font-medium text-primary-foreground'
                        : 'rounded-pill border border-border px-3 py-1 text-sm font-medium text-muted-foreground'
                    }
                  >
                    {count}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button className="w-full" onClick={() => setState(completeRound(state))}>
            Round done
          </Button>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <Button
          className="w-full"
          variant={up ? 'default' : 'outline'}
          onClick={finish}
          disabled={saving || (state.rounds === 0 && state.partial === 0)}
        >
          {saving ? 'Saving…' : 'Finish circuit'}
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <Card>
        <CardContent className="space-y-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Total time</span>
            <span className="flex items-center gap-1.5">
              {DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMinutes(String(value))}
                  className={minutes === String(value) ? 'arc-chip arc-chip--selected' : 'arc-chip'}
                >
                  {`${value} min`}
                </button>
              ))}
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                onFocus={(event) => {
                  selectAllOnFocus(event);
                  revealInput(event.currentTarget);
                }}
                aria-label="Total time in minutes"
                className="arc-input w-14 text-right"
              />
            </span>
          </div>
        </CardContent>
      </Card>

      {choices.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{`Chosen · ${choices.length} of ${MAX_CHOICES}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {choices.map((choice) => (
              <label key={choice.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm">{choice.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={choice.reps}
                    onChange={(event) => setReps(choice.id, event.target.value)}
                    onFocus={(event) => {
                      selectAllOnFocus(event);
                      revealInput(event.currentTarget);
                    }}
                    aria-label={`Repetitions of ${choice.name} per round`}
                    className="arc-input w-14 text-right"
                  />
                  <span className="text-[11px] text-muted-foreground">reps</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={choice.weight ?? ''}
                    onChange={(event) => setWeight(choice.id, event.target.value)}
                    onFocus={(event) => {
                      selectAllOnFocus(event);
                      revealInput(event.currentTarget);
                    }}
                    placeholder="kg"
                    aria-label={`Weight in kg for ${choice.name}`}
                    className="w-14 rounded-control border border-border bg-background px-1.5 py-0.5 text-right text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              Empty weight is bodyweight work; a number is the load of the bell or the dumbbell.
            </p>
            <Button className="w-full" onClick={start}>
              Start circuit
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
        <ul className="max-h-[42vh] space-y-1 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const picked = choices.some((choice) => choice.id === entry.id);
            const full = choices.length >= MAX_CHOICES && !picked;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => toggle(entry.id)}
                  aria-pressed={picked}
                  className={
                    picked
                      ? 'flex w-full items-center justify-between gap-3 rounded-control border border-primary bg-accent px-3 py-2 text-left text-sm'
                      : 'flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-border px-3 py-2 text-left text-sm disabled:opacity-50'
                  }
                >
                  <span className="min-w-0 truncate font-medium">{entry.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {picked ? 'chosen' : entry.equipment}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
