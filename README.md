# Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

A mobile-first 9x9 Sudoku PWA for iPhone. Built from scratch in TypeScript with
zero runtime dependencies. Install it to the home screen, play offline.

**No accounts. No backend. No telemetry. No ads.** Puzzles are generated on the
device, every one with a unique solution.

## Features

- **Three difficulties, measured by solving technique** - not by blank-cell count.
  "Facil" is genuinely easy; "Dificil" genuinely needs X-Wings and chains.
- **Unique solution, verified** - the generator checks uniqueness after every
  removal and discards any candidate that leaves an ambiguous puzzle.
- **Touch-first board** - 44x44px minimum targets, row/column/block/same-number
  highlighting, conflicts flagged in red, no scrolling at 390x844.
- **On-screen numeric keypad** - big keys, plus a delete button.
- **Installable PWA** - own icon, opens without Safari's chrome, works offline.
- **Light and dark** - follows the system preference, AA contrast in both.
- **Resumable** - close the app mid-game and pick it up where you left off.

## Quick start

```bash
npm install
npm run dev        # dev server
npm test           # engine + state tests (node --test, no build step)
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## How it is built

| Layer | What it holds | Rule |
|---|---|---|
| `src/core/` | Pure sudoku engine: grid, geometry, mask, solver, techniques, analysis, rater, generator, validator | No DOM, no `window`, no `localStorage`, no unseeded randomness |
| `src/state/` | `GameState`, `apply(mutation)`, undo/redo, persistence, timer | Storage and clock are **injected** |
| `src/ui/` | DOM only: board, keypad, menu, victory, app state machine | It **calculates nothing** - it renders what it is given |

Two rules cross every layer:

1. **Logic does not know the DOM exists, and the DOM calculates nothing.**
2. **There is exactly one write path to the board** (`apply(mutation)`) and exactly
   one candidate-mask convention in the tree (`bit (d - 1)`).

The second rule exists because undo/redo, per-cell notes and save must be
addable later **without rewriting the core** - so the state model already carries
a mutation history and a notes map, even though the v1 UI exposes neither.

## Project layout

```
src/core/     engine (pure, tested with node --test)
src/state/    game state, mutations, history, persistence, timer
src/ui/       DOM rendering and interaction
src/sw/       service worker template
scripts/      icon generation, service worker emission, contrast check
test/         node --test suites + e2e scripts (real Chromium, 390x844)
.knowledge/   discovery, brief, status, knowledge, specs
docs/         architecture, glossary, data model, ADRs
```

## Documentation

- `docs/architecture.md` - module contracts, discarded alternatives, traceability.
- `docs/CONTEXT.md` - the authoritative glossary.
- `docs/data-model.md` - the data contracts.
- `docs/adr/` - durable decisions, append-only.
- `.knowledge/specs/` - one spec per capability, with binary acceptance criteria.
- `AGENTS.md` - the rules for anyone (or any agent) working on this repo.

## Testing

The engine and state run on `node --test` against TypeScript directly - Node 26
strips types natively, so there is no build step in the test loop. Note that type
stripping does **not** type-check, which is why `npm run typecheck` (`tsc
--noEmit`) is a separate gate in CI.

UI is verified in real Chromium at an iPhone viewport (390x844): layout, touch
targets, no-scroll, highlights, the keypad, victory, the PWA (manifest, service
worker, offline, subpath), accessibility (`axe-core`, zero violations) and colour
contrast in both themes.

## License

MIT
