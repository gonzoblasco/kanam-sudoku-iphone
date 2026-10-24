/**
 * Deterministic Sudoku puzzle generator.
 */
import { Grid } from './grid.js';
import { solve, countSolutions } from './solver.js';
import { ratePuzzle, Rating } from './rater.js';

/** Simple mulberry32 PRNG – deterministic, seeded. */
export const mulberry32 = (a: number): (() => number) => {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Generate a full solved board using backtracking with deterministic order. */
const generateFullSolution = (rng: () => number): Grid => {
  // Simple backtracking filling cells in random order.
  const grid: number[] = new Array(81).fill(0);
  const order = [...Array(81).keys()];
  // Shuffle order deterministically.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const solveRec = (idx: number): boolean => {
    if (idx === order.length) return true;
    const pos = order[idx];
    if (grid[pos] !== 0) return solveRec(idx + 1);
    const digits = [...Array(9).keys()].map(d => d + 1);
    // Shuffle digits deterministically.
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    for (const d of digits) {
      grid[pos] = d;
      const result = solve(grid as unknown as Grid);
      if (result.status === 'solved') {
        if (solveRec(idx + 1)) return true;
      }
      grid[pos] = 0;
    }
    return false;
  };
  // Start with empty grid and fill.
  solveRec(0);
  return grid as unknown as Grid;
};

/** Result of a generation attempt. */
export interface GenerateResult {
  puzzle: Grid;
  rating: Rating;
  matched: boolean;
}

/** Main generation function. */
export const generatePuzzle = (
  difficulty: 'facil' | 'medio' | 'dificil',
  opts: { seed?: number; maxAttempts?: number } = {}
): GenerateResult => {
  const maxAttempts = opts.maxAttempts ?? 1000;
  const rng = mulberry32(opts.seed ?? Date.now());
  // 1. Generate a full solution.
  const solution = generateFullSolution(rng);
  // 2. Start removing cells.
  const puzzle = solution.slice();
  const removalOrder = [...Array(81).keys()];
  for (let i = removalOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [removalOrder[i], removalOrder[j]] = [removalOrder[j], removalOrder[i]];
  }
  let attempts = 0;
  for (const idx of removalOrder) {
    if (attempts >= maxAttempts) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    // Ensure uniqueness.
    const sols = countSolutions(puzzle as unknown as Grid, 2);
    if (sols !== 1) {
      // revert removal
      puzzle[idx] = backup;
    }
    attempts++;
    // Rate current puzzle.
    const rating = ratePuzzle(puzzle as unknown as Grid);
    const targetDiff = difficulty;
    if (rating.difficulty === targetDiff) {
      return { puzzle: puzzle as unknown as Grid, rating, matched: true };
    }
  }
  // After loop, compute final rating.
  const finalRating = ratePuzzle(puzzle as unknown as Grid);
  const matched = finalRating.difficulty === difficulty;
  return { puzzle: puzzle as unknown as Grid, rating: finalRating, matched };
};

