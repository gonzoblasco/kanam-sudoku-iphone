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
import { digitsOf, maskOf } from './mask.ts';

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
 * Remove duplicates from an elimination list.
 *
 * Overlapping units produce the same {cell, digit} more than once (a cell in
 * both a row and a column of the pattern). The rater applies each entry
 * separately, so a duplicate would be counted as two eliminations and inflate
 * `steps`. `applyDeduction` is idempotent, so the puzzle is not affected: the
 * count is.
 */
const uniqueEliminations = (
  list: { cell: number; digit: number }[],
): { cell: number; digit: number }[] => {
  const seen = new Set<string>();
  const out: { cell: number; digit: number }[] = [];
  for (const entry of list) {
    const key = `${entry.cell}:${entry.digit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
};

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
  return uniqueEliminations(out);
};

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

/**
 * Positions of `digit` inside a row, as {cell, col}.
 */
const rowPositions = (c: Candidates, row: number, digit: number): { cell: number; col: number }[] =>
  CELLS_OF_UNIT[row]
    .filter((cell) => has(c, cell, digit))
    .map((cell) => ({ cell, col: colOf(cell) }));

const colPositions = (c: Candidates, col: number, digit: number): { cell: number; row: number }[] =>
  CELLS_OF_UNIT[9 + col]
    .filter((cell) => has(c, cell, digit))
    .map((cell) => ({ cell, row: rowOf(cell) }));

const sameNumbers = (a: number[], b: number[]): boolean => {
  const sa = [...new Set(a)].sort((x, y) => x - y);
  const sb = [...new Set(b)].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};

/**
 * X-Wing.
 *
 * The digit is confined to the SAME two columns in two rows (or the same two
 * rows in two columns). Then each of those columns must take the digit once,
 * so the digit can be removed from the rest of those columns.
 *
 * The elimination is OUTSIDE the pattern. Removing the digit from the four
 * corners of the rectangle would delete the only cells that can hold it: that
 * is not a deduction, it is destroying the puzzle.
 */
const findXWing = (c: Candidates): Deduction | null => {
  for (let digit = 1; digit <= 9; digit++) {
    // Rows: two rows whose candidate columns are the same pair.
    for (let r1 = 0; r1 < 9; r1++) {
      const p1 = rowPositions(c, r1, digit);
      if (p1.length !== 2) continue;
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        const p2 = rowPositions(c, r2, digit);
        if (p2.length !== 2) continue;
        const cols = p1.map((p) => p.col);
        if (!sameNumbers(cols, p2.map((p) => p.col))) continue;
        const eliminate = buildElimination(
          c,
          cols
            .flatMap((col) => CELLS_OF_UNIT[9 + col])
            .filter((cell) => rowOf(cell) !== r1 && rowOf(cell) !== r2),
          [digit],
        );
        if (eliminate.length > 0) {
          return { techniqueId: 'x_wing', tier: 3, cell: -1, digit: -1, eliminate };
        }
      }
    }
    // Columns: the mirror case.
    for (let c1 = 0; c1 < 9; c1++) {
      const p1 = colPositions(c, c1, digit);
      if (p1.length !== 2) continue;
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        const p2 = colPositions(c, c2, digit);
        if (p2.length !== 2) continue;
        const rows = p1.map((p) => p.row);
        if (!sameNumbers(rows, p2.map((p) => p.row))) continue;
        const eliminate = buildElimination(
          c,
          rows
            .flatMap((row) => CELLS_OF_UNIT[row])
            .filter((cell) => colOf(cell) !== c1 && colOf(cell) !== c2),
          [digit],
        );
        if (eliminate.length > 0) {
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

/**
 * Swordfish.
 *
 * The digit is confined to three columns across three rows (or three rows
 * across three columns). One placement per row over three columns means one
 * placement per column, which is what justifies removing the digit from the
 * OTHER rows inside those three columns.
 *
 * The previous implementation tested the intersection of the three rows (a
 * much weaker condition) and then eliminated the digit from the pattern's own
 * rows, which can delete the digit from the only cells able to hold it.
 */
const findSwordfish = (c: Candidates): Deduction | null => {
  const triples: number[][] = [];
  for (let a = 0; a < 9; a++) {
    for (let b = a + 1; b < 9; b++) {
      for (let d = b + 1; d < 9; d++) triples.push([a, b, d]);
    }
  }

  for (let digit = 1; digit <= 9; digit++) {
    for (const rows of triples) {
      const positions = rows.map((row) => rowPositions(c, row, digit));
      // Each row needs 2 or 3 possible columns: 0 means the digit is already
      // placed in that row, more than 3 means the row is not confined.
      if (positions.some((p) => p.length < 2 || p.length > 3)) continue;
      const cols = [...new Set(positions.flat().map((p) => p.col))];
      if (cols.length !== 3) continue;
      const eliminate = buildElimination(
        c,
        cols
          .flatMap((col) => CELLS_OF_UNIT[9 + col])
          .filter((cell) => !rows.includes(rowOf(cell))),
        [digit],
      );
      if (eliminate.length > 0) {
        return { techniqueId: 'swordfish', tier: 4, cell: -1, digit: -1, eliminate };
      }
    }
    for (const cols of triples) {
      const positions = cols.map((col) => colPositions(c, col, digit));
      if (positions.some((p) => p.length < 2 || p.length > 3)) continue;
      const rows = [...new Set(positions.flat().map((p) => p.row))];
      if (rows.length !== 3) continue;
      const eliminate = buildElimination(
        c,
        rows
          .flatMap((row) => CELLS_OF_UNIT[row])
          .filter((cell) => !cols.includes(colOf(cell))),
        [digit],
      );
      if (eliminate.length > 0) {
        return { techniqueId: 'swordfish', tier: 4, cell: -1, digit: -1, eliminate };
      }
    }
  }
  return null;
};

/**
 * Unique Rectangle, Type 1.
 *
 * A rectangle across exactly two blocks with three corners holding exactly the
 * same two digits and the fourth corner holding those two digits plus extras.
 * If the fourth corner were one of the pair, the four corners would form a
 * deadly pattern with two solutions, which a valid puzzle cannot have. So the
 * pair can be removed from the fourth corner.
 *
 * The previous implementation removed an unrelated third digit from the rest
 * of both blocks, which is not a deduction at all.
 */
const findUniqueRectangle = (c: Candidates): Deduction | null => {
  const bivalue = (cell: number): number[] | null => {
    const mask = c[cell];
    if (mask === 0) return null;
    const digits = digitsOf(mask);
    return digits.length === 2 ? digits : null;
  };
  const band = (row: number): number => Math.floor(row / 3);
  const stack = (col: number): number => Math.floor(col / 3);

  for (let r1 = 0; r1 < 9; r1++) {
    for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) {
        for (let c2 = c1 + 1; c2 < 9; c2++) {
          // The four corners must sit in EXACTLY two boxes, or the swap that
          // defines the deadly pattern is not a valid second solution.
          const sameBand = band(r1) === band(r2);
          const sameStack = stack(c1) === stack(c2);
          if (sameBand === sameStack) continue;

          const corners = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
          const pairs = corners.map(bivalue);
          const withPair = pairs
            .map((pair, index) => ({ pair, index }))
            .filter((entry): entry is { pair: number[]; index: number } => entry.pair !== null);
          if (withPair.length !== 3) continue;

          const [d1, d2] = withPair[0].pair;
          if (!withPair.every((entry) => sameNumbers(entry.pair, [d1, d2]))) continue;

          const extraCell = corners.find((_, index) => !withPair.some((p) => p.index === index));
          if (extraCell === undefined) continue;
          if (!has(c, extraCell, d1) || !has(c, extraCell, d2)) continue;
          // The fourth corner must carry MORE than the pair: if it were the
          // pair too, the puzzle would already have two solutions.
          if (digitsOf(c[extraCell]).length <= 2) continue;

          return {
            techniqueId: 'unique_rectangle',
            tier: 4,
            cell: -1,
            digit: -1,
            eliminate: [
              { cell: extraCell, digit: d1 },
              { cell: extraCell, digit: d2 },
            ],
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
 *
 * Termination does not rely on the caller: every deduction the catalogue
 * returns either places a digit or removes at least one live candidate
 * (`verifyElimination` rejects a no-op), so the candidate set strictly shrinks
 * and the loop cannot spin. The rater still keeps a step backstop.
 */
export const findDeduction = (
  candidates: Candidates,
  maxTier?: number,
): Deduction | null => {
  for (const tech of TECHNIQUES) {
    if (maxTier !== undefined && tech.tier > maxTier) continue;
    const d = tech.detect(candidates);
    if (!d) continue;
    if (!tech.verify(candidates, d)) continue;
    return d;
  }
  return null;
};
