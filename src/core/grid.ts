/**
 * Grid type and validation utilities.
 */

/**
 * A Sudoku grid is a flat array of 81 numbers (cells).
 * Each cell holds a digit 0‑9 where 0 means empty.
 * The spec defines a `Cell` type and a mutable `Grid` type.
 */
export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Grid = Cell[];

/** Validate that a grid has length 81 and only digits 0‑9. */
export const validateGrid = (grid: Grid): void => {
  if (grid.length !== 81) {
    throw new Error('Grid must have exactly 81 cells');
  }
  for (const v of grid) {
    if (v < 0 || v > 9 || !Number.isInteger(v)) {
      throw new Error('Grid values must be integers in range 0..9');
    }
  }
};

