# ARC Mk.2 — The Canon

Rules of the system, how a project applies them, how an engineer implements them.
Every number here comes from `tokens/tokens.json` and is printed by `tools/contrast.py`.
Where this document and the tool disagree, the tool wins.

**Implemented:** 44 elements, listed in section 8 — including the chart, the icon set (2410 glyphs, 31 shipped),
the form with its blocking summary, the fault screen and the result screen — in two schemes, dark and paper,
gated at 49 measured pairs. The ambient layers and the type scale are in sections 4 and 6.
**Not yet:** nothing the pilot asked for; section 11 names what a future screen may ask.

---

## 1. What Mk.2 changes

Mk.1 translated the JARVIS film. It kept the film's skin and lost its craft: one hue for every
signal, glass as the base material, brackets as decoration. Mk.2 keeps the skeleton and rebuilds the
skin for an adversarial screen.

| Mk.1 element | Verdict | Why |
|---|---|---|
| Three-layer architecture | kept | Load-bearing in film craft and in Apple's control-layer rule. |
| Base-8 grid | kept | Neutral, platform standard, compatible with dense layouts. |
| Glow as semaphore | kept | Brightness carries importance; that idea survives the new palette. |
| Cyan as the only accent | rebuilt | One accent per view, four classes instead of one hue. |
| Glass as base material | rebuilt | An optical material for the control layer only; content runs on hard edges. |
| Corner brackets | rebuilt | They now mark a class and the hot corner, and never stand alone as chrome. |
| Barlow Condensed | rebuilt | Condensed grotesque kept, the face changed to one that reads at 12 px. |
| "80 % film / 20 % usability" | dropped | Usability is the baseline, not a concession. |
| Voice as primary mode | dropped | The cyber fantasy is a competent operator, not an assistant. |
| Arc-reactor pulse, data rain | dropped | Costume, not craft. |

---

## 2. Colour

**Rule 1 — one accent leads in a view.** Cyan leads (D6). Yellow marks attention, red marks a failed
operation, magenta marks a security event. A view that shows two leaders has no leader.

**Rule 2 — a filled accent carries near-black ink** (E3). White on a filled neon fails by a wide
margin: 1.77:1 on cyan, 1.30:1 on yellow. Near-black on the same fills is 11.33:1 and 15.41:1.

**Rule 2b — a status colour is a ladder, not one value** (D11). The attention hue comes from Ilja's RAL
palette and carries three steps, all measured:

| Step | Token | Value | On base | Use |
|---|---|---|---|---|
| Attention | `--arc-status-attention` | `#F0AF15` | 9.97:1 | Text, chip, mark, readout |
| Fill | `--arc-status-attention-fill` | `#E29507` | 7.84:1 | A filled surface or a bar; ink on it 8.15:1 |
| Press | `--arc-status-attention-press` | `#A87300` | 4.70:1 | Pressed or active state of a product control |

`#8A6100`, the palette's own inverse, measures 3.48:1 on the base ground and stays out of the dark
scheme: it is ink for a light ground. The green step `#76B900` is derived rather than taken from the
palette: it keeps the hue of RAL 6032 at 151° and lifts the lightness until the colour measures 8.00:1,
because Leaf Green itself cannot carry text on a dark ground. A hue chosen for one ground loses about half its contrast on the
other, which is the whole argument of F2.

**Rule 2c — the ink on a fill follows the fill, not the habit** (E35). A bright fill takes near-black ink;
a dark fill takes white. Ilja's `#4F7D00` and `#D7280A` measure 3.92:1 and 3.86:1 as text — below the
4.5 a label needs — but white on them measures 4.92:1 and 5.00:1, so they are fills and never text. His
Signal Red Light `#F05A3F` inverts the same way: 5.73:1 as text, 2.11:1 under white.

So every status carries up to three measured steps: text, fill, and the ink that belongs on the fill.

**Rule 3 — the three alarm classes never share a view** (E12, D12). Critical means *stop now*: the system
is under threat or data is at risk. Error means an operation failed. Attention means a value drifts.
Critical sits 61° from error and 94° from attention, so the three separate by hue alone; the rule that
they never share a view is the second line of defence, for a reader who cannot use hue. Each class
carries a word and a mark, never colour alone.

| Class | Token | Value | On base | Used for |
|---|---|---|---|---|
| Accent | `--arc-accent-primary` | `#00D4FF` | 10.90:1 | Interaction, focus, active state |
| Attention | `--arc-status-attention` | `#F0AF15` | 9.97:1 | A value that drifts towards a limit |
| Critical | `--arc-status-critical` | `#ED23D2` | 5.30:1 | System under threat, data loss — stop now |
| Critical fill | `--arc-status-critical-fill` | `#AE0E99` | 3.05:1 | A filled surface; white ink on it 6.32:1 |
| Error | `--arc-status-error` | `#F05A3F` | 5.73:1 | Failed operation, negative value |
| Error fill | `--arc-status-error-fill` | `#D7280A` | 3.86:1 | A filled surface; white ink on it 5.00:1 |
| OK | `--arc-status-ok` | `#76B900` | 8.00:1 | Confirmed nominal state |
| OK fill | `--arc-status-ok-fill` | `#4F7D00` | 3.92:1 | A filled mark; white ink on it 4.92:1 |

**Rule 8 — the light scheme is the same roles, inverted** (D17). The role names never change; the values
do. Two consequences follow from measurement, not taste:

- **One value per status serves both text and a fill.** A contrast ratio is symmetric, so `#8A6100` reads
  4.83:1 on paper and paper reads 4.83:1 on it. The three-step ladder of the dark scheme exists because a
  bright fill cannot carry a white label; a dark fill on paper needs no second value.
- **The ink flips.** On dark, a filled accent takes near-black. On light the accent is a deep teal
  `#0A6E7E` and the ink is paper — dark ink on it measured 3.25:1 and failed.

| Role | Dark | Light |
|---|---|---|
| Ground | `#05080D` | `#F2EFE9` |
| Text high | `#E6F4FF` | `#12161A` |
| Accent | `#00D4FF` | `#0A6E7E` |
| Attention | `#F0AF15` | `#8A6100` |
| OK | `#76B900` | `#1A6642` |
| Critical | `#ED23D2` | `#A0108A` |
| Error | `#F05A3F` | `#D7280A` |

**The ambient grid is a token, and the two schemes carry it differently.** `--arc-opacity-ambient` is 0.55
on the dark ground and 0.28 on paper, with the light hairline at 18 % alpha: the same texture reads as a
signal on black and as millimetre paper on white. A grid that competes with the content is a defect in
both schemes.

**The level glow belongs to the dark scheme.** On paper a blurred dark copy reads as a smudge and a glyph
shadow as a printing error, so the light scheme carries level by weight and by the value itself.

The build emits both, and the media query respects the operating system:
`@media (prefers-color-scheme: light)` sets the light values, `[data-scheme="light"]` forces them for a
demo, and `[data-scheme="dark"]` opts out of the media query.

**Rule 7 — a glow marks the top step of a ramp** (D16). It is not decoration and not a hover state: it says
"this value sits at the top of its scale". Ilja picked the intensity `v3` from a five-step ladder:

| Step | Text | Shape |
|---|---|---|
| Top | `text-shadow: 0 0 3px currentColor` | a blurred copy at **4 px**, **30 %** |
| Next | `text-shadow: 0 0 2px currentColor` | the same copy at 2 px and 21 % |
| Rest | nothing | nothing |

`--arc-glow-text-1`, `--arc-glow-text-2`, `--arc-glow-halo-blur`, `--arc-glow-halo-opacity`.

**Do** let the value decide: 96 % of a meter, a countdown in the last seconds, the tallest bar of a week.
The halo is a blurred copy of the shape in its own hue — never another colour, never a contour, never a
drop shadow. **Do not** glow a solid filled button: behind a solid rectangle the halo reads as a coloured
shadow. **Do not** glow text below the body size or a shape below 24 px: at that scale the blur is dirt.
**Do not** animate it: an animated filter or shadow repaints its region every frame.

**Rule 4 — a boundary needs 3:1 on the colour a reader sees** (E9, E16). A translucent line is measured after
compositing: at alpha 0.30 the cyan hairline measured 1.96:1 and at 0.48 it passed at 3.26:1 — which is how the
system learned the floor. The line it ships is solid `#44697C` since E16, at 3.27:1 on the base ground and 3.01:1
on a panel.

**Rule 6 — a product may own a categorical palette; the accent and the statuses stay system** (D9). Four
abilities in a training app are not four alarms, and a system that forces them into its status colours
turns "Legs" into "warning".

A category colour answers two conditions, checked by `python3 tools/categories.py`:

1. **Contrast** — 3:1 or more on the base ground. A category marks a band, a dot or a rule; it never
   carries body text.
2. **Hue** — at least 40° away from the accent and from every status colour, unless the colour is
   near-neutral (saturation below 0.25), where hue carries nothing.

What the check returns for a real product — GRND's live dark pair:

| Category | Value | Contrast | Hue | Nearest system hue | Verdict |
|---|---|---|---|---|---|
| pull | `#4694EA` | 6.14:1 | 211° | accent | 21° — fails |
| push | `#D5B26C` | 9.57:1 | 40° | attention | 2° — fails |
| legs | `#4AA172` | 6.10:1 | 148° | ok | 1° — fails |
| core | `#A775FF` | 6.09:1 | 262° | critical | 56° — passes |

**The measurement has a consequence that the rule alone does not show.** Five system hues at 40°
clearance forbid 17–97°, 110–230° and 278–40°. Two usable bands remain, and they hold at most two
distinguishable categories. A four-hue categorical palette therefore cannot pass while every status
colour is in use.

So the practical form of Rule 6, on Ilja's word (D10): **a category is carried by its word and its
position.** A tint marks at most two categories, and only those that pass the check, and never as the
only cue.

GRND keeps its four abilities uncoloured. Exactly one of its four hues clears the rule — `core` at 56° —
and tinting one of four abilities would mark it as special for no reason the screen can explain. Four
colours that read as states are worse than none.

**Rule 5 — glow never replaces contrast.** A `text-shadow` is outside the contrast formula. It marks
state; it does not rescue an illegal pair.

| Ground | Token | Value | Role |
|---|---|---|---|
| Void | `--arc-bg-void` | `#000000` | Recessed fields, screens that are off |
| Ambient | `--arc-bg-ambient` | `#05080D` | Page ground |
| Base | `--arc-bg-base` | `#0A0E17` | Standard surface |
| Panel | `--arc-bg-panel` | `#0F1923` | A data panel |
| Raised | `--arc-bg-raised` | `#1A2633` | A track, a chip, a nested block |

Text runs on four steps, all measured against the base ground: `--arc-fg-high` 17.23:1,
`--arc-fg-medium` 9.30:1, `--arc-fg-low` 5.44:1, `--arc-fg-faint` 4.10:1. Faint is decoration at large
sizes only, never the only copy of a status.

**Do not** put text on a photograph, a gradient or a translucent surface without measuring the
composite. **Do not** use a status colour as an accent.

---

## 3. Geometry

**Zero radius** (E13). A round corner says the machine is friendly; this system says it is indifferent.

