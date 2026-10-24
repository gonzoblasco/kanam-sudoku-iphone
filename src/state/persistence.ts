/**
 * Persistence for the game in progress.
 *
 * Two rules shape this module:
 *
 *  1. The storage is INJECTED. The logic never touches `localStorage` or
 *     `window`, which is what makes saving and restoring testable without a
 *     browser.
 *  2. The payload keeps the distinction between a GIVEN (an initial clue, not
 *     editable) and a PLAYER MOVE (editable). Restoring a board without that
 *     distinction would turn every move the player made into a clue, and the
 *     player could no longer correct a mistake.
 */
import type { Cell, Grid } from '../core/grid.ts';
import type { GameState } from './state.ts';
import { createGameState } from './state.ts';

/** The minimum storage surface this module needs. */
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The persisted shape of a game. */
export interface SavedGame {
  schemaVersion: number;
  grid: Cell[];
  givens: number[];
  selected: number | null;
  hintsUsed: number;
  elapsedMs: number;
  paused: boolean;
  notes: Record<number, number>;
}

export const GAME_KEY = 'kanam.sudoku.iphone.game';
export const PREFS_KEY = 'kanam.sudoku.iphone.prefs';

export const SCHEMA_VERSION = 1;

const emptyState = (): GameState => createGameState(new Array(81).fill(0) as Cell[]);

/** Serialize a game state into the persisted shape. */
export const serialize = (state: GameState): SavedGame => ({
  schemaVersion: SCHEMA_VERSION,
  grid: Array.from(state.grid) as Cell[],
  givens: [...state.givens],
  selected: state.selected,
  hintsUsed: state.hintsUsed,
  elapsedMs: state.elapsedMs,
  paused: state.paused,
  notes: { ...state.notes },
});

/** Serialize a game state to the string that gets stored. */
export const toStorageString = (state: GameState): string =>
  JSON.stringify(serialize(state));

/**
 * Rebuild a state from a persisted payload.
 *
 * Returns `recovered: true` when the payload could not be used: a future
 * schema version, a malformed payload, or a payload whose shape is wrong. The
 * caller gets a clean state instead of an exception.
 */
export const deserialize = (payload: unknown): { state: GameState | null; recovered: boolean } => {
  let parsed: unknown = payload;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return { state: null, recovered: true };
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { state: null, recovered: true };
  }

  const raw = parsed as Record<string, unknown>;
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;

  // A future version is rejected, never guessed at.
  if (version > SCHEMA_VERSION) {
    return { state: null, recovered: true };
  }

  // Version 0 payloads (the earlier shape) carried a board and an elapsed time
  // and no givens: every filled cell was a clue.
  const grid = (raw.grid ?? raw.board) as unknown;
  if (!Array.isArray(grid) || grid.length !== 81) {
    return { state: null, recovered: true };
  }
  const cells = grid as number[];
  if (!cells.every((v) => Number.isInteger(v) && v >= 0 && v <= 9)) {
    return { state: null, recovered: true };
  }

  const rawGivens = (version === 0 ? null : raw.givens) as unknown;
  const givens: number[] = [];
  if (Array.isArray(rawGivens)) {
    for (const g of rawGivens) {
      if (Number.isInteger(g) && g >= 0 && g < 81) givens.push(g as number);
    }
  } else {
    // Version 0: a filled cell was a clue.
    for (let i = 0; i < 81; i++) if (cells[i] !== 0) givens.push(i);
  }

  const selected = raw.selected;
  const notes = (raw.notes ?? {}) as Record<string, unknown>;
  const cleanNotes: Record<number, number> = {};
  for (const [key, value] of Object.entries(notes)) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < 81 && Number.isInteger(value)) {
      cleanNotes[index] = value as number;
    }
  }

  const state = createGameState(cells as Cell[]);
  return {
    state: {
      ...state,
      givens,
      selected:
        typeof selected === 'number' && selected >= 0 && selected < 81 ? selected : null,
      hintsUsed: typeof raw.hintsUsed === 'number' ? raw.hintsUsed : 0,
      elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : 0,
      paused: typeof raw.paused === 'boolean' ? raw.paused : true,
      notes: cleanNotes,
    },
    recovered: false,
  };
};

/**
 * Save a game. Storage failures (quota, permissions) are swallowed: the game
 * must stay playable even when it cannot be stored.
 */
export const save = (state: GameState, storage: Storage): boolean => {
  try {
    storage.setItem(GAME_KEY, toStorageString(state));
    return true;
  } catch {
    return false;
  }
};

/** Load the saved game, or null when there is none. */
export const load = (storage: Storage): { state: GameState | null; recovered: boolean } => {
  let raw: string | null = null;
  try {
    raw = storage.getItem(GAME_KEY);
  } catch {
    return { state: null, recovered: false };
  }
  if (!raw) return { state: null, recovered: false };
  return deserialize(raw);
};

/** Forget the saved game. */
export const clearSaved = (storage: Storage): void => {
  try {
    storage.removeItem(GAME_KEY);
  } catch {
    // Nothing to do: the game is playable without storage.
  }
};
