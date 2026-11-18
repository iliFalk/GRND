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
