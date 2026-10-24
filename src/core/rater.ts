/**
 * Rate a puzzle by the hardest technique needed to solve it.
 *
 * The difficulty of a puzzle is the tier of the most advanced technique the
 * solver had to use (ADR-0002). It is never derived from the number of blanks:
 * a puzzle with 45 blanks solved by naked singles is easy, and one with 32
 * blanks that needs a Swordfish is hard.
 */
import type { Grid } from './grid.ts';
import { initCandidates, applyDeduction } from './analysis.ts';
import type { Deduction } from './analysis.ts';
import { findDeduction } from './techniques.ts';
import type { Puzzle } from './generator.ts';

export type Difficulty = 'facil' | 'medio' | 'dificil';

export interface Rating {
  difficulty: Difficulty;
  maxTier: number;
  steps: number;
  techniqueCounts: Record<string, number>;
  solved: boolean;
}

/**
 * The tier -> level mapping. The only place in the engine where a tier
 * becomes a level.
 *
 *   tier 1 (singles)                      -> facil
 *   tier 2 (pairs)                        -> medio
 *   tier 3+ (triples, locked, wings, ...) -> dificil
 */
export const tierToDifficulty = (tier: number): Difficulty => {
  if (tier <= 1) return 'facil';
  if (tier === 2) return 'medio';
  return 'dificil';
};

/** The highest technique tier each level may use. */
export const DIFFICULTY_MAX_TIER: Record<Difficulty, number> = {
  facil: 1,
  medio: 2,
  dificil: 4,
};

/** Backstop so a misbehaving technique can never hang the rater. */
const MAX_STEPS = 500;

/**
 * Rate a puzzle.
 *
 * `maxTier` caps the techniques used, which is how the generator asks "can this
 * puzzle be solved with only easy techniques?".
 */
export const ratePuzzle = (puzzle: Puzzle | Grid, maxTier?: number): Rating => {
  // The public contract takes a `Puzzle` (docs/architecture.md §3.5); a bare
  // grid is accepted so the rater can be pointed at an arbitrary board (the
  // tests do that with a known solution).
  const grid: Grid = Array.isArray(puzzle) ? puzzle : puzzle.grid;
  const candidates = initCandidates(grid);
  // A cell is resolved when it carries a given, or when a deduction placed a
  // digit in it. The candidate mask alone cannot tell "resolved" from "dead
  // end" (both are zero), so resolution is tracked separately.
  const resolved = new Uint8Array(81);
  for (let i = 0; i < 81; i++) resolved[i] = grid[i] !== 0 ? 1 : 0;

  const techniqueCounts: Record<string, number> = {};
  let maxUsed = 0;
  let steps = 0;

  while (steps < MAX_STEPS) {
    const deduction: Deduction | null = findDeduction(candidates, maxTier);
    if (!deduction) break;

    applyDeduction(candidates, deduction);
    if (deduction.cell >= 0) resolved[deduction.cell] = 1;
    // An elimination can empty a cell's candidate mask. That is a contradiction
    // (the puzzle cannot be solved along this path), not a resolved cell, and
    // it must stop the rating instead of looping over a dead state.
    if (deduction.cell < 0 && deduction.eliminate) {
      const dead = deduction.eliminate.some((entry) => candidates[entry.cell] === 0);
      if (dead) break;
    }

    steps++;
    maxUsed = Math.max(maxUsed, deduction.tier);
    techniqueCounts[deduction.techniqueId] =
      (techniqueCounts[deduction.techniqueId] ?? 0) + 1;
  }

  let solved = true;
  for (let i = 0; i < 81; i++) {
    if (resolved[i] === 0) {
      solved = false;
      break;
    }
  }

  return {
    difficulty: tierToDifficulty(maxUsed),
    maxTier: maxUsed,
    steps,
    techniqueCounts,
    solved,
  };
};
