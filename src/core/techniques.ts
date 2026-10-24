/**
 * Minimal catalogue of Sudoku solving techniques.
 *
 * Each technique provides a `detect` function that receives the candidate mask
 * array and, if applicable, returns a `Deduction` describing the forced assignment.
 * The `verify` function re‑checks that the deduction is still valid.
 */
import { Candidates, Deduction } from './analysis.js';
import { PEERS, UNITS_OF_CELL, CELLS_OF_UNIT } from './geometry.js';
import { hasDigit, digitsOf, maskOf } from './mask.js';

/** Technique definition. */
export interface Technique {
  id: string;
  tier: number;
  detect: (c: Candidates) => Deduction | null;
  verify: (c: Candidates, d: Deduction) => boolean;
}

/** Helper: find the first cell with a single candidate. */
const findNakedSingle = (c: Candidates): Deduction | null => {
  for (let i = 0; i < c.length; i++) {
    const mask = c[i];
    if (mask !== 0 && (mask & (mask - 1)) === 0) {
      // only one bit set
      const digit = digitsOf(mask)[0];
      return { techniqueId: 'naked_single', tier: 1, cell: i, digit };
    }
  }
  return null;
};

/** Helper: hidden single detection. */
const findHiddenSingle = (c: Candidates): Deduction | null => {
  // Iterate over each unit
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    // For each digit, count appearances in candidates within the unit
    for (let d = 1; d <= 9; d++) {
      const maskBit = maskOf(d);
      let count = 0;
      let lastCell = -1;
      for (const cell of cells) {
        if (hasDigit(c[cell], d)) {
          count++;
          lastCell = cell;
          if (count > 1) break;
        }
      }
      if (count === 1) {
        return { techniqueId: 'hidden_single', tier: 1, cell: lastCell, digit: d };
      }
    }
  }
  return null;
};

/** Helper: naked pair detection – returns first found pair as two assignments (optional). */
const findNakedPair = (c: Candidates): Deduction | null => {
  // Look in each unit for exactly two cells sharing the same two‑digit mask.
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const map = new Map<number, number[]>(); // mask -> list of cells
    for (const cell of cells) {
      const mask = c[cell];
      const digits = digitsOf(mask);
      if (digits.length === 2) {
        const arr = map.get(mask) ?? [];
        arr.push(cell);
        map.set(mask, arr);
      }
    }
    for (const [mask, cellsWithMask] of map.entries()) {
      if (cellsWithMask.length === 2) {
        // Return a representative deduction – assign one digit of the pair.
        const digit = digitsOf(mask)[0];
        return { techniqueId: 'naked_pair', tier: 2, cell: cellsWithMask[0], digit };
      }
    }
  }
  return null;
};

/** Helper: hidden pair detection – similar to naked pair but based on digit frequency. */
const findHiddenPair = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    // Build digit -> cells map where digit appears as candidate
    const digitMap = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      const cellsWith = [] as number[];
      const maskBit = maskOf(d);
      for (const cell of cells) {
        if (hasDigit(c[cell], d)) {
          cellsWith.push(cell);
        }
      }
      if (cellsWith.length === 2) {
        digitMap.set(d, cellsWith);
      }
    }
    // Find two digits that share the exact same two cells
    const entries = Array.from(digitMap.entries());
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [d1, cells1] = entries[i];
        const [d2, cells2] = entries[j];
        if (cells1.length === 2 && cells2.length === 2 &&
          cells1[0] === cells2[0] && cells1[1] === cells2[1]) {
          // Found hidden pair – we can assign one of the digits as deduction placeholder.
          return { techniqueId: 'hidden_pair', tier: 2, cell: cells1[0], digit: d1 };
        }
      }
    }
  }
  return null;
};

/** Helper: hidden triple detection (tier 3). */
const findHiddenTriple = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    // Map digit -> cells where it appears
    const digitMap = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      const cellsWith = [] as number[];
      for (const cell of cells) {
        if (hasDigit(c[cell], d)) cellsWith.push(cell);
      }
      if (cellsWith.length >= 2 && cellsWith.length <= 3) {
        digitMap.set(d, cellsWith);
      }
    }
    const digits = Array.from(digitMap.keys());
    // Look for any combination of three digits whose union of cells size is 3
    const n = digits.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const union = new Set<number>([...digitMap.get(digits[i])!, ...digitMap.get(digits[j])!, ...digitMap.get(digits[k])!]);
          if (union.size === 3) {
            const cell = Array.from(union)[0];
            const digit = digits[i];
            return { techniqueId: 'hidden_triple', tier: 3, cell, digit };
          }
        }
      }
    }
  }
  return null;
};

/** Verify that a deduction still holds (the cell still has that digit as a candidate). */
const verifyAssignment = (c: Candidates, d: Deduction): boolean => {
  return hasDigit(c[d.cell], d.digit);
};

/** Catalogue – ordered by tier (simple first). */
export const TECHNIQUES: Technique[] = [
  { id: 'hidden_single', tier: 1, detect: findHiddenSingle, verify: verifyAssignment },
  { id: 'naked_single', tier: 1, detect: findNakedSingle, verify: verifyAssignment },
  { id: 'naked_pair', tier: 2, detect: findNakedPair, verify: verifyAssignment },
  { id: 'hidden_pair', tier: 2, detect: findHiddenPair, verify: verifyAssignment },
  { id: 'hidden_triple', tier: 3, detect: findHiddenTriple, verify: verifyAssignment },
  // Additional advanced techniques could be added here.
];

/** Find the simplest deduction available (optional maxTier filter). */
export const findDeduction = (candidates: Candidates, maxTier?: number): Deduction | null => {
  for (const tech of TECHNIQUES) {
    if (maxTier !== undefined && tech.tier > maxTier) continue;
    const d = tech.detect(candidates);
    if (d) return d;
  }
  return null;
};

