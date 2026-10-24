# CLAUDE.md - Kanam Sudoku iPhone

@import ./AGENTS.md

This file mirrors the project's `AGENTS.md`. Read `AGENTS.md` first: it holds the
hard constraints (zero runtime dependencies, one mask convention, one write path
to the board, relative paths, touch targets, no scroll at 390x844) and the
specification map.

Quick orientation:

- **Product scope is closed.** `.knowledge/BRIEF.md` says what is in and out.
  Hints, notes UI, undo/redo UI and stats are out of scope for v1 even though
  the state model supports them.
- **The rule that crosses every layer:** logic does not know the DOM exists, and
  the DOM calculates nothing. `src/core/` is pure, `src/state/` injects its
  storage and clock, `src/ui/` only renders.
- **Contracts live in `docs/architecture.md`** and the glossary in
  `docs/CONTEXT.md`. A term that needs to mean something else is a blocker.
- **Gates before commit:** `npm test` (node --test, no build), `npm run typecheck`
  (`tsc --noEmit`), `npm run build`, plus the e2e suites for the areas touched.