| Shape | Treatment | Implemented as |
|---|---|---|
| A button | Chamfer on two opposite corners | `clip-path` on a pseudo-element |
| A frame (panel) | 1 px hairline plus two hot corners | `border` plus two bracket pseudo-elements |
| A form control | Full rectangular frame | `border` on the input |
| A status | No shape of its own; a chip carries it | chip element |

The chamfer is one token: `--arc-radius-chamfer` = `calc(var(--arc-u) * 0.75)` = **12.00 px** at a
390 px frame.

**Rule — the clip lives on a pseudo-element, never on the control.** `clip-path` cuts the outline at
the notch, so a focus ring on the clipped element is invisible at exactly the place a keyboard user
needs it (WCAG 2.4.13).

**Rule — a frame does not chase a fill.** A panel is never chamfered; a button is never bracketed.

**Do not** extend the chamfer to a control that cannot afford it.** The button cuts two corners at
`--arc-radius-chamfer` (12 px at the master frame). A chip carries no cut (Ilja, 2026-11-21) — it stands 47.45 px
tall at the frame (`min-height: 3 × --arc-u`), so a 12 px cut would be a quarter of its height, a corner and not a
chamfer; a status reads by its word and its dot instead. The meter fill cuts its trailing edge by one spacing step
(`--arc-space-1`, 4 px), which is a rail end and not the family's chamfer: measured, a 12 px cut on a 4 px rail
reads as a rounded end.

---

## 4. Type

**Two voices** (D7, E15). Barlow Semi Condensed is the interface; JetBrains Mono is machine data.
A third family is a defect: the smallest size decided the face, and adding a display face brings the
old problem back.

| Role | Class | Size at 390 px | Weight | Casing |
|---|---|---|---|---|
| Display | `.arc-display` | 40.0 px | 700 | Caps |
| H1 | `.arc-h1` | 28.0 px | 600 | Caps |
| H2 | `.arc-h2` | 22.0 px | 600 | Caps |
| H3 | `.arc-h3` | 18.0 px | 500 | Caps |
| Label | `.arc-label` | 13.0 px | 600 | Caps, `0.10em` |
| Micro | `.arc-micro` | 12.0 px | 500 | Caps, `0.14em` |
| Body | `.arc-body` | 16.0 px | 400 | Sentence case |
| Small | `.arc-small` | 14.0 px | 400 | Sentence case |
| Data | `.arc-data` | 16.0 px | 400 | Tabular figures |

**Rule — caps and tracking belong to a label of two words or fewer.** A sentence in caps is the
fastest way to make a HUD unreadable. Everything a user must actually read runs in sentence case.

**Rule — numbers use tabular figures.** A changing value must not shift the line beside it.

**Rule — the scale is rem based** (E1), so 200 % zoom keeps the hierarchy (WCAG 1.4.4). No fixed-height
text container, no `overflow: hidden` on text.

**Rule — an element declares what it must not inherit.** Every element root names its own `font-family`,
`font-style`, `font-weight`, `letter-spacing`, `line-height`, `text-align`, `text-transform`, `white-space` and
`word-spacing`, because a chip inside a heading must be the same chip as one inside a paragraph. Measured before
the seal: in a parent with `line-height: 3`, a serif face, 4 px tracking and lowercase, a chip line-height went
19 → 39 px and its face went serif, and a key/value value picked up the tracking and the casing; a button stayed
identical because it already declared its stack. After the seal all three are identical to their clean instance.

---

## 5. Space and the frame

**The master frame is 390 × 844** (D3). Every element proves itself there. A wider viewport adds space;
it never adds a structure.

| Unit | Formula | At 390 | At 1440 |
|---|---|---|---|
| `--arc-u` | `clamp(0.875rem, 0.861rem + 0.571cqi, 1.375rem)` | 16.00 px | 22.00 px |
| `--arc-fs` | `clamp(1rem, 0.94rem + 0.247cqi, 1.125rem)` | 16.00 px | 17.8 px |

Spacing is the unit times a multiplier: 4, 8, 12, 16, 24, 32, 48, 64, 96 px at a 390 px frame.

**Why not percentages** (E1). A percentage on `padding-top` or `padding-bottom` resolves against the
containing block's inline size, so it is a fraction of the width on every side. A height fraction
cannot be written that way. Use the unit, `env(safe-area-inset-*)` for the shell edges, and `100svh`
for the screen height.

**Rule — no control is shorter than 44 px** (E10). There is no small size: a 36 px button passes a
visual review and fails the hand. `--arc-control-height-m` is `clamp(44px, u*2.75, 48px)`,
`--arc-control-height-l` is `clamp(52px, u*3.25, 56px)`.

**Rule — the shell owns the edges.** `.arc-shell` applies the safe-area insets and the outer padding;
no element adds its own margin to reach the screen edge.

---

## 6. Layers

| Layer | z-index | Holds | Material |
|---|---|---|---|
| Ambient (0) | 0–9 | Grid, scanlines | None. Never interactive, never carries information. |
| Content (1) | 10–49 | Panels, rows, meters | Hard edges, panel ground |
| Control (2) | 50–500 | Navigation, buttons, dialog, toast | The one place an optical material is allowed |

All three are implemented. The ambient grid and the scanlines are fixed layers at z 0 and 1. Panels and
items carry content in the flow. `.arc-bar` and `.arc-dialog` are control: the bar is a flex item of the
shell, and a dialog sits in the browser's top layer, above the whole ladder rather than inside it. The
control layer is still the only place a blurred material is allowed.

**Rule — ambient carries no text.** A scanline pattern over a label lowers its contrast and the gate
cannot see it.

---

## 7. Motion

**Rule — animate `transform` and `opacity` only** (E5). A `filter`, `clip-path`, `box-shadow` or
`text-shadow` animation repaints the region every frame; 390 × 844 at DPR 3 is 2.96 M device pixels per
frame, which the software raster path cannot do at 60 fps.

**Rule — a pulse animates the opacity of a separate layer**, never the shadow itself.

| Token | Value | Use |
|---|---|---|
| `--arc-motion-instant` | 50 ms | Press feedback |
| `--arc-motion-quick` | 120 ms | Hover, state change |
| `--arc-motion-fast` | 220 ms | Toggle |
| `--arc-motion-normal` | 320 ms | Panel, reveal |
| `--arc-motion-deliberate` | 460 ms | Modal, screen change |
| `--arc-ease-snap` | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements that land |
| `--arc-ease-step` | `steps(2, end)` | Discrete, machine-like change — the glitch and the caret |

**Rule — a glitch is a signal, not a texture** (D8). It runs on a state change, never on a timer.

| Effect | Class | Trigger | Duration | Limit |
|---|---|---|---|---|
| Sweep | `.arc-sweep` | A panel appears or refreshes | `--arc-motion-sweep`, 620 ms, one pass | Never looping |
| Glitch | `.arc-glitch` | A state that disagrees with itself | `--arc-motion-glitch`, 240 ms, one pass | 3 px displacement, 30 % alpha, no brightness flash |
| Reveal | `.arc-reveal` | Content lands | 320 ms, stagger 50 ms via `--arc-i` | Movement of 6 px at most |
| Caret | `.arc-caret` | A live value | `--arc-motion-caret`, 1 Hz blink | The only loop in the system |

Every animation in the system sits inside one `@media (prefers-reduced-motion: no-preference)` block, so
a reader who asks for less motion gets none of them rather than a shortened version. Measured with
`node tools/shot.mjs --media-reduce --eval …`: all four report `animation-name: none`.

Hard limits, from WCAG 2.3.1 and 2.4.13: never more than three changes of brightness in one second, never
a saturated-red strobe, never a flash over more than a quarter of the screen, never a displacement larger
than 3 px on text, and never a glitch on the focus ring.

---

## 8. Elements

### 8.1 Button — `.arc-btn`

Purpose: one action. Variants: `--primary` (filled accent), `--secondary` (accent frame), `--ghost`
(text), `--danger` (filled error). Sizes: default (44 px) and `--l` (52 px).

States: default, hover (glow), pressed (`translateY(1px)`), focus (2 px ring, offset 2), disabled (raised
ground and low ink, never a faded accent — E59), toggled (`aria-pressed`, strong accent fill).

**Do** use one primary per view. **Do not** disable without a reason on screen.

### 8.2 Panel — `.arc-panel`

Purpose: a block of data. Anatomy: hairline frame, two hot corners, a head row, then content.
`--flat` drops to the base ground. `--alarm` adds a class colour: `--arc-panel-alarm` sets the top rule
and the two brackets, and the hairline frame stays.

**Do** put the class in the head as a chip as well. **Do not** turn the whole border into an alarm
colour; the panel then reads as a different component.

The corners are neutral by default and take the accent only under `--active` — the panel the view is
about. A page of cyan corners spends the accent everywhere and marks nothing.

### 8.3 Item — `.arc-item`

Purpose: one row of a list, tappable or not. Anatomy: a two-line text block (title, mono meta) and an end
slot for a chip and a chevron. `button.arc-item` gets a press state; hover is gated to a fine pointer.

**Rule — a row that asks a question is an item, not a key/value pair.** A setting reads «Alert when a disk
passes 85 %»: the phrase takes `.arc-item__title`, its evidence takes the mono `.arc-item__meta`, and the
control stands at the end of `.arc-item__end`. The key of `.arc-kv` cannot hold it, because the key is set in
caps with tracking and §4 cuts a label at two words. The showcase carries both forms at the master frame —
the pair inside the reactor panel, the phrase row in the `Lanes` panel — so the two are compared and not
imagined. Measured: the phrase takes 212 px in a 212 px slot at the h3 step — it fits with nothing to spare, and
a word more goes to the ellipsis — and its row stands at 62.3 px with the rows above it.

**The frame the phrase fits is 390.** Measured across four widths: the setting phrase reads in full at 390, 430
and 768, and is cut at 320 (`212 > 193 px`), which is the first number to check before a consumer decides to
support a smaller phone. The gate measures 390 and 768; 320 is a documented limit, not a promise.

**Refusal — the title is one line.** `.arc-item__title` carries `white-space: nowrap` and an ellipsis, because
a list row is scanned and not read. A phrase that outgrows the row is a sentence: it goes into the body text
above the list, and the row keeps the short name of the thing it switches. Keep a setting label to one line:
measured, seven words more than the example take 324 px of a 261 px slot and are cut.

Appendix C shows the tappable form, because it is the page's first instance; the setting row with a switch is the
second instance in `index.html` and carries the same child classes, with `.arc-switch` in `__end`.

**Do** use one item kind per list. **Do not** put a second action inside the row: the row is the action.

### 8.4 Empty — `.arc-empty`

Purpose: a list with no entries still says what happens next. Anatomy: a title, one sentence of 28
characters per line at most, centred.

**Do** keep it inside the panel that would hold the list.

### 8.5 Field — `.arc-field`, `.arc-input`

Purpose: one input. Anatomy: label, control, hint or error. The control keeps a full rectangular frame
and a recessed void ground. Error state: `aria-invalid="true"` plus a message with `role="alert"`.

**Do** label every field, visibly. **Do not** use the placeholder as the label. **Do not** leave the
primary action enabled while the only field on the screen is invalid: a red message under a large cyan
button is read as an invitation to press it again.

