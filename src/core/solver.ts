/**
 * Sudoku solver: solve a grid, and count its solutions.
 *
 * The solver owns its own candidate bookkeeping instead of sharing the
 * analysis module's conventions. The reason is a real conflict of meanings:
 * the analysis layer uses a zero mask to mean "this cell is resolved", while a
 * backtracking solver reads a zero mask as "this cell has no candidates" (a
 * dead end). Sharing one mask for both meanings makes a solvable grid look
 * unsolvable the moment a single cell is emptied.
 *
 * Here the grid is the single source of truth for what is filled, and the
 * candidate mask only ever holds *possible* digits for an *empty* cell.
 */
import type { Grid } from './grid.ts';
import { validateGrid } from './grid.ts';
import { bitFor } from './mask.ts';
import { rowOf, colOf, blockOf } from './geometry.ts';

export interface SolveResult {
  status: 'solved' | 'invalid' | 'unsolvable';
  solution: Grid | null;
}

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

/** The 20 cells that share a unit with the given cell. */
const peersOf = (index: number): number[] => {
  const peers: number[] = [];
  const r = rowOf(index);
  const c = colOf(index);
  const b = blockOf(index);
  for (let i = 0; i < 81; i++) {
    if (i === index) continue;
    if (rowOf(i) === r || colOf(i) === c || blockOf(i) === b) peers.push(i);
  }
  return peers;
};

const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => peersOf(i));

/** Build the candidate mask of every cell from the digits already placed. */
const initialCandidates = (grid: Grid): Uint16Array => {
  const candidates = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    const value = grid[i];
    candidates[i] = value === 0 ? FULL_MASK : 0;
  }
  for (let i = 0; i < 81; i++) {
    const value = grid[i];
    if (value === 0) continue;
    const bit = bitFor(value);
    for (const peer of PEERS[i]) {
      candidates[peer] &= ~bit;
    }
  }
  return candidates;
};

/** Does the grid already break a rule? */
const hasImmediateConflict = (grid: Grid): boolean => {
  for (let i = 0; i < 81; i++) {
    const value = grid[i];
    if (value === 0) continue;
    for (const peer of PEERS[i]) {
      if (grid[peer] === value) return true;
    }
  }
  return false;
};

/**
 * Backtracking with the MRV heuristic: the empty cell with the fewest
 * candidates is filled first.
 */
/**
 * Backtracking with the MRV heuristic.
 *
 * `onSolution` returns `true` when the search must stop (the caller got what
 * it needed). Returning `false` keeps searching, which is what counting needs.
 */
const backtrack = (
  grid: number[],
  candidates: Uint16Array,
  onSolution: () => boolean,
): boolean => {
  let bestIndex = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const count = popcount(candidates[i]);
    if (count === 0) return false; // dead end
    if (count < bestCount) {
      bestCount = count;
      bestIndex = i;
      if (count === 1) break;
    }
  }
  if (bestIndex === -1) {
    return onSolution();
  }

  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if ((candidates[bestIndex] & bitFor(d)) !== 0) digits.push(d);
  }

  for (const d of digits) {
    const bit = bitFor(d);
    grid[bestIndex] = d;
    // Remove the digit from the peers, remembering what to restore.
    const touched: number[] = [];
    for (const peer of PEERS[bestIndex]) {
      if ((candidates[peer] & bit) !== 0) {
        candidates[peer] &= ~bit;
        touched.push(peer);
      }
    }
    if (backtrack(grid, candidates, onSolution)) {
      return true;
    }
    for (const peer of touched) candidates[peer] |= bit;
    grid[bestIndex] = 0;
  }
  return false;
};

/**
 * Solve a grid.
 *
 * Returns `invalid` when the grid already breaks a rule, and `unsolvable` when
 * no assignment completes it.
 */
export const solve = (grid: Grid): SolveResult => {
  try {
    validateGrid(grid);
  } catch {
    return { status: 'invalid', solution: null };
  }
  if (hasImmediateConflict(grid)) {
    return { status: 'invalid', solution: null };
  }

  const working = Array.from(grid) as number[];
  const candidates = initialCandidates(grid);
  let solution: number[] | null = null;

  backtrack(working, candidates, () => {
    solution = working.slice();
    return true; // the first solution is enough
  });

  if (!solution) return { status: 'unsolvable', solution: null };
  return { status: 'solved', solution: solution as unknown as Grid };
};

/**
 * Count the solutions of a grid, stopping at `cap`.
 *
 * The cap matters: counting every solution of an ambiguous grid is
 * exponential, and the generator only needs to know "is there more than one?".
 */
export const countSolutions = (grid: Grid, cap: number): number => {
  try {
    validateGrid(grid);
  } catch {
    return 0;
  }
  if (cap <= 0) return 0;
  if (hasImmediateConflict(grid)) return 0;

  const working = Array.from(grid) as number[];
  const candidates = initialCandidates(grid);
  let count = 0;

  backtrack(working, candidates, () => {
    count++;
    return count >= cap; // stop as soon as the cap is reached
  });

  return count;
};
