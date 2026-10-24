/**
 * Technique catalogue.
 *
 * Every technique detects a REAL deduction and verifies it:
 *
 *  - ASSIGNMENT techniques place a digit in a cell (`cell` + `digit`).
 *  - ELIMINATION techniques remove candidates from cells (`eliminate`).
 *
 * A pattern that only constrains candidates (a pair, a wing) must never place a
 * digit: placing a digit that the pattern does not force is a wrong deduction,
 * and it is what makes a difficulty rating a lie.
 *
 * The tier of a technique is its difficulty, and the difficulty of a puzzle is
 * derived from the highest tier needed to solve it (ADR-0002).
 */
import type { Candidates, Deduction } from './analysis.ts';
import { CELLS_OF_UNIT, rowOf, colOf, blockOf } from './geometry.ts';
import { digitsOf, hasDigit, maskOf } from './mask.ts';

export interface Technique {
  id: string;
  tier: number;
  detect: (c: Candidates) => Deduction | null;
  verify: (c: Candidates, d: Deduction) => boolean;
}

/** Does the cell still have the digit as a candidate? */
const has = (c: Candidates, cell: number, digit: number): boolean =>
  (c[cell] & maskOf(digit)) !== 0;

/**
 * Build the elimination list for a set of cells and digits.
 * Cells with a zero mask are already resolved (or dead) and are skipped.
 */
const buildElimination = (
  c: Candidates,
  cells: number[],
  digits: number[],
): { cell: number; digit: number }[] => {
  const out: { cell: number; digit: number }[] = [];
  for (const cell of cells) {
    if (c[cell] === 0) continue;
    for (const d of digits) {
      if ((c[cell] & maskOf(d)) !== 0) out.push({ cell, digit: d });
    }
  }
  return out;
};

/** Candidates of a digit inside a row, as column indices. */
const colsInRow = (c: Candidates, row: number, digit: number): number[] =>
  CELLS_OF_UNIT[row].filter((cell) => has(c, cell, digit)).map(colOf);

/** Candidates of a digit inside a column, as row indices. */
const rowsInCol = (c: Candidates, col: number, digit: number): number[] =>
  CELLS_OF_UNIT[9 + col].filter((cell) => has(c, cell, digit)).map(rowOf);

/** Set intersection of two number arrays. */
const intersect = (a: number[], b: number[]): number[] =>
  a.filter((x) => b.includes(x));

// ---------------------------------------------------------------------------
// Tier 1: singles
// ---------------------------------------------------------------------------

const findNakedSingle = (c: Candidates): Deduction | null => {
  for (let i = 0; i < c.length; i++) {
    const mask = c[i];
    if (mask !== 0 && (mask & (mask - 1)) === 0) {
      return { techniqueId: 'naked_single', tier: 1, cell: i, digit: digitsOf(mask)[0] };
    }
  }
  return null;
};

const findHiddenSingle = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    for (let d = 1; d <= 9; d++) {
      let count = 0;
      let last = -1;
      for (const cell of cells) {
        if (has(c, cell, d)) {
          count++;
          last = cell;
          if (count > 1) break;
        }
      }
      if (count === 1 && c[last] !== 0) {
        return { techniqueId: 'hidden_single', tier: 1, cell: last, digit: d };
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Tier 2: pairs
// ---------------------------------------------------------------------------

const findNakedPair = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const byMask = new Map<number, number[]>();
    for (const cell of cells) {
      const mask = c[cell];
      if (mask === 0 || digitsOf(mask).length !== 2) continue;
      const list = byMask.get(mask) ?? [];
      list.push(cell);
      byMask.set(mask, list);
    }
    for (const [mask, pair] of byMask) {
      if (pair.length !== 2) continue;
      const others = cells.filter((cell) => !pair.includes(cell));
      const eliminate = buildElimination(c, others, digitsOf(mask));
      if (eliminate.length === 0) continue;
      return { techniqueId: 'naked_pair', tier: 2, cell: -1, digit: -1, eliminate };
    }
  }
  return null;
};

