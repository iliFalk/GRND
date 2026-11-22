# Porting GRND onto ARC 2.1.0

The plan and its measurements. The app keeps its logic, its API and its data; the port replaces the
look: ARC's tokens, ARC's elements, ARC's gates.

## Where it stands

- Branch `arc-port`, cut from `0d365a6`.
- The release pack is vendored under `vendor/arc/` (31 files, ARC 2.1.0, byte-identical archive).
- The current front end is React: `web/src/components/` holds the dashboard, the workout and AMRAP
  screens, history, the plan view and the exercise picker; `web/src/components/ui/` holds four
  primitives (button, card, badge, progress); `web/src/styles/` is 176 lines.

## The four screens, in port order

| Order | Screen | What it must keep |
|---|---|---|
| 1 | History `components/history/HistoryScreen.tsx` | the journal list and its figures |
| 2 | Settings (inside the dashboard's sheet) | bodyweight, the one setting he changes |
| 3 | Today `Dashboard.tsx`, `PillarRing.tsx` | the week, the four pillars, the day column |
| 4 | Timer `workout/WorkoutScreen.tsx`, `AmrapScreen.tsx` | the readout, the set entry, the keyboard-safe field |

History first because it is the plainest list; the timer last because it is the riskiest: a fixed frame,
a keyboard that shrinks the viewport, and a number read at arm's length (the readout is §8.18).

## What maps onto what

| GRND today | ARC |
|---|---|
| `ui/button.tsx` | `.arc-btn` with `--primary`, `--secondary`, `--ghost`, `--danger` |
| `ui/card.tsx` | `.arc-panel`, head row with a chip |
| `ui/badge.tsx` | `.arc-chip` — a state, never an action |
| `ui/progress.tsx` | `.arc-meter` with `--arc-meter-value` |
| ring, day column | `.arc-chart` for the line; the ring keeps its own geometry |
| set rows, history rows | `.arc-item` — a row whose label is a phrase is an item, not a pair |
| set table | `.arc-table` with three columns, `.arc-table__scroll` beyond |
| rest timer | `.arc-readout` at 3.5 × the body size, tabular mono |
| footer nav | `.arc-bar` with `aria-current="page"` |
| sheets | `dialog.arc-sheet` on the native dialog |

## The ring is the one visible conflict

`tools/categories.py` on the live dark pair, against ARC's accent and status hues:

```
pull  #4694ea  6.14:1  211°  0.80  accent     21°  FAIL
push  #d5b26c  9.57:1   40°  0.56  attention   2°  FAIL
legs  #4aa172  6.10:1  148°  0.37  accent     43°  ok
core  #a775ff  6.09:1  262°  1.00  critical   46°  ok
4 categories, 2 outside the rule
```

D10 already decides the outcome: a category is carried by its word and its position, a tint marks at most
two categories that pass, and a tint is never the only cue. So `legs` and `core` keep a tint and `pull` and
`push` lose theirs — pull at 21° from the accent and push at 2° from attention read as "selected" and
"warning", which is what the rule exists to prevent. Every arc carries its letter and its name at the same
time, so the ring survives the loss of hue.

## Verification per screen

```bash
python3 vendor/arc/tools/lint.py web/src     # no raw value, no .arc- selector, no unknown class
node vendor/arc/tools/shot.mjs --url "http://127.0.0.1:5173/" --width 430 --height 900 --scheme dark  --audit
node vendor/arc/tools/shot.mjs --url "http://127.0.0.1:5173/" --width 430 --height 900 --scheme light --audit
npm test                                      # the app's own suite stays green
```

The Mini App is 430 px wide, so every screen is measured at 430 × 900 and at ARC's master frame 390 × 844;
width 430 adds space and never a new structure. A screenshot reports composition only: the numbers come
from `--eval`.

## Not in the port

- No change to `backend/`, `data/`, `server.js` or the API.
- No deploy to falknest until Ilja says so; the branch stays local and unpublished until a screen passes.
- No new ARC element. A gap in the system goes back to the system as a `HOLE` comment and a request, not
  as local CSS.
