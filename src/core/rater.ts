/**
 * Rate a Sudoku puzzle based on the highest tier of technique required to solve it.
 */
import { Grid } from './grid.js';
import { initCandidates, applyDeduction, Deduction } from './analysis.js';
import { findDeduction } from './techniques.js';

export interface Rating {
  difficulty: 'facil' | 'medio' | 'dificil';
  maxTier: number;
  steps: number;
  techniqueCounts: Record<string, number>;
  solved: boolean;
}

/** Map maxTier to difficulty label. */
const tierToDifficulty = (tier: number): Rating['difficulty'] => {
  if (tier <= 1) return 'facil';
  if (tier <= 2) return 'medio';
  return 'dificil';
};

/** Rate the puzzle. */
export const ratePuzzle = (puzzle: Grid): Rating => {
  const candidates = initCandidates(puzzle);
  const techniqueCounts: Record<string, number> = {};
  let maxTier = 0;
  let steps = 0;
  let ded: Deduction | null;
  while ((ded = findDeduction(candidates))) {
    // Apply deduction.
    applyDeduction(candidates, ded);
    steps++;
    maxTier = Math.max(maxTier, ded.tier);
    techniqueCounts[ded.techniqueId] = (techniqueCounts[ded.techniqueId] ?? 0) + 1;
  }
  // After deductions, check if solved.
  const solved = candidates.every(mask => mask !== 0 && (mask & (mask - 1)) === 0);
  return {
    difficulty: tierToDifficulty(maxTier),
    maxTier,
    steps,
    techniqueCounts,
    solved,
  };
};

