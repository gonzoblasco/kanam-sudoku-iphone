import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { legalDigits, legalDigitsByCell, autoNoteMasks } from '../src/core/candidates.ts';
import { maskOf, hasDigit } from '../src/core/mask.ts';
import { initCandidates } from '../src/core/analysis.ts';
import type { Grid } from '../src/core/grid.ts';
import {
  clearNotes,
  createGameState,
  getNote,
  setAutoNotes,
  setNote,
  toggleNote,
} from '../src/state/state.ts';

const emptyBoard = (): Grid => new Array(81).fill(0) as Grid;

describe('Legal digits', () => {
  test('a digit already in the row is not legal', () => {
    const grid = emptyBoard();
    grid[0] = 5; // row 0, column 0
    const legal = legalDigits(grid, 1);
    assert.ok(!legal.includes(5), 'the 5 of the row must not be legal');
    assert.ok(legal.includes(3), 'an unused digit must be legal');
  });

  test('a digit already in the column is not legal', () => {
    const grid = emptyBoard();
    grid[0] = 7; // column 0
    const legal = legalDigits(grid, 9); // row 1, column 0
    assert.ok(!legal.includes(7), 'the 7 of the column must not be legal');
  });

  test('a digit already in the block is not legal', () => {
    const grid = emptyBoard();
    grid[0] = 4; // block 0
    const legal = legalDigits(grid, 10); // row 1, column 1, same block
    assert.ok(!legal.includes(4), 'the 4 of the block must not be legal');
  });

  test('the legal digits of a cell match the engine candidates', () => {
    const grid = emptyBoard();
    grid[0] = 5;
    grid[9] = 6;
    grid[18] = 7;
    const candidates = initCandidates(grid);
    for (const index of [1, 2, 40, 80]) {
      const expected = [];
      for (let d = 1; d <= 9; d++) {
        if (hasDigit(candidates[index], d)) expected.push(d);
      }
      assert.deepEqual(legalDigits(grid, index), expected);
    }
  });

  test('a filled cell has no legal digits', () => {
    const grid = emptyBoard();
    grid[0] = 5;
    assert.deepEqual(legalDigits(grid, 0), []);
  });

  test('an out-of-range cell has no legal digits', () => {
    assert.deepEqual(legalDigits(emptyBoard(), -1), []);
    assert.deepEqual(legalDigits(emptyBoard(), 81), []);
  });

  test('the legal digits by cell skip the filled cells', () => {
    const grid = emptyBoard();
    grid[0] = 5;
    const byCell = legalDigitsByCell(grid);
    assert.equal(byCell[0], undefined, 'a filled cell must not be in the map');
    assert.ok(byCell[1], 'an empty cell must be in the map');
    assert.equal(Object.keys(byCell).length, 80);
  });
});

describe('Automatic notes', () => {
  test('every empty cell gets a mask of its legal digits', () => {
    const grid = emptyBoard();
    grid[0] = 5;
    const masks = autoNoteMasks(grid);
    assert.equal(Object.keys(masks).length, 80, 'the filled cell must not be annotated');
    for (const [index, mask] of Object.entries(masks)) {
      const cell = Number(index);
      const legal = legalDigits(grid, cell);
      for (let d = 1; d <= 9; d++) {
        assert.equal(
          hasDigit(mask, d),
          legal.includes(d),
          `cell ${cell}: the mask and the legal digits disagree on ${d}`,
        );
      }
    }
  });

  test('the automatic notes use the engine mask convention', () => {
    const grid = emptyBoard();
    grid[0] = 5;
    const masks = autoNoteMasks(grid);
    const mask = masks[1];
    assert.equal(mask, maskOf(...legalDigits(grid, 1)));
  });

  test('a full board produces no notes', () => {
    const grid = emptyBoard();
    for (let i = 0; i < 81; i++) grid[i] = 1;
    assert.deepEqual(autoNoteMasks(grid), {});
  });
});

describe('Notes in the game state', () => {
  test('a note is written and read back', () => {
    const state = createGameState(emptyBoard());
    const next = setNote(state, 4, maskOf(2, 5, 7));
    assert.equal(getNote(next, 4), maskOf(2, 5, 7));
    assert.equal(getNote(next, 5), 0, 'an untouched cell has no notes');
  });

  test('a note does not enter the undo history', () => {
    const state = createGameState(emptyBoard());
    const withNote = setNote(state, 4, maskOf(5));
    assert.equal(
      withNote.history.entries.length,
      0,
      'a note is not a board mutation and must not be undoable',
    );
    const toggled = toggleNote(withNote, 4, 5);
    assert.equal(toggled.history.entries.length, 0);
  });

  test('toggling a digit adds and removes it', () => {
    const state = createGameState(emptyBoard());
    const added = toggleNote(state, 4, 5);
    assert.ok(hasDigit(getNote(added, 4), 5));
    const removed = toggleNote(added, 4, 5);
    assert.ok(!hasDigit(getNote(removed, 4), 5));
    assert.equal(getNote(removed, 4), 0);
  });

  test('toggling is independent of the sequence of presses', () => {
    const state = createGameState(emptyBoard());
    const once = toggleNote(state, 4, 5);
    const twice = toggleNote(once, 4, 5);
    const thrice = toggleNote(twice, 4, 5);
    assert.equal(getNote(thrice, 4), getNote(once, 4));
  });

  test('a note does not change the value of the cell', () => {
    const state = createGameState(emptyBoard());
    const next = setNote(state, 4, maskOf(5));
    assert.equal(next.grid[4], 0, 'a note must not write a value');
  });

  test('the automatic notes replace the previous ones', () => {
    const state = createGameState(emptyBoard());
    const grid = emptyBoard();
    grid[0] = 5; // cell 1 shares the row, so a 5 there is illegal
    const withManual = setNote(state, 1, maskOf(5, 9));
    const withAuto = setAutoNotes(withManual, grid);
    assert.equal(
      hasDigit(getNote(withAuto, 1), 5),
      false,
      'a recalculation must drop the notes the engine does not consider legal',
    );
    assert.equal(
      hasDigit(getNote(withAuto, 1), 9),
      true,
      'a legal note must survive the recalculation',
    );
  });

  test('clearing the notes empties the map', () => {
    const state = setNote(createGameState(emptyBoard()), 4, maskOf(5));
    const cleared = clearNotes(state);
    assert.deepEqual(cleared.notes, {});
  });

  test('an out-of-range note is rejected', () => {
    const state = createGameState(emptyBoard());
    assert.throws(() => setNote(state, 81, 1));
    assert.throws(() => setNote(state, -1, 1));
    assert.throws(() => setNote(state, 0, 0x1ff + 1));
    assert.throws(() => toggleNote(state, 0, 10));
    assert.throws(() => toggleNote(state, 0, 0));
  });
});
