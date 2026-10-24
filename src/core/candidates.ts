/**
 * The digits that are still legal in a cell.
 *
 * "Legal" means: the digit does not appear yet in the cell's row, column or
 * block. That is the same candidate set the solving engine works with, and it
 * is the one the automatic notes use: a note is a guess about what is still
 * possible, so it must not offer a digit the engine already ruled out.
 */
import type { Grid } from './grid.ts';
import { initCandidates } from './analysis.ts';
import { digitsOf, maskOf } from './mask.ts';

/** The candidate mask of every cell: 0 for a resolved cell. */
export const candidateMasks = (grid: Grid): Uint16Array => initCandidates(grid);

/**
 * The digits still legal in one cell.
 *
 * An empty cell returns the digits that are not ruled out; a cell that already
 * holds a value returns an empty list, because a filled cell has no candidates.
 */
export const legalDigits = (grid: Grid, index: number): number[] => {
  if (index < 0 || index >= 81) return [];
  const candidates = initCandidates(grid);
  return digitsOf(candidates[index]);
};

/**
 * The legal digits of every EMPTY cell, keyed by cell index.
 *
 * Cells that already hold a value are absent from the map: they have no
 * candidates to note.
 */
export const legalDigitsByCell = (grid: Grid): Record<number, number[]> => {
  const candidates = initCandidates(grid);
  const result: Record<number, number[]> = {};
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const digits = digitsOf(candidates[i]);
    if (digits.length > 0) result[i] = digits;
  }
  return result;
};

/**
 * The automatic notes of every empty cell, as candidate masks.
 *
 * The masks use the engine's convention (`bit (d-1)`), the same one the notes
 * in the game state use, so writing them needs no conversion.
 */
export const autoNoteMasks = (grid: Grid): Record<number, number> => {
  const legal = legalDigitsByCell(grid);
  const result: Record<number, number> = {};
  for (const [index, digits] of Object.entries(legal)) {
    result[Number(index)] = maskOf(...digits);
  }
  return result;
};
