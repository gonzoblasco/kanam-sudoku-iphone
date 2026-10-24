/**
 * Rule validation for a board.
 *
 * A conflict is the same digit appearing in two or more cells of one unit
 * (row, column or block). The unit is what makes it a conflict: the same
 * digit in two cells that never share a unit is perfectly legal.
 *
 * One repeated digit in three cells of a unit is ONE conflict with three
 * cells, not three conflicts of two cells.
 */
import type { Grid } from './grid.ts';
import { CELLS_OF_UNIT } from './geometry.ts';

export type UnitKind = 'row' | 'column' | 'block';

export interface Conflict {
  /** The repeated digit (1-9). */
  value: number;
  /** Which kind of unit holds the conflict. */
  kind: UnitKind;
  /** Index of the unit inside its kind (0-8). */
  unitIndex: number;
  /** The cells taking part in the conflict. */
  cells: number[];
}

export interface ValidationResult {
  conflicts: Conflict[];
  conflictCells: number[];
  conflictedUnits: { kind: UnitKind; index: number }[];
  complete: boolean;
  solved: boolean;
}

/** The unit kinds, in the order the units are stored. */
const UNIT_KINDS: UnitKind[] = [
  ...Array<UnitKind>(9).fill('row'),
  ...Array<UnitKind>(9).fill('column'),
  ...Array<UnitKind>(9).fill('block'),
];

/**
 * Find every conflict in the grid.
 *
 * The input is never mutated.
 */
export const findConflicts = (grid: Grid): Conflict[] => {
  const conflicts: Conflict[] = [];
  for (let u = 0; u < CELLS_OF_UNIT.length; u++) {
    const cells = CELLS_OF_UNIT[u];
    const byDigit = new Map<number, number[]>();
    for (const cell of cells) {
      const value = grid[cell];
      if (value === 0) continue;
      const list = byDigit.get(value) ?? [];
      list.push(cell);
      byDigit.set(value, list);
    }
    for (const [value, participants] of byDigit) {
      if (participants.length < 2) continue;
      conflicts.push({
        value,
        kind: UNIT_KINDS[u],
        unitIndex: u % 9,
        cells: participants,
      });
    }
  }
  return conflicts;
};

/** Every cell taking part in at least one conflict, without duplicates. */
export const conflictCells = (grid: Grid): number[] => {
  const cells = new Set<number>();
  for (const conflict of findConflicts(grid)) {
    for (const cell of conflict.cells) cells.add(cell);
  }
  return [...cells].sort((a, b) => a - b);
};

/** Every unit holding at least one conflict. */
export const conflictedUnits = (grid: Grid): { kind: UnitKind; index: number }[] => {
  const units = new Map<string, { kind: UnitKind; index: number }>();
  for (const conflict of findConflicts(grid)) {
    const key = `${conflict.kind}:${conflict.unitIndex}`;
    if (!units.has(key)) {
      units.set(key, { kind: conflict.kind, index: conflict.unitIndex });
    }
  }
  return [...units.values()];
};

/** Is every cell filled? A full board can still have conflicts. */
export const isComplete = (grid: Grid): boolean => grid.every((v) => v !== 0);

/** Is the board full AND free of conflicts? This is what a victory needs. */
export const isSolved = (grid: Grid): boolean =>
  isComplete(grid) && findConflicts(grid).length === 0;

/** The full validation result in one call. */
export const validate = (grid: Grid): ValidationResult => {
  const conflicts = findConflicts(grid);
  const cells = new Set<number>();
  for (const conflict of conflicts) {
    for (const cell of conflict.cells) cells.add(cell);
  }
  const units = new Map<string, { kind: UnitKind; index: number }>();
  for (const conflict of conflicts) {
    const key = `${conflict.kind}:${conflict.unitIndex}`;
    if (!units.has(key)) {
      units.set(key, { kind: conflict.kind, index: conflict.unitIndex });
    }
  }
  const complete = isComplete(grid);
  return {
    conflicts,
    conflictCells: [...cells].sort((a, b) => a - b),
    conflictedUnits: [...units.values()],
    complete,
    solved: complete && conflicts.length === 0,
  };
};
