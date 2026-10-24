import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer } from '../src/state/timer.ts';
import {
  conflictCells,
  conflictedUnits,
  findConflicts,
  isComplete,
  isSolved,
} from '../src/core/validator.ts';
import type { Grid } from '../src/core/grid.ts';

describe('Timer', () => {
  test('time accumulates while running', () => {
    let now = 1000;
    const timer = createTimer(() => now);
    timer.start();
    now = 2500;
    assert.equal(timer.elapsedMs(), 1500);
  });

  test('a pause does not add time', () => {
    let now = 0;
    const timer = createTimer(() => now);
    timer.start();
    now = 1000;
    timer.pause();
    now = 60000; // a minute "passed" while paused
    assert.equal(timer.elapsedMs(), 1000, 'the paused time was counted');
  });

  test('resuming continues from where it stopped', () => {
    let now = 0;
    const timer = createTimer(() => now);
    timer.start();
    now = 1000;
    timer.pause();
    now = 5000;
    timer.resume();
    now = 6000;
    assert.equal(timer.elapsedMs(), 2000, 'the resumed time is wrong');
  });

  test('a clock that goes backwards never decreases the elapsed time', () => {
    let now = 1000;
    const timer = createTimer(() => now);
    timer.start();
    now = 1500;
    const after = timer.elapsedMs();
    now = 1200; // the clock jumps back
    assert.equal(timer.elapsedMs(), after, 'the elapsed time went backwards');
  });

  test('stopping freezes the time', () => {
    let now = 0;
    const timer = createTimer(() => now);
    timer.start();
    now = 1000;
    timer.stop();
    now = 9000;
    assert.equal(timer.elapsedMs(), 1000);
  });
});

describe('Validator', () => {
  /** A grid with a repeated digit in the first row. */
  const withRowConflict = (): Grid => {
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    grid[1] = 5;
    return grid as Grid;
  };

  test('a repeated digit in a row is a conflict', () => {
    const cells = conflictCells(withRowConflict());
    assert.equal(cells.length, 2, 'both cells of the conflict must be reported');
    assert.ok(cells.includes(0) && cells.includes(1));
  });

  test('a repeated digit in a column is a conflict', () => {
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    grid[9] = 5;
    const cells = conflictCells(grid as Grid);
    assert.equal(cells.length, 2);
  });

  test('a repeated digit in a block is a conflict', () => {
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    grid[10] = 5;
    const cells = conflictCells(grid as Grid);
    assert.equal(cells.length, 2);
  });

  test('three equal digits in a unit are ONE conflict with three cells', () => {
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    grid[1] = 5;
    grid[2] = 5;
    const conflicts = findConflicts(grid as Grid);
    const rows = conflicts.filter((c) => c.kind === 'row');
    assert.equal(rows.length, 1, 'the three cells must produce a single conflict');
    assert.equal(rows[0].cells.length, 3, 'the conflict must carry the three cells');
    assert.equal(rows[0].value, 5);
    assert.equal(conflictCells(grid as Grid).length, 3);
  });

  test('the same digit in units that do not meet is not a conflict', () => {
    const grid = new Array(81).fill(0);
    grid[0] = 5; // row 0, column 0, block 0
    grid[40] = 5; // row 4, column 4, block 4
    assert.equal(conflictCells(grid as Grid).length, 0);
  });

  test('the conflicted units are reported', () => {
    // Cells 0 and 1 share the first row AND the first block, so two units are
    // in conflict: the same pair of cells breaks the rule in both.
    const units = conflictedUnits(withRowConflict());
    assert.equal(units.length, 2);
    assert.deepEqual(
      units,
      [
        { kind: 'row', index: 0 },
        { kind: 'block', index: 0 },
      ],
      'both the row and the block must be reported',
    );
  });

  test('complete and solved are different conditions', () => {
    const grid = new Array(81).fill(1);
    assert.equal(isComplete(grid as Grid), true, 'the board is full');
    assert.equal(isSolved(grid as Grid), false, 'a full board with conflicts is not solved');
  });

  test('an empty board is neither complete nor solved', () => {
    const grid = new Array(81).fill(0);
    assert.equal(isComplete(grid as Grid), false);
    assert.equal(isSolved(grid as Grid), false);
  });

  test('a valid full grid is solved', () => {
    const grid = [
      5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7,
      6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8,
      4, 2, 8, 7, 4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
    ];
    assert.equal(isComplete(grid as Grid), true);
    assert.equal(isSolved(grid as Grid), true);
  });

  test('the validation does not mutate the grid', () => {
    const grid = withRowConflict();
    const before = JSON.stringify(grid);
    conflictCells(grid);
    conflictedUnits(grid);
    findConflicts(grid);
    isComplete(grid);
    isSolved(grid);
    assert.equal(JSON.stringify(grid), before, 'the validation mutated its input');
  });

  test('a grid of the wrong length is an explicit error', () => {
    // An "undefined means no conflict" read would silently report a truncated
    // grid as conflict-free.
    assert.throws(() => findConflicts(new Array(80).fill(0) as Grid));
    assert.throws(() => isSolved(new Array(80).fill(1) as Grid));
  });

  test('values outside 1..9 are ignored, not reported as conflicts', () => {
    const grid = new Array(81).fill(0);
    grid[0] = 5;
    grid[1] = 5;
    // A malformed value must not become a "digit" and must not hide the real
    // conflict either.
    grid[2] = 12;
    const conflicts = findConflicts(grid as Grid);
    // Cells 0 and 1 share the first row and the first block: two units, one
    // conflict each, and none of them about the malformed 12.
    assert.equal(conflicts.length, 2);
    assert.ok(conflicts.every((c) => c.value === 5));
    assert.equal(isComplete(new Array(81).fill(12) as Grid), false);
  });
});