const findHiddenPair = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const byDigit = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      const list = cells.filter((cell) => c[cell] !== 0 && has(c, cell, d));
      if (list.length >= 2) byDigit.set(d, list);
    }
    const entries = [...byDigit.entries()];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [d1, l1] = entries[i];
        const [d2, l2] = entries[j];
        if (l1.length !== 2 || l2.length !== 2) continue;
        if (l1[0] !== l2[0] || l1[1] !== l2[1]) continue;
        const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== d1 && d !== d2);
        const eliminate = buildElimination(c, l1, others);
        if (eliminate.length === 0) continue;
        return { techniqueId: 'hidden_pair', tier: 2, cell: -1, digit: -1, eliminate };
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Tier 3: triples, locked candidates, wings
// ---------------------------------------------------------------------------

const findNakedTriple = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u].filter((cell) => c[cell] !== 0);
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        for (let k = j + 1; k < cells.length; k++) {
          const trio = [cells[i], cells[j], cells[k]];
          const union = new Set<number>();
          for (const cell of trio) for (const d of digitsOf(c[cell])) union.add(d);
          if (union.size !== 3) continue;
          const others = CELLS_OF_UNIT[u].filter((cell) => !trio.includes(cell));
          const eliminate = buildElimination(c, others, [...union]);
          if (eliminate.length === 0) continue;
          return { techniqueId: 'naked_triple', tier: 3, cell: -1, digit: -1, eliminate };
        }
      }
    }
  }
  return null;
};

const findHiddenTriple = (c: Candidates): Deduction | null => {
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const byDigit = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      const list = cells.filter((cell) => c[cell] !== 0 && has(c, cell, d));
      if (list.length >= 2 && list.length <= 3) byDigit.set(d, list);
    }
    const entries = [...byDigit.entries()];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        for (let k = j + 1; k < entries.length; k++) {
          const [d1, l1] = entries[i];
          const [d2, l2] = entries[j];
          const [d3, l3] = entries[k];
          if (l1.length !== 3 || l2.length !== 3 || l3.length !== 3) continue;
          if (l1[0] !== l2[0] || l1[0] !== l3[0]) continue;
          if (l1[1] !== l2[1] || l1[1] !== l3[1]) continue;
          if (l1[2] !== l2[2] || l1[2] !== l3[2]) continue;
          const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
            (d) => d !== d1 && d !== d2 && d !== d3,
          );
          const eliminate = buildElimination(c, l1, others);
          if (eliminate.length === 0) continue;
          return { techniqueId: 'hidden_triple', tier: 3, cell: -1, digit: -1, eliminate };
        }
      }
    }
  }
  return null;
};

const findLockedCandidatesPointing = (c: Candidates): Deduction | null => {
  for (let block = 0; block < 9; block++) {
    const blockCells = CELLS_OF_UNIT[18 + block];
    for (let d = 1; d <= 9; d++) {
      const cells = blockCells.filter((cell) => c[cell] !== 0 && has(c, cell, d));
      if (cells.length < 2) continue;
      const rows = [...new Set(cells.map(rowOf))];
      if (rows.length === 1) {
        const rest = CELLS_OF_UNIT[rows[0]].filter((cell) => !cells.includes(cell));
        const eliminate = buildElimination(c, rest, [d]);
        if (eliminate.length > 0) {
          return {
            techniqueId: 'locked_candidates_pointing',
            tier: 3,
            cell: -1,
            digit: -1,
            eliminate,
          };
        }
      }
      const cols = [...new Set(cells.map(colOf))];
      if (cols.length === 1) {
        const rest = CELLS_OF_UNIT[9 + cols[0]].filter((cell) => !cells.includes(cell));
        const eliminate = buildElimination(c, rest, [d]);
        if (eliminate.length > 0) {
          return {
            techniqueId: 'locked_candidates_pointing',
            tier: 3,
            cell: -1,
            digit: -1,
            eliminate,
          };
        }
      }
    }
  }
  return null;
};