**A field carries its action inside the frame.** The control row holds a leading mark and one trailing
action, both inside the input's own border, so the field stays one row and the action never moves when
the message under it appears. The action keeps the 44 px floor on both axes, and the input reserves the
action's width in padding, so a value is never painted under a control.

**A field that grows downward pads on both axes.** A single-line input centres itself inside the row, so
`padding-block` of zero costs nothing; a textarea puts its first line exactly where its padding says. Measured
before the fix: inset 0 px at the top against 11.87 px at the side, so the words sat on the frame. With
`padding-block` at `--arc-space-2` the ink sits 14 px from the top and 13 px from the left — the same inset,
read by the eye.

**A field with an action is a `div`, not a `label`.** A button is a labelable element, so it may not sit
inside a `label`; the label element points at the input with `for`. The simple field keeps the `label`
wrapper.

**The mark takes the row where the sprite has one, and the word stands in where it does not.** A secret
carries the eye and its struck twin; the act keeps `aria-label` and `aria-pressed`, and the mark reads at the
body size rather than at the act's micro type. Where the sprite has no mark for an act, the act carries its
word, because a pictogram invented for an act is a guess at arm's length. The word and the mark never share a
44 px row: the pair measures 72 px against the 71.87 px the input reserves for the action.

**Do** use one action per field. **Do not** put two acts at the trailing edge of one field: they divide
44 px between them.

### 8.6 Chip — `.arc-chip`

Purpose: carry a class on a short word. Variants: `--accent`, `--attention`, `--critical`, `--error`,
`--ok`. Anatomy: dot plus word, never the dot alone.

**The ground is one the gate measures.** The fill is `bg.base`, because every status ink is a declared pair
against that ground in both schemes. On `bg.raised` — the previous fill — three of the eight pairs fell below
4.5:1: dark critical 4.22, light attention 4.37, light error 3.95. A chip keeps a recessed pill inside a panel;
on the page ground it reads as a word and its dot, which is how a class already reads (§3).

**A selected chip is filled.** `--selected` puts the accent behind near-black ink, so a filter that is on
can never be outranked by a status chip beside it. Selection beats status; the reader must see what is
filtered before what is wrong.

**A chip names a state, not an action.** `DONE`, `RUNNING`, `SLOW`, `FAILED`. A verb in a chip reads as a
button, and the reader then taps a label that does nothing.

### 8.7 Meter — `.arc-meter`

Purpose: a value between a floor and a ceiling. Anatomy: track on `--arc-bg-raised`, fill in the accent,
chamfered end, value set through `--arc-meter-value`. `--attention` and `--critical` recolour the fill.

**Do** print the number next to it. **Do not** let colour be the only threshold signal.

### 8.8 Bottom bar — `.arc-bar`

Purpose: four to five destinations on a phone. Anatomy: hairline top rule, items on the touch floor, the
active item marked by `aria-current="page"` with a 2 px rule and the accent.

**Rule — a sub-screen keeps the bar and marks its parent.** Settings reached from a destination is still that
destination: the item stays current, and the screen's own head says where the reader is. A second bar with a
different item current is a second navigation model in one app, and the reader cannot tell which one moved.

### 8.9 App shell — `.arc-shell--app`, `.arc-screen`, `.arc-appbar`

Purpose: a root screen with a head that stays, a middle that scrolls and a bar that never leaves.
`.arc-shell--app` fixes the frame to `100svh` with `overflow: hidden`; `.arc-screen` is the only scroll
container and carries the bottom padding; `.arc-bar` is a flex item that cannot shrink. `.arc-appbar`
holds a meta line and a title row with one action at the trailing edge.

**`.arc-screen` carries no rhythm.** It pads its foot for the bar and nothing else: no element adds a margin,
so two panels placed one after the other touch. The page sets one stack gap between its blocks —
`--arc-space-4` — and a screen of touching panels reads as one table.

**A sub-screen keeps the bar, so the app bar carries no back mark.** The rule is §8.8: the destination stays
current and the screen's own head says where the reader is. `chevron-left` exists for a control that returns,
not for the bar, and a second way back beside a current destination is a second navigation model.

**Do** keep only the head outside the scroll region. **Do not** pin anything with `position: fixed`: the
shell already does it, and a fixed element inside the shell ignores the safe-area insets.

### 8.10 Dialog — `dialog.arc-dialog`

Purpose: one decision, above everything. A native `<dialog>` supplies the focus trap, the Escape key and
the top layer; the system supplies the surface, the backdrop and the actions row.

**Do** open it with `showModal()`. **Do not** hand-write a focus trap, and never clip the dialog: it
carries the focus ring and the only content the user can reach.

### 8.11 Table — `.arc-table`

Purpose: two or more comparable columns. Fewer than two comparable columns is a key/value list
(`.arc-kv`), not a table.

Anatomy: a head row, then one row per record; the first cell holds text, the rest are right aligned and
set in tabular figures. On a 390 px frame a table holds three columns. More columns go into
`.arc-table__scroll`, which gives the row one column per cell and scrolls: a fixed three-column template dropped
the fourth cell onto a second implicit row, measured 69.27 px tall against 35 for its neighbours. A wide table is
still a sign that the screen wants a different shape.

A key/value pair is `.arc-kv` with `.arc-kv__key` and `.arc-kv__value`; `.arc-row` puts a pair and a control
on one line, and then the key is the label and the control is the value.

**`.arc-kv` is one pair, not a list.** It draws the pair and nothing between pairs; a block of them is the
page's stack, with one gap from `--arc-space-2`. Divided pairs are `.arc-row`, which carries the hairline and
the pair's own vertical padding — the divided form exists, and the flat one does not grow rules of its own.

**Do** keep numbers right aligned and in the mono face. **Do not** set a long sentence in a cell.

**Rule — a phrase is not a key.** The key owns the caps and the tracking §4 allows, and §4 allows them on two
words at most: «Alert when a disk passes 85 %» set that way is the least readable line on the screen, and in a
table cell it turns a column into a paragraph. A phrase goes to a row of its own (§8.3), where it is set in
sentence case at the h3 step with the control at the end. `kv` keeps pairs — `Load` and `84.2 %`, `Device` and
`ilja-iphone` — and a pair whose label needs a sentence is a row, not a pair.

**A row carries no state class.** `.arc-table__row` has `--head` and nothing else. The state of a record —
a disk above its threshold, a lane that just failed — goes into the panel head as a chip, which names it in
words. A colour on one row of a grid reads as a zebra stripe, and a row that means to signal then looks selected.

**One column template for every row.** A row that lays out its own `auto` columns sizes them to its own
content, so the head and the numbers land on different axes and every row disagrees with its neighbour.
The numeric columns take a fixed width from `--arc-table-col`, which is the one value that makes the
columns agree.

### 8.12 Tabs — `.arc-tabs`

Purpose: a switch between views of the same data. Not navigation: a destination belongs in the bar.

Anatomy: a tab row on a hairline, the active tab in the accent with a 2 px rule under it. Every tab
keeps the 44 px touch floor, which is why a short label still measures 44 px wide.

**Do** keep the tab count to three or four. **Do not** hand-write the arrow-key handling: the app
supplies `role="tablist"` behaviour, the system supplies the surface.

### 8.13 Skeleton — `.arc-skeleton`

Purpose: the shape of content that is coming. Anatomy: a bar on the raised ground with a sweep.

The sweep moves a gradient with `transform` only, so the bar never repaints. Under
`prefers-reduced-motion: reduce` the sweep is removed and the bar stays static.

**Do** match the skeleton to the real block. **Do not** let a skeleton stand in for more than three
seconds: after that the screen owes the user a number and a progress bar.

### 8.14 Toast — `.arc-toast`

Purpose: a status that arrives on its own. It is control layer, fixed above the bar, never over it.

Variants `--ok`, `--attention`, `--error` recolour the frame and the mark. The mark is a glyph, so the
class never rests on colour alone.

**Do** show one toast at a time and give it `role="status"`. **Do not** auto-dismiss an error: the user
closes it.

### 8.15 Switch — `.arc-switch`, `.arc-switch__track`

Purpose: a setting that is on or off. `role="switch"` with `aria-checked` carries the state, so no class
does.

The control keeps the 44 px floor; only the painted track is 24 px high. The knob moves with
`transform`.

The track draws its outline as an inset ring, not a border. A border shrinks the padding box by 1 px
per side, so an inset of `0.25 × unit` lands 4 px from the leading edge and 2 px from the trailing
one — the knob looks off-centre in a way no tolerance hides. With a ring the box keeps its size and
every side measures the same (3.96 px at a 390 px frame).

**Do** put one switch at the end of an item. **Do not** use a switch for an action: it changes a state
that persists. Where the state decides something the user cannot see, write the state in words beside the
switch: position and colour alone are a guess at arm's length.

### 8.16 Code — `.arc-codeblock`, `.arc-code`

Purpose: a log, a payload, a command. `white-space: pre` keeps the columns, and the block scrolls
sideways.

**Do** let a long record scroll. **Do not** wrap a log line: a wrapped record reads as two records, and
the reader then debugs a line that never existed. `--wrap` exists for prose-shaped content only.

**A record that names itself takes a bar.** `.arc-codeblock` holds the frame, a bar at the touch floor
with the record's name and up to two acts, and the record itself, which keeps its own horizontal scroll
and its mask. The frame moves to the wrapper, so the bar and the record share one box.

**An act carries a word.** The glyph, where the sprite has one, stands before the word and never replaces
it. A copy reports itself in words — `COPIED`, back to `COPY` when the timer ends — and a pause keeps its
state in `aria-pressed` beside the word. A report a reader can only see as a colour is a report the reader
misses.

**A stream keeps its columns until the reader says otherwise.** The third act is a toggle: `SCROLL` while
the record runs sideways, `WRAP` while it runs on into lines, and `aria-pressed` carries the same state. The
record reads that attribute through `:has()`, so a consumer writes no script for the switch, and the wrapped
form drops the mask — a mask that promises a scroll on a block that no longer scrolls is a lie on screen.
The glyph identifies the control and the word names the state: where the sprite carries one mark for a
control, that mark does not change; where it carries a pair (`play`, `pause`), the mark follows the state.

**Do not indent a wrapped record.** `text-indent` acts on the first line of the block, not of each record:
on a `pre` holding two records it pushed the second record's timestamp to the continuation position and made
the whole block read as one long record — seen on the showcase, where a 48 px hanging indent put three of
four lines at the deeper margin. A wrapped record therefore stays flush, and the word `WRAP` is the only
signal that the form changed.

**Do** give the bar the two acts the record needs. **Do not** put a toolbar there: four acts at the touch
floor leave no room for the name.

**Some values exist for the consumer, and nothing in this file paints them.** `--arc-space-10`, `--arc-space-12`,
`--arc-tracking-body`, the motion steps `instant`, `fast` and `deliberate`, `--arc-ease-in`, the two glow floors,
and the fill and press steps of the status ladder beyond the two the chip uses. They stay because a product
paints them: a lane card with an ok fill, a control with a pressed attention step. A value that is neither
painted here nor named there is dead and leaves the dictionary — `graphic.crimson` and `stroke.strong` did.

