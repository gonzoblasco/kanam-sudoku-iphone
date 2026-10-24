/**
 * Bit‑mask utilities for Sudoku candidates.
 *
 * The only place where a bit shift is performed. All other modules must use
 * the exported helpers.
 */

/** Return the mask for a single digit (1‑9). */
export const bitFor = (digit: number): number => {
  // digit is in 1..9; shift by digit‑1
  return 1 << (digit - 1);
};

/** Alias for clarity. */
export const maskOf = bitFor;

/** Does the mask contain `digit`? */
export const hasDigit = (mask: number, digit: number): boolean =>
  (mask & bitFor(digit)) !== 0;

/** Return an array of digits present in the mask. */
export const digitsOf = (mask: number): number[] => {
  const result: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (hasDigit(mask, d)) result.push(d);
  }
  return result;
};

/** Empty mask (no candidates). */
export const EMPTY_MASK = 0;

/** Full mask – all nine digits. */
export const FULL_MASK = bitFor(1) | bitFor(2) | bitFor(3) | bitFor(4) | bitFor(5) | bitFor(6) | bitFor(7) | bitFor(8) | bitFor(9);

