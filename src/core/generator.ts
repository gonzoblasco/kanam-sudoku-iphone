/**
 * Deterministic Sudoku puzzle generator.
 *
 * The algorithm follows SPEC-001:
 *
 *   1. Build a full solution with the seeded PRNG.
 *   2. Shuffle the order in which cells are emptied.
 *   3. Empty each cell in that order and keep the removal only if the puzzle
 *      still has a UNIQUE solution (`countSolutions(puzzle, 2) === 1`).
 *   4. Rate the puzzle once, with the technique catalogue.
 *   5. If the measured level is the requested one, return it.
 *   6. Otherwise try another candidate board, up to `maxAttempts` times, all
 *      drawn from the same seeded stream (reproducible, decorrelated).
 *   7. If the attempts run out, return the last candidate with its REAL rating
 *      and `matched: false`. The generator never mislabels a level.
 */
import type { Grid } from './grid.ts';
import { countSolutions } from './solver.ts';
import { ratePuzzle, DIFFICULTY_MAX_TIER } from './rater.ts';
import type { Difficulty, Rating } from './rater.ts';
import { bitFor } from './mask.ts';
import { PEERS } from './geometry.ts';

/** splitmix32 finalizer: decorrelates a seed from its neighbours. */
export const mix32 = (value: number): number => {
  let z = value >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
};

/** mulberry32 PRNG: small, fast, and fully determined by its seed. */
export const mulberry32 = (a: number): (() => number) => {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FULL_MASK = 0x1ff; // nine bits set

/** Count the set bits of a mask. */
const popcount = (x: number): number => {
  let count = 0;
  let v = x;
  while (v) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
};

/**
 * Build a full solution with a direct MRV backtracking.
 *
 * It does NOT call the solver per attempt: a nested backtracking is
 * exponential inside an exponential, which is what made the generator hang.
 */
const generateFullSolution = (rng: () => number): Grid => {
  const grid: number[] = new Array(81).fill(0);
  const candidates = new Uint16Array(81);
  for (let i = 0; i < 81; i++) candidates[i] = FULL_MASK;

  const solveRec = (): boolean => {
    let bestIdx = -1;
    let bestCount = 10;
    let ties = 0;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const count = popcount(candidates[i]);
      if (count < bestCount) {
        bestCount = count;
        bestIdx = i;
        ties = 1;
        if (count === 0) return false;
        if (count === 1) break;
      } else if (count === bestCount) {
        ties++;
      }
    }
    if (bestIdx === -1) return true;

    // Break ties with the PRNG so the solution varies with the seed.
    let target = bestIdx;
    if (ties > 1) {
      const pick = Math.floor(rng() * ties);
      let seen = 0;
      for (let i = 0; i < 81; i++) {
        if (grid[i] !== 0) continue;
        if (popcount(candidates[i]) !== bestCount) continue;
        if (seen === pick) {
          target = i;
          break;
        }
        seen++;
      }
    }

    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if ((candidates[target] & bitFor(d)) !== 0) digits.push(d);
    // Shuffle the digit order with the PRNG.
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }

    for (const d of digits) {
      grid[target] = d;
      const bit = bitFor(d);
      // Remove the digit from the peers of the cell (same row, column or block).
      const peers = PEERS[target];
      const touched: number[] = [];
      for (const peer of peers) {
        if ((candidates[peer] & bit) !== 0) {
          candidates[peer] &= ~bit;
          touched.push(peer);
        }
      }
      if (solveRec()) return true;
      // Undo the removal.
      for (const peer of touched) candidates[peer] |= bit;
      grid[target] = 0;
    }
    return false;
  };

  solveRec();
  return grid as unknown as Grid;
};

export interface GenerateResult {
  puzzle: Puzzle;
  rating: Rating;
  matched: boolean;
}

/**
 * A puzzle is the grid of clues PLUS the solution the generator verified.
 *
 * The solution is part of the contract (docs/data-model.md §1.2): without it a
 * caller cannot check that a completed board is the right one, and the
 * uniqueness guarantee would be an unverifiable claim.
 */
export interface Puzzle {
  grid: Grid;
  solution: Grid;
  seed: number;
}

export interface GenerateOptions {
  seed?: number;
  maxAttempts?: number;
}

/**
 * Generate a puzzle of the requested difficulty.
 *
 * The seed is required: a generator that picks its own randomness cannot be
 * reproducible, and reproducibility is what makes a puzzle verifiable.
 */
export const generatePuzzle = (
  difficulty: Difficulty,
  opts: GenerateOptions = {},
): GenerateResult => {
  const maxAttempts = opts.maxAttempts ?? 60;
  if (
    difficulty !== 'facil' &&
    difficulty !== 'medio' &&
    difficulty !== 'dificil'
  ) {
    // Not a default level: an unknown level is a caller error, and silently
    // treating it as "facil" would produce a puzzle labelled with a lie.
    throw new Error(`unknown difficulty: ${String(difficulty)}`);
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error('maxAttempts must be a positive integer');
  }
  if (opts.seed === undefined) {
    throw new Error('seed is required for deterministic puzzle generation');
  }

  const baseSeed = opts.seed >>> 0;
  const maxTier = DIFFICULTY_MAX_TIER[difficulty];

  let lastPuzzle: Puzzle | null = null;
  let lastRating: Rating | null = null;

  // ONE stream for the whole run. Re-seeding every attempt as
  // `base + attempt * stride` feeds mulberry32 an arithmetic sequence, which is
  // exactly the generator's own state update: consecutive attempts then walk
  // correlated streams, and one unlucky base seed stays unlucky for hundreds of
  // attempts. Drawing every attempt from a single seeded stream decorrelates
  // them and keeps the run reproducible.
  const rng = mulberry32(mix32(baseSeed));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateFullSolution(rng);
    const puzzle: Grid = solution.slice() as unknown as Grid;

    // Empty cells in a seeded random order, keeping only removals that
    // preserve a unique solution.
    const order = [...Array(81).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const idx of order) {
      const backup = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[idx] = backup;
      }
    }

    // Rate once, with the tier cap of the requested level. A puzzle that
    // needs a harder technique than the level allows is not that level.
    const rating = ratePuzzle(puzzle, maxTier);

    lastPuzzle = { grid: puzzle, solution: solution.slice() as unknown as Grid, seed: baseSeed };
    lastRating = rating;

    if (rating.solved && rating.difficulty === difficulty) {
      return { puzzle: lastPuzzle, rating, matched: true };
    }
  }

  if (lastPuzzle && lastRating) {
    // The rating above was measured with the CAP of the requested level, which
    // answers "is this puzzle that level?" but not "what level is it?". A
    // `matched: false` result has to report the level really measured
    // (spec-001 RF-5, spec-006 RF-14): re-rate without the cap.
    const measured = ratePuzzle(lastPuzzle, 9);
    return { puzzle: lastPuzzle, rating: measured, matched: false };
  }
  throw new Error('puzzle generation produced no candidate');
};
