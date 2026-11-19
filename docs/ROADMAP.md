# GRND — what is left

The order is the order of work, not of value. Each item names what proves it done.

## 1. The exercise catalogue

**Decision (Ilja, 2026-11-18):** the exercise is a **chosen item from a fixed list**, never typed text.
A plan step is: pick an exercise, then give its sets, reps and weight.

- `data/exercise-catalogue.json` is the list: a stable `id`, the name he reads, the equipment, the
  muscle groups and the default bodyweight factor. It is seeded from the taxonomy and curated by hand.
- The taxonomy stops being a table of names and becomes a lookup **by id**, with the name kept for old
  sessions. A session written before the catalogue keeps its name and is mapped on read.
- The planner writes `exerciseId`; the server validator requires it again once every plan carries one.
  The name stays as a snapshot on the session, so history does not change when a label is corrected.
- An exercise that is not in the catalogue cannot be saved. The `unmapped` list in the weekly report
  then shrinks to old rows only, which is the point: nothing is guessed.
- **Proved by:** a plan saved with a chosen exercise carries its id; the report of that session lands in
  the right groups; a hand-built plan with an unknown name is refused.

## 1a. Workout modes

### The circuit mode stays, and gets finished

`CIRCUIT` already runs: each round takes reps and weight per exercise, log round writes the round into
`completed_sets` with a `round` field, the rest timer starts and the next round follows. Three things are
open, all verified in the code:

- **The dialog's cancel button does nothing** (`handleLogRoundCancel` has an empty body), so a user who
  changes their mind loses the round without a word. Cancel must either keep the inputs and close, or
  write the round as zero and say so.
- **Skipping a round is silent** (`handleSkipRound` only advances the index). A skipped round must be
  recorded as skipped, so history and the weekly volume do not read as if it never existed.
- **History does not show rounds.** A finished circuit is a flat list of sets; the `round` field is
  ignored by the readers. The circuit needs its round number visible, at least as a group header.

The round index survives a reload: it is part of the session state the app persists.

### A new mode: reps on the fly

Ilja's flow, decided 2026-11-18 in full:

1. Start the workout, pick **one exercise from the catalogue** and **one weight** for it.
2. Count repetitions with **+1** and **+3**.
3. Press **pause**: the set closes with the repetitions counted, and a **rest timer starts counting**.
4. Tap the timer: the rest stops and the **next set begins** with a zeroed counter.
5. **There is no stop button.** The workout ends with **"закончить тренировку"**, which saves the
   session.

Consequences, written down so the code matches:

- The set boundary is the pause. A set is the span between the start of counting and the pause; nothing
  guesses a boundary from a rep count.
- A weight is chosen once per exercise and does not change between sets.
- **A warm-up is not recorded at all** — not in history, not in the volume.
- The rest timer counts up, and the next set starts on a tap, so the mode never guesses when rest ended.

### How a set counts in a circuit

**Decision:** a circuit round writes one set **to every exercise of the schema** — three exercises times
four rounds is twelve sets, four per muscle group per exercise. Circuit work therefore reads as real
volume, which is what Ilja expects from a schema.

### Weighted bodyweight work

**Decision:** load above bodyweight counts.

```
volume = (user_bodyweight × bodyweight_load_percentage + added_weight) × reps
```

A chin-up on rings at 80 kg of bodyweight with a 13 kg backpack counts 93 kg per rep, not 80. The
`weight` field of a bodyweight set means the load **added** to the body, never the body itself.

## 1c. Progression — the rules Ilja decided

The app **suggests**, Ilja decides. It never rewrites a plan on its own.

### Strength and conditioning count apart

- **Strength sets** (a `STANDARD` day, rest between sets) go into the 10–20 band per muscle group.
- **Circuit work** (`CIRCUIT`) is endurance work and does **not** go into that band: sets with rest are
  the evidence base for hypertrophy, a circuit is metabolic. Counting both would read a week as full
  while the strength work never happened.
- Both appear in one weekly report: the strength rows against their band, and one circuit row with its
  **rounds and time under load**. No tonnage for a circuit, no band.

### A rep range, for the heavy basics only

A plan step for a heavy basic exercise carries `reps_min` and `reps_max`; every other exercise keeps its
single target. The list of heavy basics is being defined by Ilja from the catalogue.

### When the app suggests more weight

- All target sets reached, and every set at the **top** of the range, with the **same weight**, in **two
  sessions in a row** → suggest the next weight up and a return to the bottom of the range.
- The increment is the next item he actually owns (a 10 kg bell to a 16 kg bell), never a made-up 2.5 kg.
- The streak **resets** when more than a week passes between sessions, or when the last session used a
  different weight.
- Below the bottom of the range twice in a row → suggest taking weight off.
- For every other exercise: a recommendation only, drawn from the same volume and rep comparison.

### Where it shows

