/**
 * Grid type and validation utilities.
 */

/** A Sudoku grid is a flat array of 81 numbers. 0 represents an empty cell. */
export type Grid = ReadonlyArray<number>;

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