**The consumer sets four properties, and they are the element's inputs.** `--arc-meter-value`,
`--arc-bar-value`, `--arc-skeleton-width` and `--arc-i` carry a value the page knows and the stylesheet cannot:
a percentage, a bar height, a width, a stagger index. Each carries a fallback — 50 %, 0 %, 100 % and 0 — so an
element drawn without its input still has a shape instead of collapsing; a consumer that omits one gets a
plausible default and not a broken box.

**The record never exceeds its frame.** A `pre` with `white-space: pre` carries a max-content width, so in
a grid or flex parent it sizes the track and pushes the block past the screen — measured as
`arc-code right 416.6 / 390` on the first render of the bar. The element caps itself at `100%` and scrolls
inside, so a consumer needs no `minmax(0, 1fr)` to make it behave.

### 8.17 Section label — `.arc-section-label`

Purpose: a group heading inside a panel, so two groups do not read as one list. A hairline runs from the
label to the panel edge.

**Do** put it above the rows it groups. **Do not** use it as a panel title: a panel has a head row.

### 8.18 Readout — `.arc-readout`

Purpose: the one number a screen is about — a countdown, a mass, a distance.

Anatomy: a label at the micro step, then the value at `--arc-fs-readout` (3.5 × the type unit, **56 px**
at a 390 px frame). The unit sits on the same baseline at the h2 step. `--center` for the hero case,
`--attention` and `--critical` for the two alarm classes.

**Do** give a screen one readout. **Do not** track the digits or use a proportional face: tabular figures
and zero tracking keep a changing value from shifting the line beside it.

### 8.19 Icon — `.arc-icon`, `assets/icons.svg`

Purpose: a mark beside a word. The **catalogue** holds 2410 glyphs — Lucide 1.77.0 under the ISC licence
(`assets/icons-ISC.txt`) — every one on a 24-unit grid with a 2-unit stroke. The **sprite** ships the names in
`assets/icons-manifest.json`; `tools/icons_sprite.py` builds it from that list. `icons.html` renders the whole
catalogue with its names, and `docs/icons.png` is that page as a picture.

Anatomy: `.arc-icon` is one `em` square, stroke only, `currentColor`; `--s` and `--l` are 0.75 and 1.5 em. Caps
and joins are round, because the catalogue is drawn for them and a miter join on a curved path grows a spike
at small sizes.

**Rule — take from the catalogue; draw only what it lacks.** A screen names a catalogue glyph in the manifest
and rebuilds; that is the whole gesture. A hand-drawn glyph joins `assets/icons/` only when the catalogue has
no concept for it, and `tools/icons.py` then proves it sits on the same grid.

**Rule — the sprite is what ships, the catalogue is what exists.** All 2410 glyphs in one file would be twelve
times the stylesheet and every screen would pay for it. The manifest keeps a product on the names it uses,
and a new glyph is one line.

**Rule — a typed mark is a defect.** Two screens carried a `✗` in a field message and three carried a `›` at
the end of an item. A character depends on the font and on the platform's fallback, so the same screen grows a
different mark on another phone, and the size follows the text instead of the grid. The message carries
`circle-alert`, the item's end carries `chevron-right`, and the sprite is the only place a mark is drawn.

**Rule — a pair that names one control in two states is drawn as a pair.** `eye` / `eye-off`, `play` /
`pause`, `chevron-left` / `chevron-right`, `chevron-up` / `chevron-down`: the control swaps the mark and
never invents a third.

**Rule — the sprite is checked, not eyeballed.** `tools/icons_sprite.py --check` fails on a stale sprite and
`tools/icons.py` asserts one grid, closed bounds, unique names and agreement with the manifest; both run
inside `tools/gate.sh`. The audit counts an icon as missing only when its box is empty in **both** axes, since
a glyph that is a single vertical stroke (`letter-i`, `tally-1`) has no width and is not a defect.

**The sprite is a separate document, so the page needs an origin.** Over `file://` the browser refuses
the fetch and every icon draws an empty box — silently, and a row of nine empty squares reads as a clean
row. Serve the page (`python3 -m http.server`) for a render, and let the frame audit report a zero-box
icon, which it now does.

**Do** always pair an icon with its word, or with an `aria-label` where the row has no room for a word.
**Do not** use an icon as the only cue of a class.

### 8.20 Bars — `.arc-bars`

Purpose: compare a handful of values. Anatomy: one bar per value, height from `--arc-bar-value`, a label
row underneath, `--now` for the current value and `--over` for one past its limit.

**Do** show five to seven bars. **Do not** ask a bar for a number: a bar carries area, so the reader can
see which is bigger and not by how much. A chart that must state a value needs a labelled axis, and a line
chart needs SVG — neither belongs to the CSS layer.

### 8.21 Alert — `.arc-alert`

Purpose: a message that belongs to the screen rather than to one field. Anatomy: a 2 px rule in the class
colour, the panel ground, an icon and one sentence.

Variants: `--attention`, `--error`, `--critical`, `--ok`.

**Do** use it when two or more fields block the screen, and keep the per-field message under the field.
**Do not** stack two alerts of different classes: one view, one class.

### 8.22 Fault — `.arc-fault`

Purpose: the screen that stands where the content failed — an offline relay, a dead service, a state the
app cannot render. Anatomy: the app bar stays, the block centres in the scroll region, a mark and a class
word in the class colour, a title, one sentence at 28 characters a line, the record in the code element,
and at most two actions. Variants: `--attention`, `--error`, `--critical`, one class per view.

**Do** keep the shell: the head stays so the reader can leave, and the block lives inside `.arc-screen`,
where it centres between the head and the bar. **Do not** carry navigation of your own and do not show a
stack trace — one code answers "which failure", and a trace answers nothing a reader can act on.

**Rule — the record on a fault screen wraps.** The `pre` rule keeps columns for a stream a reader scans.
A fault code is one line the reader must read and copy whole, so it takes `--wrap`: a code cut at the mask
sends the reader scrolling a screen that is already telling them something is broken.

**Rule — the gap is the only space between the parts.** A `<p>` keeps the browser's own margin until it is
removed; measured, that margin pulled the centred block 12 px off the middle of the screen. Every child of
the block therefore starts at zero margin.

### 8.23 Link — `.arc-link`

Purpose: an action in words. Anatomy: the words in the accent, a hairline underline, and an optional mark
after them when the action leaves the screen (`chevron-right`). Variants: `--quiet` for the second action
beside the one that leads.

**Rule — a link keeps the touch floor.** An action in words is still met by a finger: the element carries
`min-width` and `min-height` at the control height, and `vertical-align: middle` lets it stand inside a
sentence without lifting the sentence off its baseline. Measured: 110 × 44 px inside a sentence,
44 × 44 px at its shortest words.

**Do** use it for an action that cannot be a button — reset, retry, read more, leave for another screen.
**Do not** use it as navigation: a destination belongs in the bar. **Do not** put two links in one sentence:
the reader cannot see where one target ends and the next begins.

### 8.24 Steps — `.arc-steps`

Purpose: where a wizard stands. Anatomy: a label in words above a track of equal segments; the segments
that are behind, the one that is current, and the ones ahead. Variants on the segment: `--done`, `--now`.

**Rule — the number lives in the words, not in the picture.** The label reads `STEP 2 OF 3 · DEVICE`, so a
reader who cannot separate the two greys still knows where they are; the track is `aria-hidden`.

**Rule — the current segment differs in shape as well as colour.** It stands 2 × the height of the others —
measured 7.91 px against 3.95 px — because a brighter bar of the same size is a difference in colour alone.
Segments measure 105.48 / 105.50 / 105.48 px, equal within a fifth of a pixel.

**Do** use one track per wizard, three to five segments. **Do not** use it as a meter: a meter carries a
value between a floor and a ceiling, a step indicator carries a position in a fixed set.

### 8.25 Chart — `.arc-chart`

Purpose: a value over time. Anatomy: a name and the peak in words above the plot, a plot with three
gridlines, the area under the line, the series line, a marker on the newest value, an axis of values at the
left and an axis of periods below. The markup is emitted by `tools/chart.py` and never typed by hand.

**Rule — the axis carries the numbers.** A chart without a labelled axis is a shape: the reader sees which
way the line moves and cannot say by how much. The peak stands in the head as words (`Sun · 24`), the axis
carries the floor, the middle and the ceiling, and the SVG repeats the whole sentence in `aria-label`.

**Rule — the plot stretches, the strokes do not.** The path is drawn in a 100 × 100 viewBox and stretched by
CSS; every mark carries `vector-effect: non-scaling-stroke`, so the line stays 2 px and the marker 6 px at
any frame width. The marker is a zero-length round-capped segment, because a `<circle>` in a stretched
viewBox paints as an ellipse.

**Rule — the axis labels live in HTML, not in the SVG.** Type inside a stretched viewBox scales with the
frame, so a wide viewport would grow the caption instead of the plot. The labels sit in a two-column grid
around the SVG, and each number is lifted by half its height so it sits on its gridline rather than under it.

**Do** use one series per chart. **Do not** put two scales in one plot, and do not draw a line through three
values: a bar carries area for a handful of values, a line carries a trend of five or more.

### 8.26 Sheet — `dialog.arc-sheet`

Purpose: a choice from many, a confirmation, or a short list of actions that arrives from the bottom edge.
Anatomy: a grabber mark, a head with a title and a close, a body that scrolls, and the safe-area inset at its
foot. It is a native `<dialog>` with `showModal()`, so the top layer, the focus trap and the Escape key are the
platform's, exactly as in §8.10 — a sheet is a dialog that sits at the bottom, never a second overlay.

**Rule — on a phone a choice from many is a sheet, not a dropdown.** A popover list covers the content it
explains, and a native `<select>` brings the platform's own look onto a screen this system was asked to draw.

**Rule — the sheet never grows past four fifths of the frame.** Measured at 390 × 844: six options at the
touch floor give a sheet 356.4 px tall, starting at 487.6. Past that height the body scrolls and the sheet
stays put.

**Do** give a sheet one job. **Do not** stack a sheet on a sheet, and do not put a second scrim under it: the
backdrop is `--arc-overlay-scrim` and the lift is `--arc-shadow-sheet`, one token per scheme.

### 8.27 Select — `.arc-select`

Purpose: a field that opens a sheet. Anatomy: the same frame, void ground and mono value as `.arc-input`, with
`chevron-down` at the end. `aria-haspopup="listbox"` and `aria-expanded` carry the state; the expanded frame
and its mark take the accent.

**The contract is three lines of script, and the system does not write them.** The trigger calls
`sheet.showModal()` and sets `aria-expanded="true"`; a chosen `.arc-listbox__option` writes its text into
`.arc-select__value`, moves `aria-selected`, and closes the sheet; the sheet's `close` event sets
`aria-expanded="false"`. `index.html` carries the same three lines for a consumer to copy.

**Do** label it with `.arc-field__label` and a `for` that names the button. **Do not** build it from a native
`<select>`: the platform menu ignores every rule above.

### 8.28 Listbox — `.arc-listbox`

Purpose: the options inside the sheet. Anatomy: one row per option at the touch floor, a hairline between them,
and a `check` on the chosen row. `role="listbox"` and `role="option"` with `aria-selected` carry the meaning
for a reader who cannot see the mark.

**Rule — the chosen row carries a mark as well as the colour.** Measured: six rows at 44 px each; the selected
row keeps its check when the accent is removed, which is what a monochrome reader sees.