In the **day card of the plan**: what to lift next time. The report after a session shows what happened,
not what to do.

### The circuit is an AMRAP block

Decided 2026-11-18:

- **Fixed time, as many rounds as possible.** The duration is set **before each workout**, not stored in
  the plan and not a constant.
- **A partial round counts**: the unfinished round goes into the report with the reps it reached, so the
  work is never lost.
- The measurement stays rounds and time under load, and the work never enters the 10–20 band.
- **One catalogue with a flag.** `is_circuit` marks what a circuit may use; there is no second list.

Open: whether the circuit's exercises carry per-round target reps (as the jump session does: 2×10, 40,
40, 40), or whether the user enters the reps of the round as it goes.

### The circuit flow, and the pairing

Decided 2026-11-18:

1. Choose the **total time**.
2. Choose **up to three exercises**.
3. Give the **reps of each**. No weight in a circuit.

`data/exercise-catalogue.json` carries a `movement` axis (`push`, `pull`, `squat`, `hinge`, `core`,
`carry`, `power`, `conditioning`), and `per_side` where one rep means one rep on each side — his one-arm
kettlebell row is such a movement.

**The pairing.** For every chosen exercise the app suggests partners, ranked by two rules:

- an **antagonist first**: a pull wants a push, a push wants a pull, a squat wants a hinge or core work;
- **never an exercise that trains a primary group the chosen one already trained**, so a circuit does not
  burn one muscle three times.

It also names an **alternative** when a chosen exercise needs equipment he does not own. Everything it
says is advice: any exercise in the catalogue can be picked.

**Nothing is blocked in the picker (Ilja, 2026-11-19).** The second dropdown holds every exercise; the
ranking decides the order and a mark shows why a candidate sits where it does — `antagonist` first, then
a `neutral` neighbour, then one that repeats a primary group (`overlap`, with the shared groups named),
and a movement on the same axis last (`same`). A blocked list would make him hunt for the exercise he
already has in mind. The circuit builder stays strict: that one still refuses a repeat except on the
back.

Verified: eight tests over the pairing, the whole suite 32 green; `POST /api/pairings` answers for his
catalogue and his kit.

### Three refinements, 2026-11-19

1. **A second exercise on the back is allowed** when a triple cannot be filled otherwise. The back is the
   only group that carries this: every other primary group still appears once per circuit. `RELAXABLE_GROUPS`
   in `backend/utils/pairings.js` holds the list, one entry, so changing the rule is one line.
2. **Burpees are their own circuit.** Nothing is their antagonist and they need no pair: the catalogue
   marks them `solo`.
3. **The plan carries the direction; the workout carries the load.** Reps for a circuit are chosen before
   each workout, never stored in the plan. A plan is held to even when the day feels flat: less work is
   allowed, leaving the plan's direction is not.

## 2. The React UI

The vanilla frontend (`frontend/js/**`, 6 782 lines of components) is replaced by a React app in `web/`.

- Stack: Vite 8, React 19, TypeScript, Tailwind 4, shadcn/ui copied into `web/src/components/ui/`.
- Colours come from `iliFalk/CP1-colors`: `design/cp1-palette.json`, turned into CSS variables by
  `tools/theme-from-palette.mjs`. No component carries a hex value.
- Build output goes to `frontend/dist`, served beside the old app while the port is in progress.
- Views, in this order: Dashboard (done in the shell), Plan, Workout with the timer, History.
- **Proved by:** `npm run build`, `test:web`, and the same screen open in Telegram from the bot.

## 3. Weekly sets against the band — done

`backend/utils/muscleVolume.js` counts working sets per muscle group (1.0 primary, 0.5 secondary, a
circuit round as a set) and compares them with `data/weekly-targets.json`. `GET /api/muscle-volume/:userId`
answers it; the dashboard draws it. 13 holdout checks, 8 unit tests.

## 4. What to add when a group is short — done

`backend/utils/muscleSuggestions.js` answers, per short group, the exercises his own equipment can
cover. `GET /api/suggestions/:userId`. Only a primary group counts; an empty list says that nothing at
home closes the gap. 16 unit tests, 13 holdout checks.

## 5. A finished workout reaches the server — done

`saveWorkoutSession()` posts once, keeps the returned id, and updates after that. The queue keeps the
several saves of one completion from racing. `tests/session-write.test.js` boots the server and proves
the write.

## 6. Not started

- **The volume panel and the suggestion list on the new dashboard** — the shell draws the groups; the
  chips need the same pass after the port.
- **`initData` check on the API.** The Mini App sends Telegram's `initData`; the server does not verify
  it, so any caller can read any user's data. Turn it on behind an environment flag, prove the app still
  opens from the phone, then make it the default.
- **A warm-up set is not counted.** The counting rule says a completed set is work; the app has no way
  to mark a set as warm-up yet.
- **The keyboard of the plan editor** on a phone: sets, reps and weight are three inputs per row.
