/**
 * Game state, aligned to SPEC-005.
 *
 * Two rules shape this module:
 *
 *  1. **One write path.** Every change to the board goes through `apply` with a
 *     mutation. `setValue` and `clearValue` build a mutation and apply it;
 *     there is no second way to write into the grid. That is what lets undo,
 *     redo and notes be added later without rewriting the core (ADR-0004).
 *  2. **The previous state is never mutated.** Each operation returns a new
 *     state, so a caller holding an older state still sees the old board.
 */
import type { Cell, Grid } from '../core/grid.ts';

/** A reversible change to a single cell. */
export type Mutation =
  | { type: 'set'; index: number; value: Cell }
  | { type: 'clear'; index: number };

/** The game state contract (SPEC-005). */
export interface GameState {
  /** Current board values. */
  grid: Grid;
  /** Indices of the givens (initial clues), ascending. */
  givens: number[];
  /** Selected cell, or null. */
  selected: number | null;
  /** Hints used so far. */
  hintsUsed: number;
  /** Effective play time in milliseconds. */
  elapsedMs: number;
  /** Whether the clock is paused. */
  paused: boolean;
  /** Mutation history and the position within it. */
  history: { entries: Mutation[]; pointer: number };
  /** Per-cell candidate mask. Empty in v1, but present in the state. */
  notes: Record<number, number>;
}

/** The history never grows past this; the oldest entry is dropped instead. */
export const HISTORY_LIMIT = 1000;

/** Create a fresh game state from a puzzle (its filled cells are the givens). */
export const createGameState = (puzzle: Grid): GameState => {
  const givens: number[] = [];
  for (let i = 0; i < puzzle.length; i++) {
    if (puzzle[i] !== 0) givens.push(i);
  }
  return {
    grid: puzzle.slice() as Cell[],
    givens,
    selected: null,
    hintsUsed: 0,
    elapsedMs: 0,
    paused: false,
    history: { entries: [], pointer: -1 },
    notes: {},
  };
};

/** The value of a cell. */
export const getValue = (state: GameState, index: number): Cell =>
  state.grid[index] as Cell;

/**
 * Apply a mutation. This is the only function that writes into the grid.
 *
 * A mutation that changes nothing is a no-op: it returns the same state and
 * does not touch the history, so the history never fills with noise.
 */
export const apply = (state: GameState, mutation: Mutation): GameState => {
  const index = mutation.index;
  if (!Number.isInteger(index) || index < 0 || index >= 81) {
    throw new Error(`cell index out of range: ${index}`);
  }
  // A given is part of the puzzle, not of the player's moves.
  if (state.givens.includes(index)) return state;

  const value: Cell = mutation.type === 'clear' ? 0 : mutation.value;
  if (!Number.isInteger(value) || value < 0 || value > 9) {
    throw new Error(`invalid cell value: ${value}`);
  }
  if (state.grid[index] === value) return state;

  const grid = state.grid.slice() as Cell[];
  grid[index] = value;

  // A new mutation discards the redo branch.
  const entries = state.history.entries.slice(0, state.history.pointer + 1);
  entries.push(mutation);
  while (entries.length > HISTORY_LIMIT) entries.shift();

  return {
    ...state,
    grid,
    history: { entries, pointer: entries.length - 1 },
  };
};

/** Set a cell's value. */
export const setValue = (state: GameState, index: number, value: Cell): GameState =>
  apply(state, { type: 'set', index, value });

/** Clear a cell. */
export const clearValue = (state: GameState, index: number): GameState =>
  apply(state, { type: 'clear', index });

/** Select a cell, or deselect with null. */
export const selectCell = (state: GameState, index: number | null): GameState => {
  if (index !== null && (!Number.isInteger(index) || index < 0 || index >= 81)) {
    throw new Error(`cell index out of range: ${index}`);
  }
  if (state.selected === index) return state;
  return { ...state, selected: index };
};

/** Undo the last mutation. */
export const undo = (state: GameState): GameState => {
  const { pointer, entries } = state.history;
  if (pointer < 0) return state;
  const mutation = entries[pointer];
  if (!mutation) return state;

  const grid = state.grid.slice() as Cell[];
  // Undo a set by restoring the previous value, which the history does not
  // carry: undo walks back to the value the cell had before, tracked by the
  // mutation that is being undone.
  grid[mutation.index] = previousValue(state, mutation, pointer);
  return {
    ...state,
    grid,
    history: { entries, pointer: pointer - 1 },
  };
};

/** Redo the next mutation. */
export const redo = (state: GameState): GameState => {
  const { pointer, entries } = state.history;
  const next = entries[pointer + 1];
  if (!next) return state;

  const grid = state.grid.slice() as Cell[];
  grid[next.index] = next.type === 'clear' ? 0 : next.value;
  return {
    ...state,
    grid,
    history: { entries, pointer: pointer + 1 },
  };
};

/**
 * The value a cell had before the mutation at `pointer` was applied.
 *
 * The history stores mutations, not snapshots, so the previous value is
 * recovered from the mutation that came before it: the cell holds the value
 * written by the previous mutation, or the given when there is none.
 */
const previousValue = (
  state: GameState,
  mutation: Mutation,
  pointer: number,
): Cell => {
  for (let i = pointer - 1; i >= 0; i--) {
    const earlier = state.history.entries[i];
    if (earlier.index !== mutation.index) continue;
    return earlier.type === 'clear' ? 0 : earlier.value;
  }
  // No earlier mutation touched this cell: it still holds its given value.
  return (state.givens.includes(mutation.index) ? state.grid[mutation.index] : 0) as Cell;
};