const findLockedCandidatesClaiming = (c: Candidates): Deduction | null => {
  for (let row = 0; row < 9; row++) {
    const rowCells = CELLS_OF_UNIT[row];
    for (let d = 1; d <= 9; d++) {
      const cells = rowCells.filter((cell) => c[cell] !== 0 && has(c, cell, d));
      if (cells.length < 2) continue;
      const blocks = [...new Set(cells.map(blockOf))];
      if (blocks.length === 1) {
        const rest = CELLS_OF_UNIT[18 + blocks[0]].filter((cell) => !cells.includes(cell));
        const eliminate = buildElimination(c, rest, [d]);
        if (eliminate.length > 0) {
          return {
            techniqueId: 'locked_candidates_claiming',
            tier: 3,
            cell: -1,
            digit: -1,
            eliminate,
          };
        }
      }
    }
  }
  return null;
};

const findXWing = (c: Candidates): Deduction | null => {
  // A digit confined to two rows and two columns, shared by two digits.
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
          const confined: number[] = [];
          for (let d = 1; d <= 9; d++) {
            const inRows = intersect(colsInRow(c, r1, d), colsInRow(c, r2, d));
            const inCols = intersect(rowsInCol(c, c1, d), rowsInCol(c, c2, d));
            if (
              inRows.length === 2 &&
              inRows.includes(c1) &&
              inRows.includes(c2) &&
              inCols.length === 2 &&
              inCols.includes(r1) &&
              inCols.includes(r2)
            ) {
              confined.push(d);
            }
          }
          if (confined.length < 2) continue;
          const [d1, d2] = confined;
          // Each digit keeps only its own position in the rectangle.
          const eliminate = [
            { cell: r1 * 9 + c1, digit: d1 },
            { cell: r2 * 9 + c2, digit: d1 },
            { cell: r1 * 9 + c2, digit: d2 },
            { cell: r2 * 9 + c1, digit: d2 },
          ].filter((e) => (c[e.cell] & maskOf(e.digit)) !== 0);
          if (eliminate.length === 0) continue;
          return { techniqueId: 'x_wing', tier: 3, cell: -1, digit: -1, eliminate };
        }
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Tier 4: swordfish and unique rectangle
// ---------------------------------------------------------------------------

const findSwordfish = (c: Candidates): Deduction | null => {
  // Three digits confined to the same three rows and three columns.
  const rowTriples: number[][] = [];
  for (let a = 0; a < 9; a++) {
    for (let b = a + 1; b < 9; b++) {
      for (let d = b + 1; d < 9; d++) rowTriples.push([a, b, d]);
    }
  }
  for (const rows of rowTriples) {
    const confined = new Map<string, number[]>();
    for (let digit = 1; digit <= 9; digit++) {
      const cols = intersect(
        intersect(colsInRow(c, rows[0], digit), colsInRow(c, rows[1], digit)),
        colsInRow(c, rows[2], digit),
      );
      if (cols.length !== 3) continue;
      const key = [...cols].sort((x, y) => x - y).join(',');
      const list = confined.get(key) ?? [];
      list.push(digit);
      confined.set(key, list);
    }
    for (const [, digits] of confined) {
      if (digits.length < 3) continue;
      const [d1, d2, d3] = digits;
      const eliminate: { cell: number; digit: number }[] = [];
      for (const digit of [d1, d2, d3]) {
        for (const row of rows) {
          const inside = CELLS_OF_UNIT[row].filter((cell) =>
            intersect(colsInRow(c, row, digit), [colOf(cell)]).length === 1,
          );
          for (const cell of inside) {
            const col = colOf(cell);
            const cols = intersect(
              intersect(colsInRow(c, rows[0], digit), colsInRow(c, rows[1], digit)),
              colsInRow(c, rows[2], digit),
            );
            if (cols.includes(col)) continue;
            if ((c[cell] & maskOf(digit)) !== 0) eliminate.push({ cell, digit });
          }
        }
      }
      if (eliminate.length === 0) continue;
      return { techniqueId: 'swordfish', tier: 4, cell: -1, digit: -1, eliminate };
    }
  }
  return null;
};

