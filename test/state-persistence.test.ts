import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Cell } from '../src/core/grid.ts';
import {
  apply,
  clearValue,
  createGameState,
  getValue,
  redo,
  selectCell,
  setValue,
  setNote,
  getNote,
  undo,
  HISTORY_LIMIT,
  type GameState,
} from '../src/state/state.ts';
import {
  clearSaved,
  deserialize,
  load,
  save,
  serialize,
  toStorageString,
  GAME_KEY,
  type Storage,
} from '../src/state/persistence.ts';

const emptyBoard = (): GameState => createGameState(new Array(81).fill(0) as never);

/** A storage that lives in memory, so the tests never touch localStorage. */
const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
};

describe('Game state', () => {
  test('setValue writes the value and records the mutation', () => {
    const state = emptyBoard();
    const next = setValue(state, 0, 5);
    assert.equal(getValue(next, 0), 5);
    assert.equal(next.history.entries.length, 1);
    // The pointer counts APPLIED mutations: 0 <= pointer <= entries.length.
    assert.equal(next.history.pointer, 1);
  });

  test('the previous state is never mutated', () => {
    const state = emptyBoard();
    const snapshot = JSON.stringify(state);
    let current = state;
    for (let i = 0; i < 20; i++) {
      current = i % 2 === 0 ? setValue(current, i, 7) : clearValue(current, i - 1);
    }
    assert.equal(JSON.stringify(state), snapshot, 'the original state changed under the caller');
  });

  test('a given cannot be changed', () => {
    const puzzle = new Array(81).fill(0) as never;
    (puzzle as unknown as number[])[3] = 4;
    const state = createGameState(puzzle);
    const next = setValue(state, 3, 9);
    assert.equal(getValue(next, 3), 4, 'the given was overwritten');
    assert.equal(next.history.entries.length, 0, 'a no-op must not touch the history');
  });

  test('a mutation that changes nothing is a no-op', () => {
    const state = setValue(emptyBoard(), 0, 5 as Cell);
    const again = setValue(state, 0, 5);
    assert.equal(again.history.entries.length, 1, 'the history filled with noise');
    assert.equal(again, state, 'a no-op must return the same state');
  });

  test('undo and redo return to the exact same state', () => {
    let state = emptyBoard();
    const moves: Array<[number, number]> = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
    ];
    for (const [index, value] of moves) state = setValue(state, index, value as Cell);
    const after = JSON.stringify(state);
    for (let i = 0; i < moves.length; i++) state = undo(state);
    assert.deepEqual(state.grid, new Array(81).fill(0), 'undo did not clear the board');
    for (let i = 0; i < moves.length; i++) state = redo(state);
    assert.equal(JSON.stringify(state), after, 'redo did not restore the exact state');
  });

  test('a new mutation discards the redo branch', () => {
    let state = setValue(emptyBoard(), 0, 1 as Cell);
    state = setValue(state, 1, 2 as Cell);
    state = undo(state);
    assert.equal(getValue(state, 1), 0, 'undo failed');
    state = setValue(state, 2, 3);
    const redone = redo(state);
    assert.equal(getValue(redone, 1), 0, 'redo resurrected a discarded branch');
  });

  test('undo after the cap drops the oldest entry restores the real value', () => {
    // The bug this covers: recomputing the previous value by scanning the
    // history backwards. Once the cap has dropped the entry that wrote the
    // cell, the scan reaches the start of a history that is not the start of
    // the game and "restores" 0 over a value the player really had.
    let state = emptyBoard();
    state = setValue(state, 0, 5 as Cell);
    // Push the entry that wrote cell 0 out of the capped history.
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      state = setValue(state, 1 + (i % 80), ((i % 9) + 1) as Cell);
    }
    state = setValue(state, 0, 6 as Cell);
    const undone = undo(state);
    assert.equal(getValue(undone, 0), 5, 'undo fell through the truncated history to 0');
  });

  test('undo and redo across the same cell keep the exact value', () => {
    // The adversarial sequence: write, undo, write something else, undo, redo.
    let state = emptyBoard();
    state = setValue(state, 4, 7 as Cell);
    state = undo(state);
    state = setValue(state, 4, 2 as Cell);
    state = undo(state);
    assert.equal(getValue(state, 4), 0, 'the cell must be empty after both undos');
    state = redo(state);
    assert.equal(getValue(state, 4), 2, 'redo must apply the surviving mutation');
    assert.equal(state.history.pointer, 1);
    assert.equal(state.history.entries.length, 1, 'the discarded branch must be gone');
  });

  test('the history pointer stays within its documented range', () => {
    let state = emptyBoard();
    assert.equal(state.history.pointer, 0);
    for (let i = 0; i < 5; i++) {
      state = setValue(state, i, 1 as Cell);
      assert.ok(
        state.history.pointer >= 0 && state.history.pointer <= state.history.entries.length,
        `pointer ${state.history.pointer} out of range for ${state.history.entries.length} entries`,
      );
    }
    state = undo(state);
    state = undo(state);
    assert.equal(state.history.pointer, 3);
  });

  test('the history is capped and the current state survives the cap', () => {
    let state = emptyBoard();
    const total = HISTORY_LIMIT + 50;
    // Track the last value written to each cell, so the expectation is derived
    // from the run and not hard-coded.
    const lastWritten = new Map<number, number>();
    for (let i = 0; i < total; i++) {
      const index = i % 81;
      const value = (i % 9) + 1;
      lastWritten.set(index, value);
      state = setValue(state, index, value as Cell);
    }
    assert.ok(
      state.history.entries.length <= HISTORY_LIMIT,
      `history grew to ${state.history.entries.length}`,
    );
    for (const [index, value] of lastWritten) {
      assert.equal(getValue(state, index), value, `the value of cell ${index} was lost`);
    }
  });

  test('selectCell selects and deselects', () => {
    const state = emptyBoard();
    const selected = selectCell(state, 12);
    assert.equal(selected.selected, 12);
    assert.equal(selectCell(selected, null).selected, null);
  });

  test('a note lives in the state without touching the board or the history', () => {
    // SPEC-005 RF-6: the structure is ready in v1. The pair (present in the
    // serialized payload, absent from the DOM) is the proof that adding the
    // notes UI later does not need to rewrite the core.
    const state = emptyBoard();
    const withNote = setNote(state, 9, 0b101010101);
    assert.equal(getNote(withNote, 9), 0b101010101);
    assert.equal(getValue(withNote, 9), 0, 'a note must not fill the cell');
    assert.equal(withNote.history.entries.length, 0, 'a note is not a board mutation');
    assert.equal(getNote(state, 9), 0, 'the previous state must not change');
    assert.deepEqual(serialize(withNote).notes, { 9: 0b101010101 });
    assert.deepEqual(serialize(setNote(withNote, 9, 0)).notes, {}, 'clearing a note removes it');
    assert.throws(() => setNote(state, 9, 9999));
  });

  test('an out-of-range cell is rejected', () => {
    assert.throws(() => setValue(emptyBoard(), 81, 1));
    assert.throws(() => setValue(emptyBoard(), -1, 1));
    assert.throws(() => selectCell(emptyBoard(), 100));
  });

  test('apply is the only write path and honours the givens', () => {
    const puzzle = new Array(81).fill(0) as never;
    (puzzle as unknown as number[])[0] = 3;
    const state = createGameState(puzzle);
    const viaApply = apply(state, { type: 'set', index: 0, value: 8 });
    assert.equal(getValue(viaApply, 0), 3, 'apply wrote over a given');
    const viaApplyOk = apply(state, { type: 'set', index: 1, value: 8 });
    assert.equal(getValue(viaApplyOk, 1), 8);
  });
});

