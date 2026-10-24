import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle } from '../src/core/generator.ts';
import { countSolutions, solve } from '../src/core/solver.ts';
import { ratePuzzle, tierToDifficulty, DIFFICULTY_MAX_TIER } from '../src/core/rater.ts';
import { TECHNIQUES } from '../src/core/techniques.ts';
import type { Difficulty } from '../src/core/rater.ts';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const LEVELS: Difficulty[] = ['facil', 'medio', 'dificil'];

describe('Generator', () => {
  for (const level of LEVELS) {
    test(`every ${level} puzzle has a unique solution`, () => {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const result = generatePuzzle(level, { seed, maxAttempts: 40 });
        assert.equal(
          countSolutions(result.puzzle.grid, 2),
          1,
          `seed ${seed} (${level}) must have exactly one solution`,
        );
      }
    });

    test(`every ${level} puzzle is actually a puzzle`, () => {
      for (const seed of [1, 2, 3]) {
        const result = generatePuzzle(level, { seed, maxAttempts: 40 });
        const blanks = result.puzzle.grid.filter((v) => v === 0).length;
        assert.ok(
          blanks >= 20,
          `seed ${seed} (${level}) has only ${blanks} blanks: that is a filled board, not a puzzle`,
        );
      }
    });

    test(`the measured level of a ${level} puzzle is ${level}`, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const result = generatePuzzle(level, { seed, maxAttempts: 40 });
        assert.equal(
          result.rating.difficulty,
          level,
          `seed ${seed}: measured "${result.rating.difficulty}" but asked for "${level}"`,
        );
        assert.equal(result.matched, true, `seed ${seed} should have matched`);
        assert.equal(result.rating.solved, true, `seed ${seed} should be solvable`);
      }
    });
  }

  test('the same seed produces the same puzzle', () => {
    for (const level of LEVELS) {
      const a = generatePuzzle(level, { seed: 99, maxAttempts: 40 });
      const b = generatePuzzle(level, { seed: 99, maxAttempts: 40 });
      assert.deepEqual([...a.puzzle.grid], [...b.puzzle.grid], `${level} is not deterministic`);
      assert.deepEqual(a.rating, b.rating);
    }
  });

  test('different seeds produce different puzzles', () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = generatePuzzle('medio', { seed, maxAttempts: 40 });
      seen.add(result.puzzle.grid.join(''));
    }
    assert.equal(seen.size, 5, 'five seeds produced fewer than five distinct puzzles');
  });

  test('the generator terminates and stays fast', () => {
    const started = Date.now();
    for (const level of LEVELS) {
      generatePuzzle(level, { seed: 7, maxAttempts: 40 });
    }
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 20000, `generating three puzzles took ${elapsed}ms`);
  });

  test('an exhausted attempt budget reports matched:false with the real level', () => {
    const result = generatePuzzle('dificil', { seed: 3, maxAttempts: 1 });
    assert.equal(result.matched, false, 'one attempt cannot be claimed as a match');
    // The rating has to be the level actually measured, not the level asked
    // for. Measuring a single candidate WITH the cap of "dificil" would label
    // anything the cap cannot finish as "dificil", which is the lie RF-5 bans.
    const measuredWithoutCap = ratePuzzle(result.puzzle, 9);
    assert.equal(result.rating.difficulty, measuredWithoutCap.difficulty);
    assert.equal(result.rating.maxTier, measuredWithoutCap.maxTier);
  });

  test('an unknown difficulty is rejected instead of defaulting', () => {
    assert.throws(
      () => generatePuzzle('imposible' as never, { seed: 1 }),
      /unknown difficulty/,
      'an unknown level must not silently become "facil"',
    );
  });

  test('the puzzle carries its own verified solution', () => {
    const result = generatePuzzle('medio', { seed: 11, maxAttempts: 40 });
    assert.equal(result.puzzle.solution.length, 81);
    assert.ok(result.puzzle.solution.every((v) => v !== 0), 'the solution must be complete');
    // The clues agree with the solution, cell by cell.
    for (let i = 0; i < 81; i++) {
      if (result.puzzle.grid[i] !== 0) {
        assert.equal(result.puzzle.solution[i], result.puzzle.grid[i], `cell ${i} disagrees`);
      }
    }
    assert.equal(countSolutions(result.puzzle.grid, 2), 1);
    assert.equal(result.puzzle.seed, 11);
  });

  test('an invalid attempt budget is rejected', () => {
    assert.throws(() => generatePuzzle('facil', { seed: 1, maxAttempts: 0 }));
    assert.throws(() => generatePuzzle('facil', { seed: 1, maxAttempts: -3 }));
  });

  test('a missing seed is rejected instead of using unseeded randomness', () => {
    assert.throws(
      () => generatePuzzle('facil', {}),
      /seed is required/,
      'the generator must not pick its own randomness',
    );
  });
});