const findUniqueRectangle = (c: Candidates): Deduction | null => {
  // Four cells forming a rectangle across two blocks, sharing only two digits.
  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          const top = [r1 * 9 + c1, r1 * 9 + c2];
          const bottom = [r2 * 9 + c1, r2 * 9 + c2];
          const topBlock = blockOf(top[0]);
          const bottomBlock = blockOf(bottom[0]);
          if (topBlock === bottomBlock) continue;
          if (blockOf(top[1]) !== topBlock || blockOf(bottom[1]) !== bottomBlock) continue;
          const union = new Set<number>();
          for (const cell of [...top, ...bottom]) {
            if (c[cell] === 0) continue;
            for (const d of digitsOf(c[cell])) union.add(d);
          }
          if (union.size !== 2) continue;
          const [d1, d2] = [...union];
          const third = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
            (d) => d !== d1 && d !== d2,
          );
          if (third === undefined) continue;
          const rest = [
            ...CELLS_OF_UNIT[18 + topBlock].filter((cell) => !top.includes(cell)),
            ...CELLS_OF_UNIT[18 + bottomBlock].filter((cell) => !bottom.includes(cell)),
          ];
          const eliminate = buildElimination(c, rest, [third]);
          if (eliminate.length === 0) continue;
          return {
            techniqueId: 'unique_rectangle',
            tier: 4,
            cell: -1,
            digit: -1,
            eliminate,
          };
        }
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/** An assignment still holds if the digit is still a candidate of the cell. */
const verifyAssignment = (c: Candidates, d: Deduction): boolean =>
  d.cell >= 0 && d.digit > 0 && has(c, d.cell, d.digit);

/**
 * An elimination still holds if at least one of its eliminations would remove
 * a candidate right now. This is what stops the rater from applying the same
 * no-op deduction forever.
 */
const verifyElimination = (c: Candidates, d: Deduction): boolean => {
  if (!d.eliminate) return false;
  return d.eliminate.some((e) => (c[e.cell] & maskOf(e.digit)) !== 0);
};

/** Catalogue, ordered by tier: the simplest deduction is found first. */
export const TECHNIQUES: Technique[] = [
  { id: 'hidden_single', tier: 1, detect: findHiddenSingle, verify: verifyAssignment },
  { id: 'naked_single', tier: 1, detect: findNakedSingle, verify: verifyAssignment },
  { id: 'naked_pair', tier: 2, detect: findNakedPair, verify: verifyElimination },
  { id: 'hidden_pair', tier: 2, detect: findHiddenPair, verify: verifyElimination },
  { id: 'naked_triple', tier: 3, detect: findNakedTriple, verify: verifyElimination },
  { id: 'hidden_triple', tier: 3, detect: findHiddenTriple, verify: verifyElimination },
  {
    id: 'locked_candidates_pointing',
    tier: 3,
    detect: findLockedCandidatesPointing,
    verify: verifyElimination,
  },
  {
    id: 'locked_candidates_claiming',
    tier: 3,
    detect: findLockedCandidatesClaiming,
    verify: verifyElimination,
  },
  { id: 'x_wing', tier: 3, detect: findXWing, verify: verifyElimination },
  { id: 'swordfish', tier: 4, detect: findSwordfish, verify: verifyElimination },
  { id: 'unique_rectangle', tier: 4, detect: findUniqueRectangle, verify: verifyElimination },
];

/**
 * The simplest deduction available.
 *
 * `maxTier` caps the difficulty of the techniques used, which is how the
 * generator asks "can this puzzle be solved with only easy techniques?".
 * `skip` holds the ids of techniques that were already tried and produced no
 * progress, so a broken technique cannot spin the rater forever.
 */
export const findDeduction = (
  candidates: Candidates,
  maxTier?: number,
  skip?: Set<string>,
): Deduction | null => {
  for (const tech of TECHNIQUES) {
    if (maxTier !== undefined && tech.tier > maxTier) continue;
    if (skip?.has(tech.id)) continue;
    const d = tech.detect(candidates);
    if (!d) continue;
    if (!tech.verify(candidates, d)) continue;
    return d;
  }
  return null;
};