describe('Persistence', () => {
  test('a state survives a save and load round trip', () => {
    const storage = memoryStorage();
    let state = emptyBoard();
    state = setValue(state, 0, 5 as Cell);
    state = setValue(state, 1, 6 as Cell);
    state = selectCell(state, 2);
    state = { ...state, elapsedMs: 4200, hintsUsed: 1 };

    assert.equal(save(state, storage), true);
    const loaded = load(storage);
    assert.equal(loaded.recovered, false);
    assert.ok(loaded.state);
    assert.deepEqual([...loaded.state!.grid], [...state.grid]);
    assert.equal(loaded.state!.selected, 2);
    assert.equal(loaded.state!.elapsedMs, 4200);
    assert.equal(loaded.state!.hintsUsed, 1);
  });

  test('the givens and the player moves stay distinct after a restore', () => {
    const storage = memoryStorage();
    const puzzle = new Array(81).fill(0) as never;
    (puzzle as unknown as number[])[5] = 4;
    let state = createGameState(puzzle);
    state = setValue(state, 6, 7);

    save(state, storage);
    const restored = load(storage).state!;

    assert.deepEqual(restored.givens, [5], 'the givens were lost');
    assert.equal(getValue(restored, 5), 4);
    assert.equal(getValue(restored, 6), 7, 'the player move was lost');
    // The player move must still be editable, and the given must not be.
    assert.equal(setValue(restored, 6, 8).grid[6], 8, 'the player move became read-only');
    assert.equal(setValue(restored, 5, 9).grid[5], 4, 'the given became editable');
  });

  test('the history is not persisted', () => {
    const storage = memoryStorage();
    const state = setValue(emptyBoard(), 0, 5 as Cell);
    save(state, storage);
    const restored = load(storage).state!;
    assert.equal(restored.history.entries.length, 0, 'the history was persisted');
  });

  test('the notes are persisted', () => {
    const storage = memoryStorage();
    const state = { ...emptyBoard(), notes: { 4: 0b101010101 } };
    save(state, storage);
    const restored = load(storage).state!;
    assert.deepEqual(restored.notes, { 4: 0b101010101 });
  });

  test('a future schema version is rejected without throwing', () => {
    const result = deserialize({ schemaVersion: 99, grid: new Array(81).fill(0) });
    assert.equal(result.state, null);
    assert.equal(result.recovered, true);
  });

  test('a corrupt payload is rejected without throwing', () => {
    for (const payload of ['not json', '', '[]', 'null', '{"schemaVersion":1}']) {
      const result = deserialize(payload);
      assert.equal(result.state, null, `payload ${payload} was accepted`);
      assert.equal(result.recovered, true);
    }
  });

  test('a payload with a malformed grid is rejected', () => {
    const result = deserialize({ schemaVersion: 1, grid: new Array(10).fill(0) });
    assert.equal(result.state, null);
    assert.equal(result.recovered, true);
  });

  test('a version 0 payload is migrated', () => {
    const board = new Array(81).fill(0);
    board[0] = 5;
    const result = deserialize({ version: 0, board, elapsed: 1000 });
    assert.equal(result.recovered, false);
    assert.ok(result.state);
    assert.deepEqual(result.state!.givens, [0], 'the old format had no givens: filled cells were clues');
    assert.equal(result.state!.grid[0], 5);
  });

  test('a restored game is always paused', () => {
    const storage = memoryStorage();
    const running = { ...setValue(emptyBoard(), 0, 5 as Cell), paused: false, elapsedMs: 9000 };
    save(running, storage);
    const restored = load(storage).state!;
    assert.equal(restored.paused, true, 'the restore must not resume a clock by itself');
    assert.equal(restored.elapsedMs, 9000, 'the effective time must survive');
  });

  test('a given without a value is not kept as a given', () => {
    // A corrupt payload claiming index 3 as a given while the cell is empty
    // would make the cell unwritable and empty at the same time.
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    const result = deserialize({ schemaVersion: 1, grid, givens: [0, 3] });
    assert.deepEqual(result.state!.givens, [0]);
  });

  test('notes outside the 9-bit range are dropped', () => {
    const grid = new Array(81).fill(0);
    const result = deserialize({
      schemaVersion: 1,
      grid,
      givens: [],
      notes: { 0: 511, 1: 9999, 2: -1, 90: 3 },
    });
    assert.deepEqual(result.state!.notes, { 0: 511 });
  });

  test('clearing the saved game removes it', () => {
    const storage = memoryStorage();
    save(emptyBoard(), storage);
    assert.notEqual(storage.getItem(GAME_KEY), null);
    clearSaved(storage);
    assert.equal(storage.getItem(GAME_KEY), null);
    assert.equal(load(storage).state, null);
  });

  test('a storage that throws does not break the game', () => {
    const broken: Storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    assert.equal(save(emptyBoard(), broken), false);
    assert.equal(load(broken).state, null);
    assert.doesNotThrow(() => clearSaved(broken));
  });

  test('the serialized payload is plain JSON', () => {
    const state = setValue(emptyBoard(), 0, 5 as Cell);
    const payload = serialize(state);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.grid.length, 81);
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
    assert.equal(typeof toStorageString(state), 'string');
  });
});
