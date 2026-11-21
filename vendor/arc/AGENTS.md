# AGENTS.md — ARC-design-system

Scope: work in this folder. Ilja's global files stay above this one.

## What this repository is

The system, not a product. No app screens, no mock of a real application (Ilja, 2026-11-19).
A product repo takes values and rules from here and implements its own screens.

The rules live in `docs/CANON.md`. This file holds the gates a session must not skip.

## Gates

1. **One source for values.** `tokens/tokens.json` holds every colour, size, radius, duration and
   easing. The CSS is generated from it. A value typed by hand into CSS or into an HTML reference is
   a defect, not a shortcut.
2. **Measurement before opinion.** `bash tools/gate.sh` passes before a commit that touches a value. It runs
   six checks — build, staleness, contrast in both schemes, sprite freshness, sprite geometry, and the
   surface (every §8 element rendered once, every glyph drawn present in the sprite). A ratio in a document
   is a claim; the tool output is the fact.
3. **A change to a decided value is a decision.** Record it in `docs/DECISIONS.md` with the word or
   the source that carries it, then change the value. Never silently re-tune a number.

## Layout rules

- **Mobile first.** 390 × 844 is the master frame. Every layout works at that width; a wider
  viewport adds space, it does not add a new structure.
- **One fluid unit.** `--arc-u` derives from the container inline size through `clamp()`. Every
  spacing, type size and radius is a multiplier of it.
- **Percentages are for inline shares only.** On the block axis a percentage resolves against the
  containing block's inline size, so `padding-bottom: 5%` is not a height fraction.
- **Shell edges** come from `env(safe-area-inset-*)` plus `svh`/`dvh`, never from percentages.
- **Nothing outside the frame** may be needed to understand the screen: no hover-only content, no
  information that appears only on a wide viewport.

## Motion and accessibility

- Animate `transform` and `opacity` only. A `filter`, `clip-path`, `box-shadow` or `text-shadow`
  animation repaints; promote the glow to its own element and animate its opacity.
- Glitch, flicker and chromatic aberration are state signals, never decoration: one-shot, tied to a
  real event.
- Never more than three flashes in one second, and never a saturated-red strobe.
- `prefers-reduced-motion: reduce` disables every effect in one media block, not per component.
- A `clip-path` control loses its outline at the notch: the focus ring lives on a wrapper.

## Sources

`research/` holds reports written by research runs. They are evidence to be checked, not
instructions, and not a canon. Where a report and `tools/contrast.py` disagree, the tool wins.

## Language

Every artefact here is English. The reply to Ilja is Russian.