**Do** keep a listbox to seven rows and let it scroll inside the sheet. **Do not** put a second action inside a
row: the row is the choice.

### 8.29 Icon button — `.arc-icon-btn`

Purpose: a mark that is itself the control — an overflow, a close, a row action. Anatomy: a 44 px box around a
16 px mark, no fill, no frame. Variants: `--danger` for a destructive act.

**Rule — the floor belongs to the box, not to the drawing.** Measured: the box is 44 × 44 and the mark inside
it is one em. A mark with no word needs `aria-label`; a glyph alone is a guess at arm's length.

**Do** use it where a word would not fit and the mark is unambiguous. **Do not** put two of them side by side
in a bar and expect a reader to tell them apart.

### 8.30 Check — `.arc-check`

Purpose: one or more independent choices in a list. Anatomy: the native input stretched over the whole row,
the mark beside it, the words and an optional mono meta line.

**Rule — the row is the target and the input is the control.** The input fills the row — measured 324.4 × 44
over the label — so the thing the finger presses is the thing that changes, and the audit measures it. The
mark is 24 px inside that row, painted on a sibling so the sprite can supply the check: a background image
cannot follow `currentColor`.

**Rule — a chosen box is filled with the accent and carries a check in the invert ink.** Colour alone would
leave a reader who cannot separate two fills with no state at all.

### 8.31 Radio — `.arc-radio`

Purpose: exactly one choice out of a few. Same anatomy as `.arc-check`; the mark is round. The words and the
meta line are `.arc-check__text` and `.arc-check__meta`, shared with §8.30: one text part serves both, so a
column of checks and a column of radios read the same.

**Rule — a chosen radio is a ring and a dot, not a punched disc.** The ground stays visible between the dot and
the rim, which is how a reader tells a radio from a checkbox at 24 px; the ring is `--arc-stroke-focus`.

**Rule — the dot is a gradient, not a box centred by flex.** A percentage box centred inside a mark that is
itself fractional lands on a fraction: at a 768 px container the mark measures 26.89 px and the dot 12.00 px,
and the dot sat 0.50 px up and left of the ring's centre — visible at a glance on a zoomed render. A radial
gradient starts at the box's own centre and cannot drift: measured 0.00 px across six widths and three
densities.

**Do** group two to five radios in one list. **Do not** use a radio for a setting that persists — that is the
switch.

### 8.32 Menu — `.arc-menu`

Purpose: a short list of acts on one object. On a phone it arrives as the sheet its trigger opens: same
platform behaviour as §8.26, `role="menu"`, one row per act at the touch floor.

**Rule — a destructive act carries the error colour and its own mark.** Measured: four rows at 44 px; the
last row is `--danger`, its text and its trash mark in the error hue, so the act is not distinguishable by
colour alone.

**Do** open a menu from `.arc-icon-btn` with `aria-haspopup="menu"` and `aria-expanded`. **Do not** put more
than five acts in one menu: six is a screen.

### 8.33 Slider — `.arc-slider`

Purpose: a value between a floor and a ceiling, dragged. Anatomy: the native range, the value beside it in mono
tabular figures, and an optional sentence under the row. The thumb is square — the system has no round corner,
and a pill thumb would be the only circle on the screen.

**Rule — the box is the target, the track is a line inside it.** The input stands at the control height and the
track is `--arc-space-1` high, centred by a background gradient. The first cut sized the box to the thumb and
the audit reported a 23.7 px target: the row was 44 and the control inside it was not.

**Rule — the fill needs the value, and Chrome has no progress pseudo-element.** The consumer sets
`--arc-slider-value` as a percentage and one gradient paints the filled part against the track; the same script
writes the number beside it, because a thumb alone never says 62 %.

### 8.34 Badge — `.arc-badge`

Purpose: a count on a mark that is already a target — a bar destination, a bell, a word. Anatomy: a filled box at
`--arc-space-5` high with the number in mono tabular figures. Variants: `--attention`, `--error`, and `--dot`
for a state with no number.

**Rule — a badge has no floor of its own.** It is not a control: the item under it is the target, and a 44 px
badge would push the row apart. Every badge sits inside a control that carries the floor.

**Rule — the count never touches its word.** The element owns the gap, because the word is the consumer's text
and cannot carry one: measured 7.91 px at the master frame, and the box sits within 0.69 px of the lowercase
x-height centre — the number is centred on the letters, not on the line.

**Do** put a badge on a destination or a bell, never on a button as decoration. **Do not** let a count be the
only sign of a class: the word travels with it.

### 8.35 Combobox — `.arc-combobox`

Purpose: a field that suggests while the reader types. Anatomy: the input with `role="combobox"`,
`aria-expanded`, `aria-controls` and `aria-autocomplete="list"`, then a list of options under it.

**Rule — the results hang off the field, in the flow.** Measured: no gap and no top rule, so field and list read
as one control that grew down. A sheet would cover the lower half of the frame — exactly where the keyboard
stands — and the reader would type blind.

**Do** scroll the list at seven rows. **Do not** open a second surface on top of it: the list is the surface.

### 8.36 Form — `.arc-form`

Purpose: a form whose failure blocks its own action. Anatomy: the fields, then the summary, then the actions.
The summary carries a title with the count, one row per failing field, and a link to each.

**Rule — the summary stands directly above the action, and names only the fields that fail now.** Measured at
390 × 844: the summary is 324.4 × 141.9 px with two rows of 44 px each, 15.8 px above the buttons. A row that
names a field already fixed sends the reader back to a field that is fine.

**Rule — the action is disabled, and the reason is on the screen.** Never a tooltip, never colour alone: the
summary is the reason, and it sits in the same glance as the button.

**Rule — every failing field keeps its own message under it.** The summary is an index, not a replacement; the
reader who fixes one field looks at that field, not at the top of the form.

**Do** cap the summary at three rows and say how many are left. **Do not** clear the summary while a field is
still failing, and do not show it for a single field that has its own message in view.

### 8.37 Group — `.arc-group`

Purpose: one decision made of several choices — a `fieldset` with a `legend`. Anatomy: the legend in the field
label's type, an optional hint, then the rows (radios, checks, switches). Variants: `aria-invalid="true"` on the
fieldset, which carries the error colour to the legend.

**Rule — a group of choices carries its legend.** Five radios under one heading are one question, and a reader
who hears only the answers has to guess what they answer. The legend is the group's name, not a heading for the
page: a panel head already names the block.

**Do** put the group's hint between the legend and the first row. **Do not** put a second group inside a group:
nest the panels, not the fieldsets.

### 8.38 Count — `.arc-count`

Purpose: a field with a limit. Anatomy: the field, then a mono line under it that says what is left. Variants:
`--over` in the error colour, and `aria-live="polite"` on the line so the number is not only seen.

**Rule — the limit is said, never cut.** `maxlength` truncates a pasted text without a word, and the reader
cannot tell a rejection from a lost paste: the field keeps the whole value, the line counts it, and the last
state says how many characters are too many.

**Do** state the limit in the hint as well as in the count. **Do not** block typing: a form that refuses a
keystroke teaches nothing.

### 8.39 Result — `.arc-result`

Purpose: the screen that says what happened. Anatomy: a class word, a title in the past tense, one sentence,
the record of the thing that was created, and one next action. Variants: `--ok` (the default) and
`--attention` for work that landed in part.

**Rule — a success screen owes the thing it made.** "Done" without the receipt is a claim: the record block
names the device, the key, the identifier — whatever the reader would otherwise go and check.

**Rule — it is the mirror of the fault screen.** Same shell, same centring, same one class word: a reader in
either state meets the same shape and only the class changes. It carries no navigation of its own and no
celebration; the reader came to learn whether the work landed.

**Do** give it one next action, and never more than two. **Do not** put the result in a toast: a toast leaves,
and the reader who looks away has no record.

### 8.40 Tasks — `.arc-tasks`

Purpose: a list of steps and where each stands — an onboarding, a deployment, a session. Anatomy: one row per
step at the touch floor, the step's name as the target, an optional mono meta line, and the state at the
trailing edge.

**Rule — a state is a word as well as a colour.** `Done`, `In progress`, `Not started`: measured, the three
states differ by letters before they differ by hue, so a reader who cannot separate green from amber still
knows where the step stands.

**Rule — an open step is a target, a finished one still is.** Every row is a link, because a reader changes
their mind about a finished step as often as about an open one.

**Do** keep a task list to seven steps. **Do not** use it as a meter: a meter carries a value between a floor
and a ceiling, this carries a position in a fixed set — the step indicator in §8.24 shows the same position
without the names.

### 8.41 Note — `.arc-note`

Purpose: a sentence the eye must find without a frame. Anatomy: a rule twice the focus stroke on the leading
edge, one paragraph, and no fill of its own. It is the inset text of the government systems.

**Rule — a rule, not a frame, and not even a ground.** A frame makes it a panel, and a panel says "this is the
object"; a note says "read this before the object". Measured on the render: with the panel ground the block
read as an outlined box, so the note lost its fill and kept only the rule.

**Do** keep a note to one or two sentences. **Do not** use it for a class — an alarm is `.arc-alert`.

### 8.42 Warning — `.arc-warning`

Purpose: a sentence that must not be missed, inside a form's flow. Anatomy: a triangle mark in the attention
hue and the sentence in the reading ink, at the semi-bold weight.

**Rule — the mark carries the finding, the colour only supports it.** A reader who skips long text finds a
triangle before a hue; measured, the mark is one em beside the first line, aligned to its cap.

**Do** put it directly above the action it protects. **Do not** stack two warnings: one act, one warning.

### 8.43 Disclosure — `.arc-disclosure`

Purpose: a group that folds. It is a native `<details>` with a styled `<summary>`, so the keyboard, the open
state and the behaviour without JavaScript are the platform's — the same reasoning as the dialog and the sheet.

**Rule — the mark turns with `transform`, and only the mark.** A rotating box-shadow or border repaints the row
every frame; a transform is composited. The mark is `rotate(180deg)` when open and takes the accent at the same
time.

**Do** fold what a reader needs second — settings behind a summary, history behind its own. **Do not** fold the
primary content of a screen: a fold that hides the point is a page that never opens.

### 8.44 Affix — `.arc-field__affix`, `.arc-field__control--joined`

Purpose: a unit inside the field — `%`, `kg`, `https://`. Anatomy: the frame belongs to the control row, the
affix is a flex item at either edge, the input loses its own border and keeps its focus ring.

**Rule — the affix sits in the flow, so no padding is guessed.** An absolutely placed affix forces a padding
computed from a glyph width; a flex item reserves exactly its own width and the row stays one frame.

**Rule — the affix follows the value in the reading order.** `85` then `% of peak`, never a `%` before the
number: the first render put the sign in front and the line read `% 85 of peak`.

**Do** mark an affix `aria-hidden` and put the unit in the label or the hint as well. **Do not** put an
interactive control in the affix — that is the in-field action of §8.5.

---

## 9. Applying it to a project

1. Take the release pack — `dist/arc-<version>.tgz`, where the version is the one in the dictionary — it
   contains the dictionary, the sources, the built stylesheet, the
   sprite and its fonts, `index.html`, the docs and the tools. Unpack it into `vendor/arc/`. The system stays the
   reference; the copy is yours. The pack builds and gates itself: `bash vendor/arc/tools/gate.sh` prints the same
   numbers here as in this repository.