describe('Rater', () => {
  test('the level is derived from the tier, and only from the tier', () => {
    assert.equal(tierToDifficulty(1), 'facil');
    assert.equal(tierToDifficulty(2), 'medio');
    assert.equal(tierToDifficulty(3), 'dificil');
    assert.equal(tierToDifficulty(4), 'dificil');
  });

  test('each level has a tier cap that is consistent with the mapping', () => {
    for (const level of LEVELS) {
      const cap = DIFFICULTY_MAX_TIER[level];
      assert.equal(tierToDifficulty(cap), level, `${level} cap maps to another level`);
    }
  });

  test('rating a solved board reports no advanced technique', () => {
    const solution = [
      5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7,
      6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8,
      4, 2, 8, 7, 4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
    ];
    const rating = ratePuzzle(solution as never);
    assert.equal(rating.solved, true);
    assert.equal(rating.maxTier, 0, 'a solved board needs no technique');
  });

  test('the rater never invents a tier it did not use', () => {
    for (const level of LEVELS) {
      const result = generatePuzzle(level, { seed: 5, maxAttempts: 40 });
      const used = Object.keys(result.rating.techniqueCounts);
      for (const technique of used) {
        const entry = TECHNIQUES.find((t) => t.id === technique);
        assert.ok(entry, `unknown technique in the rating: ${technique}`);
        assert.ok(
          entry.tier <= result.rating.maxTier,
          `${technique} (tier ${entry.tier}) exceeds maxTier ${result.rating.maxTier}`,
        );
      }
    }
  });

  test('rating never exceeds the allowed tier of the requested level', () => {
    for (const level of LEVELS) {
      const result = generatePuzzle(level, { seed: 5, maxAttempts: 40 });
      assert.ok(
        result.rating.maxTier <= DIFFICULTY_MAX_TIER[level],
        `${level} used tier ${result.rating.maxTier}, above its cap`,
      );
    }
  });
});

describe('Solver', () => {
  const solution = [
    5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7, 6, 1,
    4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7,
    4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
  ];

  test('solves a known grid', () => {
    const result = solve(solution as never);
    assert.equal(result.status, 'solved');
    assert.deepEqual([...(result.solution as number[])], solution);
  });

  test('solves a grid with a hole', () => {
    const withHole = [...solution];
    withHole[0] = 0;
    const result = solve(withHole as never);
    assert.equal(result.status, 'solved');
    assert.equal((result.solution as number[])[0], 5);
  });

  test('counts more than one solution on an empty grid and stops at the cap', () => {
    const empty = new Array(81).fill(0);
    assert.equal(countSolutions(empty as never, 2), 2, 'the cap must stop the count');
  });

  test('counts exactly one solution on a valid grid', () => {
    assert.equal(countSolutions(solution as never, 2), 1);
  });

  test('rejects a grid that already breaks a rule', () => {
    const broken = [...solution];
    broken[1] = broken[0];
    assert.equal(solve(broken as never).status, 'invalid');
  });
});

describe('Mask convention', () => {
  test('no left shift builds a mask outside src/core/mask.ts', () => {
    const root = resolve(import.meta.dirname, '..');
    let output = '';
    try {
      output = execSync('grep -R "1 <<" -n src --exclude=mask.ts', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      // grep exits 1 when there is no match, which is the success case here.
      if (e.status === 1) output = e.stdout ?? '';
      else throw err;
    }
    assert.equal(output.trim(), '', `a mask is built outside mask.ts:\n${output}`);
  });
});
