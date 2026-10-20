# GRND

Telegram Mini App for workout plans and a training timer.

```text
server.js     the entry point, started by npm start
data/         plans, profiles and sessions as JSON
```

- **What it is:** a Telegram Mini App with a small server and a browser front end.
- **What it does:** builds workout routines, runs a timer the user controls, and tracks training volume for weighted and bodyweight exercises, so a plan and its execution live in one place inside Telegram.
- **What it needs:** Node 20 or newer, a Telegram bot for the Mini App, and a browser to open it.
- **How do I start:** unpack the archive, run `npm install` and `npm start`, then open the address it prints.

## Install

1. Download the repository as an archive and unpack it whole.
2. In the unpacked folder run `npm install`.
3. Start it: `npm start`. It prints the address the Mini App is served on.

## Use

| Part | What it does |
|---|---|
| Planner | builds a routine: exercises, sets, reps, weight |
| Timer | runs the workout, exercise by exercise, with pauses the user controls |
| Dashboard | shows the volume of a session and the trend across sessions |
| Calendar | shows which days carried a workout |

`BACKEND.md` documents the server routes; `TEST_RESULTS.md` records the last test run.

## Settings

| Path | Holds |
|---|---|
| `data/training-plans.json` | the plans |
| `data/user-profiles.json` | profiles and preferences |
| `data/workout-sessions.json` | finished sessions |

## Docs

- `docs/SPECIFICATION.md` — the requirements document and the implementation plan.
- `BACKEND.md` — the server.
- `LICENSE` — MIT.