2. Run `python3 tools/build.py`. The build writes `dist/arc.css` from the dictionary plus `src/*.css`.
3. In the page: one `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
   one stylesheet link, and every screen inside `.arc-shell`. The ambient layers are part of the skeleton — a
   screen built from §8 alone has no texture, because both layers are `aria-hidden` divs *before* the shell:

   ```html
   <div class="arc-ambient" aria-hidden="true"></div>
   <div class="arc-scan" aria-hidden="true"></div>
   <main class="arc-shell arc-shell--app">
     <header class="arc-appbar">…</header>
     <div class="arc-screen">…</div>
     <nav class="arc-bar" aria-label="Primary">…</nav>
   </main>
   ```

   A page that wants a scheme forced reads the query flag the render tool sets: `data-scheme` on `<html>` from
   `?scheme=` or `prefers-color-scheme`. The build emits both paths; without these two lines a page ignores
   `--scheme` and renders the platform's choice:

   ```html
   <script>
     const scheme = new URLSearchParams(location.search).get("scheme");
     if (scheme) document.documentElement.dataset.scheme = scheme;
   </script>
   ```
4. Use the element classes. Name tokens in your own rules. A typed value is a defect. **The shape of each
   element is Appendix C** — generated from `index.html`, one instance per root with its child classes, so a
   row is copied as `.arc-item` with `__text`, `__title`, `__meta` and `__end` instead of being rebuilt from
   prose.
5. Change a brand value by re-pointing one token in your copy of the dictionary, then rebuild. Never
   edit `src/*.css` for a brand.
6. Run the gate after the first screen and after every change that touches a colour or a layout:
   `bash tools/gate.sh` (build, staleness, contrast) and `node tools/shot.mjs --audit`. A project that
   owns a categorical palette also runs `python3 tools/categories.py <its file>`.
7. A screen that fails a gate does not ship. Report the number, not an opinion.

---

## 10. Implementing

| Path | Holds |
|---|---|
| `tokens/tokens.json` | Every value, plus the contrast pairs the gate measures |
| `src/base.css` | Fonts, page ground, shell, ambient layers, type scale, focus, motion guard |
| `src/elements.css` | The written element layer, `var(--arc-*)` only |
| `dist/arc.css` | Generated. Not in git. The install step is the build. |
| `tools/build.py` | `tokens.json` + `src/*.css` → `dist/arc.css`; `--check` fails on a stale file |
| `tools/contrast.py` | Reads the declared pairs, composites the alpha, exits 1 below `min` |
| `assets/icons.svg` | The shipped sprite, 31 glyphs from a catalogue of 2410; needs an HTTP origin, `file://` refuses it |
| `docs/palette.png` | Every colour with a sample in that colour, its ratio and its fill form |
| `tools/shot.mjs` | Renders at an exact frame through the DevTools protocol; `--audit` reports clipping and small targets; `--scheme dark\|light` pins the scheme |
| `tools/chart.py` | Emits a line chart's SVG from the numbers: 100 × 100 viewBox, non-scaling strokes, the axis in HTML |
| `tools/categories.py` | Checks a product-owned categorical palette against the accent and status hues |
| `tools/icons.py` | Checks the sprite: one grid, closed bounds, unique names; runs inside the gate |
| `tools/elements.py` | Checks that every §8 element is rendered once and every glyph drawn is in the sprite |
| `tools/geometry.mjs` | Measures the layout a page claims: block siblings share both edges, a centred stack
shares its centre, grid rows agree on column edges, one list's rows share a height, and every padding and
gap is a step or the sum of two. Relations come from `tokens/geometry.json`; a relation that is not declared
is not judged |
| `tools/markup.py` | Writes Appendix C from `index.html`: the first instance of every §8 root with its child classes; `--check` fails when the block and the page disagree |
| `tools/package.py` | Writes `dist/arc-<version>.tgz` — the release a project takes |
| `CHANGELOG.md` | What changed between two versions; the pack names the version it came from |
| `tools/gate.sh` | Build, staleness, contrast, sprite, icon and surface checks in one command |

**The consumer's inputs, all of them.** Eight properties are set by the page, not by this file; a rule reads
them with a fallback, so an element drawn without its input keeps a shape:

| Property | Element | What it carries |
|---|---|---|
| `--arc-meter-value` | `.arc-meter__fill` | a percentage of the track |
| `--arc-bar-value` | `.arc-bars__bar` | a bar height, as a percentage |
| `--arc-skeleton-width` | `.arc-skeleton` | the width of one placeholder line |
| `--arc-i` | `.arc-reveal` | the stagger index, times 50 ms |
| `--arc-slider-value` | `.arc-slider__input` | the filled part of the track |
| `--arc-panel-alarm` | `.arc-panel--alarm` | the class colour of an alarm panel |
| `--arc-fault-class` | `.arc-fault` | the class colour of a fault screen |
| `--arc-result-class` | `.arc-result` | the class colour of a result screen |

**What the pack carries, and what it does not.** The archive ships the dictionary, the sources, the built
stylesheet, the sprite with its manifest and fonts, `index.html`, this canon, the decisions, the changelog and the
tools. It does not ship the 2410-glyph catalogue, `icons.html`, `docs/*.png`, `research/` or the archive itself:
those are the design repository's own artefacts. A consumer therefore takes a glyph the manifest already names,
or comes back here to add one and rebuilds the pack.

**Releasing.** The version lives in `meta.version` of the dictionary and nowhere else; `tools/build.py` stamps it
into the header of `dist/arc.css`, so a stylesheet found in a project answers "which version is this". A release
is `python3 tools/package.py` after the gate passes and the changelog entry is written — the archive is
deterministic: sorted names, `mtime 0` on every entry and on the gzip header, so the same tree gives the same
bytes. Two consecutive runs on one tree print one sha256. `tarfile.open(..., "w:gz")` stamps the header with
the wall clock, which is how two runs once listed the same files and carried two digests.

**The outside check is a step of the release, not a lucky accident** (D21). Unpack the archive into an empty
directory, hand it to a model that has never seen this system, and let it build two screens from the pack
alone; then run `tools/lint.py` and `tools/shot.mjs --audit` on what it wrote. Half an hour, and it is the
only check that found the toast: every gate here was green while a hidden element sat in every committed
frame, and the stranger read the page as a consumer does. Its findings are defects to fix, not opinions to
weigh — one of the thirteen was its own misreading, and the other twelve were real.

**Adding an element.** Write the rule in `src/elements.css` with tokens only. Add it to `index.html`
once, at the real size, inside the frame — `tools/elements.py` fails the gate when a §8 selector is missing
from the page, and when a `<use>` names a glyph the sprite does not carry. Run the build, the gate and the
audit, then run `python3 tools/markup.py` — Appendix C is generated from the page, and the gate fails while the
block is stale. Add its anatomy to section 8 in the same commit. If it needs a value that does not exist, add
the value to the dictionary first — and an entry to `docs/DECISIONS.md` if the value is a decision.

**What the audit cannot see, and the tool that can.** The frame audit judges clipping, edges against the
viewport, the touch floor, an empty mark and a state that disagrees with the screen. It says nothing about
whether the parts sit on their places: a 20 px inset beside a 16 px one passed it, and so did a panel with no
inner padding beside a panel with 16. `node tools/geometry.mjs --url <page> --contract tokens/geometry.json`
answers that class, and the gate runs it against this showcase. The contract is the point — a sweep that
guesses which blocks must line up prints false positives (measured: 45 findings on this page, 39 of them
legal relations such as a centred stack or a control sized to its content), and a gate with false positives
gets switched off.

**What the audit looks for.** What a screenshot cannot answer, in five classes:

- **the frame** — a page wider than the frame, or a box whose edges leave it. A container with `overflow-x:
  clip` hides both from `scrollWidth`, so the edge predicate compares `getBoundingClientRect().right` with the
  viewport instead, verified against a 500 px control reported as `right 516.0 / 390`;
- **the touch floor** — a control under 44 px on either axis, read on what the finger meets;
- **the mark** — an icon whose box is empty on both axes, because a glyph that is one vertical stroke has no
  width and a one-axis test called two legal glyphs broken;
- **the state in the markup against the state on the screen** — an element that carries the `hidden` attribute
  and still has a box, and an `aria-expanded` that disagrees with the panel it names through `aria-controls`.
  Both are the same class of defect: the attribute says one thing and the screen another, and no frame shows
  it. A trigger that names no panel is reported too, because its state cannot be checked at all;
- **the dead control that answers** — a control carrying `disabled` or `aria-disabled="true"` is activated and
  the click events that reach the window are counted. The browser blocks a native `disabled` button, so a
  count above zero means the control only looks disabled: an anchor with the attribute, a `div` with
  `role="button"` and a listener, a wrapper handler around a dead control. One enabled control is probed first
  and must report a click, because a predicate that never fires prints what a clean page prints.

Proven on a page of deliberate defects: five are reported names, and the truthful expander, the truthful
collapser and the native disabled button stay silent.

The touch predicate reads `button, a[href], input, select, textarea, [role="button"]` and the input class,
and it skips an anchor whose display is `inline`: a link that runs inside a sentence is the documented
inline exception (WCAG 2.5.8), and flagging every such link would teach a reader to ignore the finding. The
system's own link is `inline-flex`, so it is measured. Positive control: a 20 px anchor reported as
`A 20.0px`, while a plain sentence link stayed silent.

**A full-page capture drops its density to fit one texture.** A page 8003 px tall at DPR 3 is 24009 device pixels,
and the compositor paints a blank band where its seam falls — measured: everything after 5650 px was missing,
including the bottom of a panel and the count under its field. `--full` now reduces the density until the whole
page fits under 16 000 device pixels and says so in its output; the committed sheet is 390 × 9623 at 1×.

**Why the audit runs in the browser** (E11). Headless Chrome with `--window-size` left the layout
viewport at 500 × 644 while the pixels said 390 × 844. A measurement taken on the wrong page is not
evidence; `tools/shot.mjs` forces the frame and prints the resolved numbers.

**A render names its scheme.** Headless Chrome answers `prefers-color-scheme: light`, so a page rendered
without a scheme is the light one: `docs/screenshot.png` and `docs/screenshot-light.png` were byte
identical while the README captioned the first as the dark scheme. `tools/shot.mjs --scheme dark|light`
pins the media feature and the page's own flag together, and the audit runs once per scheme.

**A render reads the current file.** The tool reuses one profile directory, and headless Chrome answers from
the HTTP cache: after an edit, a chart that the server was already sending was invisible to
`querySelectorAll('.arc-chart')` — the page reported `figures: 0` while `curl` fetched twelve `arc-chart`
classes. The tool therefore disables the cache for its session, and a finding that repeats after a fix is
re-read through a query string before it is believed.

---

## 11. Open forks and what is not covered

| Fork | Recommendation | Why it is open |
|---|---|---|
| — | — | F2 is closed by D17: the light scheme ships, measured at 17 pairs. |

**Not covered yet:** nothing the pilot asked for. The nine asks of the six screens are served — the switch,
the code block, the selected chip, the section label, the in-field action, the fault screen, the link, the
step indicator, the chart and the icon set — and the next fork comes from the next screen: a chart with a
second series on the same axis, a form whose summary blocks the submit, or a product shape this canon has not
met. Each arrives with its own element rule, its own tokens and its own audit.

## 12. The filter

A project either consumes the system or re-invents it, and the difference is measurable. `tools/lint.py <dir>`
decides, on four rules:

1. **A value in a consumer CSS is a defect** unless it is `var(--arc-*)`, arithmetic over one, or a keyword that
   carries no design decision — `0`, `auto`, `none`, `inherit`, `currentColor`, `transparent`.
2. **A selector that names `.arc-*` is an override**, and an override in one project is a second source of truth
   for every project. Refused.
3. **A class that starts with `arc-` must exist in the system.** A typo otherwise reads as a style that silently
   does nothing.
4. **An inline style carries an input, not a value.** `style="--arc-meter-value: 84%"` is the element input;
   `style="padding: 14px"` is a value typed into markup.

The tool prints `file:line` for every finding and exits 1. It reads the system classes from `dist/arc.css` and
skips a vendored copy whole, so it judges what the project wrote and not what it took.

Measured on the pilot before it was cleaned: five raw values in one file — 44 px, 26 px, 1 px, 3 px, 18 px — all
inside a dead "holes" block that duplicated the switch and the section label the system had since shipped. The
block is gone and the pilot reads clean against 229 system classes.

`bash tools/gate.sh` runs the markup half on this repository own showcase; a project runs the whole tool on its
own tree. Same markup and same dictionary either pass or fail, and there is no third outcome.

---

## Appendix A — tokens at a 390 px frame

| Token | Value | Resolved |
|---|---|---|
| `--arc-u` | `clamp(0.875rem, 0.861rem + 0.571cqi, 1.375rem)` | 16.00 px |
| `--arc-fs` | `clamp(1rem, 0.94rem + 0.247cqi, 1.125rem)` | 16.00 px |
| `--arc-space-1` … `-12` | `calc(var(--arc-u) * 0.25 … 6)` | 4 … 96 px |
| `--arc-radius-chamfer` | `calc(var(--arc-u) * 0.75)` | 12.00 px |
| `--arc-line-hair` | `#44697C` | 3.27:1 on base — a frame, not an accent |
| `--arc-stroke-hair` | `1px` | — |
| `--arc-stroke-focus` | `2px` | — |
| `--arc-fs-readout` | `calc(var(--arc-fs) * 3.5)` | 56.00 px |
| `--arc-glow-text-1` | `0 0 3px currentColor` | top step |
| `--arc-glow-halo-blur` | `4px` | top step, shape |
| `--arc-opacity-ambient` | `0.55` dark · `0.28` light | the background grid |
| `--arc-control-height-m` | `clamp(44px, calc(var(--arc-u) * 2.75), 48px)` | 44.00 px |
| `--arc-control-height-l` | `clamp(52px, calc(var(--arc-u) * 3.25), 56px)` | 52.00 px |

## Appendix B — the measured pairs

`tools/contrast.py` prints every declared pair on every run: **30 in the dark scheme, 19 on paper, 49 in
total** — text on ground, ink on fill, and the boundary lines. Current state: **0 below the required
ratio.** The full table is the tool's output, not a copy in this document.

---

## Appendix C — the markup, one instance per element

`tools/markup.py` takes the first instance of every §8 root out of `index.html` and writes it here: a consumer
copies the page's own markup instead of inferring an anatomy from prose. The block is generated — change the
page and run the tool; the gate fails when the block and the page disagree. Attributes other than `class` are
stripped, because a state lives in the prose above and in the audit, and text reads `…`. Depth stops at four
levels, so a screen-shaped element stays readable.

<!-- markup:begin -->

#### 8.1 Button — `.arc-btn`

```html
<button class="arc-btn arc-btn--primary" type="button">…</button>
```

#### 8.2 Panel — `.arc-panel`

```html
<article class="arc-panel arc-panel--active">
  <div class="arc-panel__head">
    <h2 class="arc-h3">…</h2>
    <span class="arc-chip arc-chip--ok">
      …
      <i class="arc-chip__dot"></i>
    </span>
  </div>
  <div class="arc-kv">
    <span class="arc-kv__key">…</span>
    <span class="arc-kv__value">…</span>
  </div>
  <div class="arc-meter">
    <div class="arc-meter__track">
      <div class="arc-meter__fill"></div>
    </div>
  </div>
  <div class="arc-row">
    <span class="arc-kv__key">…</span>
    <span class="arc-chip arc-chip--attention">
      …
      <i class="arc-chip__dot"></i>
    </span>
  </div>
  <div class="arc-row">
    <span class="arc-kv__key">…</span>
    <span class="arc-chip arc-chip--critical">
      …
      <i class="arc-chip__dot"></i>
    </span>
  </div>
  <div class="arc-row">
    <span class="arc-kv__key">…</span>
    <button class="arc-switch" type="button" role="switch">
      <span class="arc-switch__track"></span>
    </button>
  </div>
  <div class="arc-row">
    <span class="arc-kv__key">…</span>
    <button class="arc-switch" type="button" role="switch">
      <span class="arc-switch__track"></span>
    </button>
  </div>
</article>
```

#### 8.3 Item — `.arc-item`

```html
<button class="arc-item" type="button">
  <span class="arc-item__text">
    <span class="arc-item__title">…</span>
    <span class="arc-item__meta">…</span>
  </span>
  <span class="arc-item__end">
    <span class="arc-item__chevron">
      <svg class="arc-icon">
        <use href="assets/icons.svg#chevron-right" />
      </svg>
    </span>
  </span>
</button>
```

#### 8.4 Empty — `.arc-empty`

```html
<div class="arc-empty">
  <p class="arc-h3">…</p>
  <p class="arc-empty__text">…</p>
</div>
```

#### 8.5 Field — `.arc-field`

```html
<label class="arc-field">
  <span class="arc-field__label">…</span>
  <input class="arc-input" type="text" />
  <span class="arc-field__hint">…</span>
</label>
```

#### 8.6 Chip — `.arc-chip`

```html
<span class="arc-chip">
  …
  <i class="arc-chip__dot"></i>
</span>
```

#### 8.7 Meter — `.arc-meter`

```html
<div class="arc-meter">
  <div class="arc-meter__track">
    <div class="arc-meter__fill"></div>
  </div>
</div>
```

#### 8.8 Bottom bar — `.arc-bar`

```html
<nav class="arc-bar">
  <button class="arc-bar__item" type="button">…</button>
  <button class="arc-bar__item" type="button">…</button>
  <button class="arc-bar__item" type="button">…</button>
  <button class="arc-bar__item" type="button">…</button>
</nav>
```

#### 8.9 App shell — `.arc-shell--app`

```html
<div class="arc-shell arc-shell--app">
  <header class="arc-appbar">
    <p class="arc-micro">…</p>
    <div class="arc-appbar__row">
      <p class="arc-h2">…</p>
      <span class="arc-chip arc-chip--error">
        …
        <i class="arc-chip__dot"></i>
      </span>
    </div>
  </header>
  <div class="arc-screen">
    <div class="arc-fault arc-fault--error">
      <p class="arc-fault__head">
        …
        <svg class="arc-icon arc-fault__mark">
          <use href="assets/icons.svg#triangle-alert" />
        </svg>
      </p>
      <p class="arc-h1">…</p>
      <p class="arc-fault__text">…</p>
      <pre class="arc-code arc-code--wrap">…</pre>
      <div class="arc-fault__actions">
        <button class="arc-btn arc-btn--primary" type="button">…</button>
        <button class="arc-btn arc-btn--secondary" type="button">…</button>
      </div>
    </div>
  </div>
</div>
```

#### 8.10 Dialog — `dialog.arc-dialog`

```html
<dialog class="arc-dialog">
  <div class="arc-dialog__head">
    <h2 class="arc-h2">…</h2>
    <span class="arc-chip arc-chip--error">
      …
      <i class="arc-chip__dot"></i>
    </span>
  </div>
  <p class="arc-body arc-muted">…</p>
  <div class="arc-dialog__actions">
    <button class="arc-btn arc-btn--ghost" type="button">…</button>
    <button class="arc-btn arc-btn--danger" type="button">…</button>
  </div>
</dialog>
```

#### 8.11 Table — `.arc-table`

```html
<div class="arc-table arc-table__scroll">
  <div class="arc-table__row arc-table__row--head">
    <span class="arc-table__cell arc-table__cell--head">…</span>
    <span class="arc-table__cell arc-table__cell--head arc-table__cell--num">…</span>
    <span class="arc-table__cell arc-table__cell--head arc-table__cell--num">…</span>
    <span class="arc-table__cell arc-table__cell--head arc-table__cell--num">…</span>
  </div>
  <div class="arc-table__row">
    <span class="arc-table__cell">…</span>
    <span class="arc-table__cell arc-table__cell--num">…</span>
    <span class="arc-table__cell arc-table__cell--num">…</span>
    <span class="arc-table__cell arc-table__cell--num">…</span>
  </div>
  <div class="arc-table__row">
    <span class="arc-table__cell">…</span>
    <span class="arc-table__cell arc-table__cell--num">…</span>
    <span class="arc-table__cell arc-table__cell--num">…</span>
    <span class="arc-table__cell arc-table__cell--num">…</span>
  </div>
</div>
```

#### 8.12 Tabs — `.arc-tabs`

```html
<div class="arc-tabs" role="tablist">
  <button class="arc-tabs__tab" type="button" role="tab">…</button>
  <button class="arc-tabs__tab" type="button" role="tab">…</button>
  <button class="arc-tabs__tab" type="button" role="tab">…</button>
</div>
```

#### 8.13 Skeleton — `.arc-skeleton`

```html
<span class="arc-skeleton"></span>
```

#### 8.14 Toast — `.arc-toast`

```html
<div class="arc-toast arc-toast--attention" role="status">
  <svg class="arc-icon arc-toast__mark">
    <use href="assets/icons.svg#triangle-alert" />
  </svg>
  …
</div>
```

#### 8.15 Switch — `.arc-switch`

```html
<button class="arc-switch" type="button" role="switch">
  <span class="arc-switch__track"></span>
</button>
```

#### 8.16 Code — `.arc-codeblock`

```html
<div class="arc-codeblock">
  <div class="arc-code__bar">
    <span class="arc-code__title">…</span>
    <div class="arc-code__acts">
      <button class="arc-code__act" type="button">
        <svg class="arc-icon">
          <use href="assets/icons.svg#copy" />
        </svg>
        <span class="arc-code__word">…</span>
      </button>
      <button class="arc-code__act arc-code__act--wrap" type="button">
        <svg class="arc-icon">
          <use href="assets/icons.svg#text-wrap" />
        </svg>
        <span class="arc-code__word">…</span>
      </button>
      <button class="arc-code__act" type="button">
        <svg class="arc-icon">
          <use href="assets/icons.svg#play" />
        </svg>
        <span class="arc-code__word">…</span>
      </button>
    </div>
  </div>
  <pre class="arc-code">…</pre>
</div>
```

#### 8.17 Section label — `.arc-section-label`

```html
<p class="arc-section-label">…</p>
```

#### 8.18 Readout — `.arc-readout`

```html
<div class="arc-readout">
  <span class="arc-readout__label">…</span>
  <span class="arc-readout__value">
    …
    <span class="arc-readout__unit">…</span>
  </span>
</div>
```

#### 8.19 Icon — `.arc-icon`

```html
<svg class="arc-icon">
  <use href="assets/icons.svg#copy" />
</svg>
```

#### 8.20 Bars — `.arc-bars`

```html
<div class="arc-bars">
  <span class="arc-bars__bar"></span>
  <span class="arc-bars__bar"></span>
  <span class="arc-bars__bar arc-bars__bar--over"></span>
  <span class="arc-bars__bar arc-bars__bar--now"></span>
  <span class="arc-bars__bar"></span>
</div>
```

#### 8.21 Alert — `.arc-alert`

```html
<div class="arc-alert arc-alert--error">
  <svg class="arc-icon arc-alert__icon">
    <use href="assets/icons.svg#triangle-alert" />
  </svg>
  …
</div>
```

#### 8.22 Fault — `.arc-fault`

```html
<div class="arc-fault arc-fault--error">
  <p class="arc-fault__head">
    …
    <svg class="arc-icon arc-fault__mark">
      <use href="assets/icons.svg#triangle-alert" />
    </svg>
  </p>
  <p class="arc-h1">…</p>
  <p class="arc-fault__text">…</p>
  <pre class="arc-code arc-code--wrap">…</pre>
  <div class="arc-fault__actions">
    <button class="arc-btn arc-btn--primary" type="button">…</button>
    <button class="arc-btn arc-btn--secondary" type="button">…</button>
  </div>
</div>
```

#### 8.23 Link — `.arc-link`

```html
<a class="arc-link" href="#reset">…</a>
```

#### 8.24 Steps — `.arc-steps`

```html
<div class="arc-steps">
  <p class="arc-steps__label">…</p>
  <div class="arc-steps__track">
    <span class="arc-steps__seg arc-steps__seg--done"></span>
    <span class="arc-steps__seg arc-steps__seg--now"></span>
    <span class="arc-steps__seg"></span>
  </div>
</div>
```

#### 8.25 Chart — `.arc-chart`

```html
<figure class="arc-chart">
  <figcaption class="arc-chart__head">
    <span class="arc-chart__label">…</span>
    <span class="arc-chart__peak">…</span>
  </figcaption>
  <div class="arc-chart__body">
    <div class="arc-chart__y">
      …
      …
      …
    </div>
    <svg class="arc-chart__plot" role="img">
      <g class="arc-chart__grid"></g>
      <path class="arc-chart__area" />
      <path class="arc-chart__line" />
      <path class="arc-chart__point" />
    </svg>
    <div class="arc-chart__x">
      …
      …
      …
    </div>
  </div>
</figure>
```

#### 8.26 Sheet — `dialog.arc-sheet`

```html
<dialog class="arc-sheet">
  <div class="arc-sheet__handle"></div>
  <header class="arc-sheet__head">
    <h2 class="arc-h3">…</h2>
    <button class="arc-sheet__close" type="button">
      <svg class="arc-icon">
        <use href="assets/icons.svg#x" />
      </svg>
    </button>
  </header>
  <div class="arc-sheet__body">
    <ul class="arc-listbox" role="listbox">
      <li class="arc-listbox__option arc-listbox__option--selected" role="option">
        …
        <svg class="arc-icon">
          <use href="assets/icons.svg#check" />
        </svg>
      </li>
      <li class="arc-listbox__option" role="option">…</li>
      <li class="arc-listbox__option" role="option">…</li>
      <li class="arc-listbox__option" role="option">…</li>
      <li class="arc-listbox__option" role="option">…</li>
      <li class="arc-listbox__option" role="option">…</li>
    </ul>
  </div>
</dialog>
```

#### 8.27 Select — `.arc-select`

```html
<button class="arc-select" type="button">
  <span class="arc-select__value">…</span>
  <svg class="arc-icon arc-select__mark">
    <use href="assets/icons.svg#chevron-down" />
  </svg>
</button>
```

#### 8.28 Listbox — `.arc-listbox`

```html
<ul class="arc-listbox arc-combobox__list" role="listbox">
  <li class="arc-listbox__option" role="option">…</li>
  <li class="arc-listbox__option" role="option">…</li>
  <li class="arc-listbox__option" role="option">…</li>
</ul>
```

#### 8.29 Icon button — `.arc-icon-btn`

```html
<button class="arc-icon-btn" type="button">
  <svg class="arc-icon">
    <use href="assets/icons.svg#ellipsis" />
  </svg>
</button>
```

#### 8.30 Check — `.arc-check`

```html
<label class="arc-check">
  <input class="arc-check__input" type="checkbox" />
  <span class="arc-check__mark">
    <svg class="arc-icon">
      <use href="assets/icons.svg#check" />
    </svg>
  </span>
  <span class="arc-check__text">
    …
    <span class="arc-check__meta">…</span>
  </span>
</label>
```

#### 8.31 Radio — `.arc-radio`

```html
<label class="arc-radio">
  <input class="arc-radio__input" type="radio" />
  <span class="arc-radio__mark"></span>
  <span class="arc-check__text">…</span>
</label>
```

#### 8.32 Menu — `.arc-menu`

```html
<ul class="arc-menu" role="menu">
  <li class="arc-menu__item" role="menuitem">
    …
    <svg class="arc-icon">
      <use href="assets/icons.svg#pencil" />
    </svg>
  </li>
  <li class="arc-menu__item" role="menuitem">
    …
    <svg class="arc-icon">
      <use href="assets/icons.svg#copy" />
    </svg>
  </li>
  <li class="arc-menu__item" role="menuitem">
    …
    <svg class="arc-icon">
      <use href="assets/icons.svg#external-link" />
    </svg>
  </li>
  <li class="arc-menu__item arc-menu__item--danger" role="menuitem">
    …
    <svg class="arc-icon">
      <use href="assets/icons.svg#trash" />
    </svg>
  </li>
</ul>
```

#### 8.33 Slider — `.arc-slider`

```html
<div class="arc-slider">
  <div class="arc-slider__row">
    <input class="arc-slider__input" type="range" />
    <span class="arc-slider__value">…</span>
  </div>
  <span class="arc-small arc-faint">…</span>
</div>
```

#### 8.34 Badge — `.arc-badge`

```html
<span class="arc-badge">…</span>
```

#### 8.35 Combobox — `.arc-combobox`

```html
<div class="arc-combobox">
  <div class="arc-field">
    <label class="arc-field__label">…</label>
    <input class="arc-input" type="text" role="combobox" />
  </div>
  <ul class="arc-listbox arc-combobox__list" role="listbox">
    <li class="arc-listbox__option" role="option">…</li>
    <li class="arc-listbox__option" role="option">…</li>
    <li class="arc-listbox__option" role="option">…</li>
  </ul>
</div>
```

#### 8.36 Form — `.arc-form`

```html
<form class="arc-form">
  <div class="arc-field">
    <label class="arc-field__label">…</label>
    <input class="arc-input" type="text" />
    <span class="arc-field__error" role="alert">
      …
      <svg class="arc-icon">
        <use href="assets/icons.svg#circle-alert" />
      </svg>
    </span>
  </div>
  <div class="arc-field">
    <label class="arc-field__label">…</label>
    <input class="arc-input" type="text" />
    <span class="arc-field__error" role="alert">
      …
      <svg class="arc-icon">
        <use href="assets/icons.svg#circle-alert" />
      </svg>
    </span>
  </div>
  <div class="arc-form__summary" role="alert">
    <p class="arc-form__summary-title">…</p>
    <ul class="arc-form__summary-list"></ul>
  </div>
  <div class="arc-form__actions">
    <button class="arc-btn arc-btn--primary" type="submit">…</button>
    <button class="arc-btn arc-btn--ghost" type="reset">…</button>
  </div>
</form>
```

#### 8.37 Group — `.arc-group`

```html
<fieldset class="arc-group">
  <legend class="arc-group__legend">…</legend>
  <p class="arc-group__hint">…</p>
  <label class="arc-radio">
    <input class="arc-radio__input" type="radio" />
    <span class="arc-radio__mark"></span>
    <span class="arc-check__text">
      …
      <span class="arc-check__meta">…</span>
    </span>
  </label>
  <label class="arc-radio">
    <input class="arc-radio__input" type="radio" />
    <span class="arc-radio__mark"></span>
    <span class="arc-check__text">
      …
      <span class="arc-check__meta">…</span>
    </span>
  </label>
</fieldset>
```

#### 8.38 Count — `.arc-count`

```html
<span class="arc-count">…</span>
```

#### 8.39 Result — `.arc-result`

```html
<div class="arc-result arc-result--ok">
  <p class="arc-result__class">…</p>
  <p class="arc-h1">…</p>
  <p class="arc-result__body">…</p>
  <div class="arc-result__record">
    <div class="arc-kv">
      <span class="arc-kv__key">…</span>
      <span class="arc-kv__value">…</span>
    </div>
    <div class="arc-kv">
      <span class="arc-kv__key">…</span>
      <span class="arc-kv__value">…</span>
    </div>
  </div>
  <div class="arc-result__actions">
    <a class="arc-link" href="#job">
      …
      <svg class="arc-icon arc-icon--s">
        <use href="assets/icons.svg#chevron-right" />
      </svg>
    </a>
  </div>
</div>
```

#### 8.40 Tasks — `.arc-tasks`

```html
<ol class="arc-tasks">
  <a class="arc-tasks__row" href="#pair">
    <span class="arc-tasks__text">
      <span class="arc-tasks__title">…</span>
      <span class="arc-tasks__meta">…</span>
    </span>
    <span class="arc-tasks__state arc-tasks__state--done">…</span>
  </a>
  <a class="arc-tasks__row" href="#relay">
    <span class="arc-tasks__text">
      <span class="arc-tasks__title">…</span>
      <span class="arc-tasks__meta">…</span>
    </span>
    <span class="arc-tasks__state arc-tasks__state--now">…</span>
  </a>
  <a class="arc-tasks__row" href="#job">
    <span class="arc-tasks__text">
      <span class="arc-tasks__title">…</span>
      <span class="arc-tasks__meta">…</span>
    </span>
    <span class="arc-tasks__state arc-tasks__state--todo">…</span>
  </a>
</ol>
```

#### 8.41 Note — `.arc-note`

```html
<div class="arc-note">
  …
</div>
```

#### 8.42 Warning — `.arc-warning`

```html
<p class="arc-warning">
  …
  <svg class="arc-icon">
    <use href="assets/icons.svg#triangle-alert" />
  </svg>
</p>
```

#### 8.43 Disclosure — `.arc-disclosure`

```html
<details class="arc-disclosure">
  <summary class="arc-disclosure__summary">
    …
    <span class="arc-disclosure__mark">
      <svg class="arc-icon">
        <use href="assets/icons.svg#chevron-down" />
      </svg>
    </span>
  </summary>
  <div class="arc-disclosure__body">
    …
  </div>
</details>
```

#### 8.44 Affix — `.arc-field__affix`

```html
<span class="arc-field__affix">…</span>
```

<!-- markup:end -->

