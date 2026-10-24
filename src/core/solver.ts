/**
 * Sudoku solver with backtracking and MRV heuristic.
 */
import { Grid, validateGrid } from './grid.js';
import { initCandidates, applyDeduction, Deduction } from './analysis.js';
import { findDeduction } from './techniques.js';
import { PEERS } from './geometry.js';

/** Result of a solve attempt. */
export interface SolveResult {
  status: 'solved' | 'invalid' | 'unsolvable';
  solution: Grid | null;
}

/** Clone a grid (shallow copy is fine because numbers are primitives). */
const cloneGrid = (g: Grid): Grid => g.slice();

/** Internal recursive solver that works on candidates and grid. */
function solveRecursive(grid: number[], candidates: Uint16Array): boolean {
  // Find unfilled cell with fewest candidates >1 (MRV).
  let bestIdx = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0) {
      const mask = candidates[i];
      const count = popcount(mask);
      if (count === 0) return false; // dead end
      if (count < bestCount) {
        bestCount = count;
        bestIdx = i;
        if (count === 1) break;
      }
    }
  }
  if (bestIdx === -1) {
    // No empty cells – solved.
    return true;
  }
  const mask = candidates[bestIdx];
  const digits = [] as number[];
  for (let d = 1; d <= 9; d++) {
    if ((mask & (1 << (d - 1))) !== 0) digits.push(d);
  }
  // Try each digit.
  for (const d of digits) {
    // Clone grid and candidates for branch.
    const gridCopy = grid.slice();
    const candCopy = new Uint16Array(candidates);
    // Assign digit.
    gridCopy[bestIdx] = d;
    candCopy[bestIdx] = 1 << (d - 1);
    // Propagate constraints.
    const maskBit = 1 << (d - 1);
    for (const peer of PEERS[bestIdx]) {
      candCopy[peer] &= ~maskBit;
    }
    if (solveRecursive(gridCopy, candCopy)) {
      // Copy solution back.
      for (let i = 0; i < 81; i++) grid[i] = gridCopy[i];
      return true;
    }
  }
  return false;
}

/** Utility: count set bits in a 9‑bit mask. */
const popcount = (x: number): number => {
  let c = 0;
  let v = x;
  while (v) {
    c += v & 1;
    v >>>= 1;
  }
  return c;
};

/** Public solve function. */
export const solve = (grid: Grid): SolveResult => {
  try {
    validateGrid(grid);
  } catch (e) {
    return { status: 'invalid', solution: null };
  }
  const candidates = initCandidates(grid);
  // Apply deterministic deductions before branching.
  let changed = true;
  while (changed) {
    const ded = findDeduction(candidates);
    if (ded) {
      applyDeduction(candidates, ded);
    }
    changed = !!ded;
  }
  // Build mutable copy of grid.
  const mutable = grid.slice();
  const solved = solveRecursive(mutable, candidates);
  if (!solved) {
    return { status: 'unsolvable', solution: null };
  }
  // Convert to immutable Grid.
  return { status: 'solved', solution: mutable };
};

/** Count the number of solutions up to a cap. */
export const countSolutions = (grid: Grid, cap: number): number => {
  try {
    validateGrid(grid);
  } catch {
    return 0;
  }
  const candidates = initCandidates(grid);
  // Apply deterministic deductions as above.
  let ded: Deduction | null;
  while ((ded = findDeduction(candidates))) {
    applyDeduction(candidates, ded);
  }
  let count = 0;
  const recurse = (g: number[], cands: Uint16Array): boolean => {
    // MRV selection
    let bestIdx = -1;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0) {
        const cnt = popcount(cands[i]);
        if (cnt === 0) return false;
        if (cnt < bestCount) {
          bestCount = cnt;
          bestIdx = i;
        }
      }
    }
    if (bestIdx === -1) {
      count++;
      return count >= cap; // stop early if reached cap
    }
    const mask = cands[bestIdx];
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (mask & (1 << (d - 1))) digits.push(d);
    for (const d of digits) {
      const gCopy = g.slice();
      const cCopy = new Uint16Array(cands);
      gCopy[bestIdx] = d;
      const bit = 1 << (d - 1);
      cCopy[bestIdx] = bit;
      for (const peer of PEERS[bestIdx]) {
        cCopy[peer] &= ~bit;
      }
      if (recurse(gCopy, cCopy)) return true;
    }
    return false;
  };
  recurse(mutable.slice(), candidates);
  return count;
};

