# AGENTS.md - Kanam Sudoku iPhone

Mobile-first 9x9 Sudoku PWA for iPhone. Built from scratch in TypeScript, zero
runtime dependencies.

## What this is

A single-screen sudoku game: generate a puzzle (unique solution, three
difficulties), play it with a touch keypad, win. Installable to the iPhone home
screen, works offline. No accounts, no backend, no telemetry, no ads.

**The product scope is closed.** See `.knowledge/BRIEF.md` for what is in and out.
Hints, per-cell notes, undo/redo UI, and stats are **out of scope for v1** - the
state model already supports them, but the UI does not expose them. Do not add
features that were not requested.

## The one rule that crosses every layer

**Logic does not know the DOM exists; the DOM calculates nothing.**

- `src/core/` - pure sudoku logic. No DOM, no `window`, no `localStorage`, no
  `Date.now` unless injected, no unseeded randomness. Tested with `node --test`.
- `src/state/` - game state, mutations, history, persistence, timer. Storage and
  clock are **injected**. No DOM.
- `src/ui/` - DOM only. Renders what it is given. It does not compute conflicts,
  highlights, difficulty, or victory.

If a calculation ends up in `ui/`, it belongs in `core/` or `state/`.

## Hard constraints

| Constraint | Why |
|---|---|
| **Zero runtime dependencies** | The app travels over a mobile network. `vite` is the only devDependency. |
| **One candidate-mask convention in the whole tree**: `bit (d - 1)` | A previous engine in this workspace carried two conventions side by side (`1 << (d-1)` and `1 << d`), documented as "both valid". That is a bug factory. `src/core/mask.ts` is the only place a mask is built. |
| **One write path to the board**: `apply(mutation)` | Undo/redo, notes and save must be addable without rewriting the core. |
| **No `Math.random` in the engine** | The same seed must produce the same puzzle. Use a seeded PRNG. |
| **Relative paths everywhere** (`base: "./"`) | The app is served from a GitHub Pages **subpath**. Absolute asset paths break it. |
| **No state depends on color alone** | Every visual state needs its own channel: `data-given`, `data-selected`, `data-conflict`, `data-highlight`, plus weight/outline/shape. |
| **Touch targets >= 44x44px** | It is an iPhone game played with a thumb. |
| **No vertical scroll at 390x844** | The board and the keypad must fit on one screen. Use `100dvh` and `env(safe-area-inset-*)`. |
| **Tests run with `node --test`, no build step** | Node 26 strips types natively. A build step in the test loop makes it slow and hides type errors. |

## Commands

```bash
npm install
npm test            # node --test test/  (engine + state, no DOM)
npm run build       # vite build
npm run typecheck   # tsc --noEmit  (type stripping does NOT check types)
```

E2E (real Chromium, viewport 390x844):

```bash
npm run build
node test/e2e.board.mjs     # board layout, touch targets, highlights
node test/e2e.keypad.mjs    # keypad, victory
node test/e2e.pwa.mjs        # manifest, service worker, offline, subpath
node test/e2e.a11y.mjs      # axe-core, 0 violations
```

Playwright-core and Chromium are already installed on the machine; do not add
them as project dependencies.

## Layout

```
src/core/     engine: grid, geometry, mask, solver, techniques, analysis, rater, generator, validator
src/state/    GameState, apply/undo/redo, persistence, timer
src/ui/       render, keypad, menu, victory, app state machine, pwa registration
src/sw/       service worker template
scripts/      generate-icons.mjs, gen-sw.mjs, check-contrast.mjs
test/         node --test suites + e2e scripts
.knowledge/   discovery, brief, status, knowledge, specs
docs/         architecture, CONTEXT (glossary), data-model, adr/
```

## Where things are specified

- `.knowledge/specs/SPEC-001..006` - one spec per core capability, with binary
  acceptance criteria.
- `docs/architecture.md` - module contracts, discarded alternatives, and the
  traceability table mapping every spec to where it lives.
- `docs/CONTEXT.md` - the authoritative glossary. A term that needs to mean
  something else is a **blocker**, not a silent redefinition.
- `docs/data-model.md` - the data contracts, including what is persisted and
  what is deliberately not.
- `docs/adr/` - durable decisions. Append-only: a changed decision is a new ADR
  that supersedes the old one.

## Before you commit

- `npm test` passes, and you paste the raw output in the commit description.
- `npm run typecheck` passes.
- `npm run build` passes.
- The e2e suites pass for the areas you touched.
- If you changed a durable decision, there is an ADR for it.

## Style

- No comments that restate the code. A comment explains **why**, or a **contract**
  that is not visible in the code.
- Spanish in user-facing strings, English in code identifiers and comments.
- Prefer a small pure function over a class. The engine has no classes.
