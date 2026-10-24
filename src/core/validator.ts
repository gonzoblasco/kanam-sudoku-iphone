/**
 * Validation utilities for Sudoku grids.
 */
import { Grid } from './grid.js';
import { UNITS_OF_CELL, CELLS_OF_UNIT } from './geometry.js';

/** Find cells that are in conflict (duplicate digit in a unit). */
export const conflictCells = (grid: Grid): Set<number> => {
  const conflicts = new Set<number>();
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const seen = new Map<number, number[]>(); // digit -> list of cells
    for (const cell of cells) {
      const v = grid[cell];
      if (v !== 0) {
        const arr = seen.get(v) ?? [];
        arr.push(cell);
        seen.set(v, arr);
      }
    }
    for (const [digit, list] of seen.entries()) {
      if (list.length > 1) {
        // All cells participating in the conflict are added.
        for (const c of list) conflicts.add(c);
      }
    }
  }
  return conflicts;
};

/** Find conflicting units (unit indices) for the grid. */
export const conflictedUnits = (grid: Grid): Set<number> => {
  const units = new Set<number>();
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const seen = new Map<number, number>();
    for (const cell of cells) {
      const v = grid[cell];
      if (v !== 0) {
        if (seen.has(v)) {
          units.add(u);
        } else {
          seen.set(v, cell);
        }
      }
    }
  }
  return units;
};

/** Determine whether the grid is complete (no zeros). */
export const isComplete = (grid: Grid): boolean => grid.every(v => v !== 0);

/** Determine whether the grid is solved (complete and no conflicts). */
export const isSolved = (grid: Grid): boolean => isComplete(grid) && conflictCells(grid).size === 0;

/** Find conflicts (digit -> array of cell indices). */
export const findConflicts = (grid: Grid): Record<number, number[]> => {
  const result: Record<number, number[]> = {};
  const seen = new Map<string, number[]>();
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const map = new Map<number, number[]>();
    for (const cell of cells) {
      const v = grid[cell];
      if (v !== 0) {
        const arr = map.get(v) ?? [];
        arr.push(cell);
        map.set(v, arr);
      }
    }
    for (const [digit, list] of map.entries()) {
      if (list.length > 1) {
        result[digit] = list;
      }
    }
  }
  return result;
};

