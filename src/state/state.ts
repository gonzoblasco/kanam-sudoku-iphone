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
import { bitFor } from '../core/mask.ts';
import { autoNoteMasks } from '../core/candidates.ts';

/** A reversible change to a single cell. */
export type Mutation =
  | { type: 'set'; index: number; value: Cell }
  | { type: 'clear'; index: number };

/**
 * A mutation as it is kept in the history.
 *
 * `prev` is the value the cell held before the mutation, captured when the
 * mutation is applied. The public `Mutation` contract is unchanged; the extra
 * field is internal and is never serialized. Recomputing the previous value by
 * scanning the history backwards is equivalent only while no entry has been
 * dropped by the cap: once the oldest entry falls off, the scan reaches the
 * start of a history that is no longer the start of the game and restores 0
 * over a value the player really had.
 */
export type HistoryEntry = Mutation & { prev?: Cell };

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
  /**
   * Mutation history and the position within it.
   *
   * `pointer` is the number of APPLIED mutations: 0 means "nothing applied",
   * `entries.length` means "everything applied". That keeps the documented
   * invariant `0 <= pointer <= entries.length` (docs/data-model.md §1.3) true
   * for every state, including the empty one.
   */
  history: { entries: HistoryEntry[]; pointer: number };
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
    history: { entries: [], pointer: 0 },
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

  // A new mutation discards the redo branch: everything after the pointer is
  // the redo branch, and it stops being reachable the moment the player writes.
  const entries = state.history.entries.slice(0, state.history.pointer);
  // `prev` travels WITH the entry: once the cap drops the oldest one, scanning
  // the remaining history backwards no longer reaches the start of the game.
  entries.push({ ...mutation, prev: state.grid[index] });
  while (entries.length > HISTORY_LIMIT) entries.shift();

  return {
    ...state,
    grid,
    history: { entries, pointer: entries.length },
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

/**
 * Write the candidate mask of one cell.
 *
 * Notes are part of the state from day one even though the v1 UI does not
 * render them (ADR-0004). They are not board mutations: a note does not change
 * a cell's value and must not enter the undo history as if it had. This is the
 * API the v2 notes UI will call; keeping it here is what makes the extension a
 * wiring job instead of a rewrite.
 */
export const setNote = (state: GameState, index: number, mask: number): GameState => {
  if (!Number.isInteger(index) || index < 0 || index >= 81) {
    throw new Error(`cell index out of range: ${index}`);
  }
  if (!Number.isInteger(mask) || mask < 0 || mask > 0x1ff) {
    throw new Error(`note mask out of range: ${mask}`);
  }
  const notes = { ...state.notes };
  if (mask === 0) delete notes[index];
  else notes[index] = mask;
  return { ...state, notes };
};

/** The candidate mask of a cell (0 means no notes). */
export const getNote = (state: GameState, index: number): number => state.notes[index] ?? 0;

/**
 * Toggle one digit in a cell's notes.
 *
 * A note is not a board mutation: it does not change the value of a cell, so
 * it does not enter the undo history. That is why this is a separate function
 * and not a `Mutation`.
 */
export const toggleNote = (state: GameState, index: number, digit: number): GameState => {
  if (!Number.isInteger(index) || index < 0 || index >= 81) {
    throw new Error(`cell index out of range: ${index}`);
  }
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
    throw new Error(`note digit out of range: ${digit}`);
  }
  const current = getNote(state, index);
  const mask = current ^ bitFor(digit);
  return setNote(state, index, mask);
};

/**
 * Write the automatic notes of every empty cell.
 *
 * The calculation replaces the previous notes: a manual note that the engine
 * does not consider legal does not survive a recalculation.
 */
export const setAutoNotes = (state: GameState, grid: Grid): GameState => ({
  ...state,
  notes: autoNoteMasks(grid),
});

/** Remove every note of the game. */
export const clearNotes = (state: GameState): GameState => ({ ...state, notes: {} });

/** Undo the last mutation. */
export const undo = (state: GameState): GameState => {
  const { pointer, entries } = state.history;
  if (pointer <= 0) return state;
  const mutation = entries[pointer - 1];
  if (!mutation) return state;

  const grid = state.grid.slice() as Cell[];
  grid[mutation.index] = mutation.prev ?? initialValue(state, mutation.index);
  return {
    ...state,
    grid,
    history: { entries, pointer: pointer - 1 },
  };
};

/** Redo the next mutation. */
export const redo = (state: GameState): GameState => {
  const { pointer, entries } = state.history;
  const next = entries[pointer];
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
 * The value a cell had before any mutation: its given, or empty.
 *
 * Fallback for a history entry that has no captured `prev` (an entry built
 * outside `apply`). Writable cells always start empty, because a given can
 * never be written.
 */
const initialValue = (state: GameState, index: number): Cell =>
  (state.givens.includes(index) ? state.grid[index] : 0) as Cell;
