/**
 * E2E: the on-screen keypad and the victory screen (SPEC-004).
 *
 * The suite plays a real game to the end: it reads the puzzle from the
 * running app, solves it, and writes every digit through the keypad. A victory
 * screen that only ever appears in a mock is not a victory screen.
 */
import { launchBrowser } from './_playwright.mjs';
import { resolve } from 'node:path';
import { Checks, serveDirectory } from './_harness.mjs';
import { solve } from '../src/core/solver.ts';

const DIST = resolve(process.cwd(), 'dist');
const checks = new Checks();

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

const server = await serveDirectory(DIST);
await page.goto(`${server.base}/index.html`);
await page.waitForSelector('#menu');
await page.click('button:has-text("Fácil")');
await page.waitForSelector('#board:not(.hidden)');
await page.waitForSelector('.cell');

// --- 1. The keypad has 9 digits and one erase key ---------------------------
const keypad = await page.evaluate(() => {
  const container = document.getElementById('keypad');
  const buttons = [...container.querySelectorAll('button')];
  return {
    count: buttons.length,
    digits: buttons.filter((b) => /^\d$/.test(b.textContent ?? '')).length,
    erase: buttons.filter((b) => b.getAttribute('aria-label') === 'Borrar').length,
    role: container.getAttribute('role'),
    label: container.getAttribute('aria-label'),
    sizes: buttons.map((b) => {
      const r = b.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  };
});
checks.equal('the keypad has 10 buttons', keypad.count, 10);
checks.equal('the keypad has 9 digit keys', keypad.digits, 9);
checks.equal('the keypad has one erase key', keypad.erase, 1);
checks.equal('the keypad is a named group', keypad.role, 'group');
checks.ok('the keypad group has a name', Boolean(keypad.label));
const smallestKey = keypad.sizes.reduce(
  (acc, s) => ({ w: Math.min(acc.w, s.w), h: Math.min(acc.h, s.h) }),
  { w: Infinity, h: Infinity },
);
checks.atLeast('every key is at least 44px wide', smallestKey.w, 44, 'px');
checks.atLeast('every key is at least 44px tall', smallestKey.h, 44, 'px');

// --- 2. The keypad sits below the board, without overlapping -----------------
const layout = await page.evaluate(() => {
  const board = document.getElementById('board').getBoundingClientRect();
  const keypad = document.getElementById('keypad').getBoundingClientRect();
  return { boardBottom: board.bottom, keypadTop: keypad.top, keypadBottom: keypad.bottom };
});
checks.ok(
  'the keypad is below the board',
  layout.keypadTop >= layout.boardBottom - 1,
  `board ends at ${layout.boardBottom}, keypad starts at ${layout.keypadTop}`,
);
checks.atMost('the keypad fits the viewport', layout.keypadBottom, 844, 'px');

// --- 2b. A key with no cell selected does nothing ---------------------------
// A fresh game has no selection, which is the only state where this criterion
// can be observed (the UI has no deselect gesture).
const beforeKeys = await page.evaluate(() =>
  [...document.querySelectorAll('.cell')].map((c) => c.textContent ?? '').join('|'),
);
const selectedBefore = await page.evaluate(
  () => document.querySelectorAll('[data-selected="true"]').length,
);
await page.click('button[data-digit="5"]');
const afterKeys = await page.evaluate(() =>
  [...document.querySelectorAll('.cell')].map((c) => c.textContent ?? '').join('|'),
);
checks.equal('a fresh game has no selection', selectedBefore, 0);
checks.equal('a key with no selection does not change the board', afterKeys, beforeKeys);

// --- 3. Writing a digit ------------------------------------------------------
// Pick an EMPTY cell: the puzzle is generated with a fresh seed on every run,
// so a hard-coded index may be a given, and writing on a given is a no-op.
const emptyIndex = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('.cell')].find(
    (c) => c.dataset.given !== 'true',
  );
  return cell ? Number(cell.dataset.index) : null;
});
checks.ok('the board has an empty cell to play', emptyIndex !== null, String(emptyIndex));
await page.click(`.cell[data-index="${emptyIndex}"]`);
const liveBefore = await page.textContent('#live');
await page.click('button[data-digit="7"]');
const written = await page.evaluate(
  (index) => {
    const cell = document.querySelector(`.cell[data-index="${index}"]`);
    return { value: cell.textContent, selected: cell.dataset.selected };
  },
  emptyIndex,
);
checks.equal('the digit is written', written.value, '7');
checks.equal('the selection stays on the cell', written.selected, 'true');
const liveAfter = await page.textContent('#live');
checks.ok('the live region announces the value', liveAfter !== liveBefore, `live: "${liveAfter}"`);

// --- 4. The erase key clears the cell ----------------------------------------
await page.click('button[data-digit="0"]');
const cleared = await page.evaluate(
  (index) => document.querySelector(`.cell[data-index="${index}"]`).textContent,
  emptyIndex,
);
checks.equal('the erase key clears the cell', cleared, '');

// --- 5. A given is not written over ------------------------------------------
const givenIndex = await page.evaluate(() => {
  const given = document.querySelector('.cell[data-given="true"]');
  return given ? given.dataset.index : null;
});
if (givenIndex !== null) {
  // The value BEFORE the write: the given may legitimately be a 3, so the
  // check has to compare against what was there, not against a fixed digit.
  const givenBefore = await page.evaluate(
    (index) => document.querySelector(`.cell[data-index="${index}"]`).textContent,
    givenIndex,
  );
  const digitToWrite = givenBefore === '3' ? '4' : '3';
  await page.click(`.cell[data-index="${givenIndex}"]`);
  await page.click(`button[data-digit="${digitToWrite}"]`);
  const givenValue = await page.evaluate(
    (index) => document.querySelector(`.cell[data-index="${index}"]`).textContent,
    givenIndex,
  );
  const givenStillGiven = await page.evaluate(
    (index) => document.querySelector(`.cell[data-index="${index}"]`).dataset.given,
    givenIndex,
  );
  checks.equal('the given still holds its value', givenStillGiven, 'true');
  checks.equal('the given was not overwritten', givenValue, givenBefore);
}

// --- 6. No scroll while playing ---------------------------------------------
const scrollY = await page.evaluate(() => window.scrollY);
checks.equal('playing does not scroll the page', scrollY, 0);

// --- 7. Play the game to the end --------------------------------------------
// The board is read from the running app, solved, and written with the keypad.
const puzzle = await page.evaluate(() =>
  [...document.querySelectorAll('.cell')].map((c) => {
    if (c.dataset.given === 'true') return Number(c.textContent);
    return 0;
  }),
);
const solution = solve(puzzle);
checks.equal('the board on screen is solvable', solution.status, 'solved');

if (solution.solution) {
  const answer = [...solution.solution];
  for (let index = 0; index < 81; index++) {
    if (puzzle[index] !== 0) continue;
    await page.click(`.cell[data-index="${index}"]`);
    await page.click(`button[data-digit="${answer[index]}"]`);
  }
  const victoryVisible = await page.evaluate(() => {
    const el = document.getElementById('victory');
    return el && !el.classList.contains('hidden');
  });
  checks.ok('the victory screen appears', victoryVisible);
  const victoryText = await page.textContent('#victory');
  checks.ok('the victory screen shows the time', /Tiempo/.test(victoryText ?? ''));
  const again = await page.$('#victory button[data-action="play-again"]');
  const other = await page.$('#victory button[data-action="choose-level"]');
  checks.ok('the victory screen offers "Jugar de nuevo"', again !== null);
  checks.ok('the victory screen offers "Elegir otro nivel"', other !== null);

  // "Jugar de nuevo" starts a new game of the same level.
  if (again) {
    await again.click();
    await page.waitForSelector('#board:not(.hidden)');
    const fresh = await page.evaluate(() => ({
      blanks: [...document.querySelectorAll('.cell')].filter(
        (c) => c.dataset.given !== 'true' && !c.textContent,
      ).length,
      victoryHidden: document.getElementById('victory').classList.contains('hidden'),
      cells: document.querySelectorAll('.cell').length,
    }));
    checks.atLeast('playing again starts a fresh board', fresh.blanks, 20, 'cells');
    checks.equal('playing again draws a full board', fresh.cells, 81);
    checks.ok('the victory screen is gone after playing again', fresh.victoryHidden);
  }
}

// --- 8. A FULL board with a conflict is not a victory -----------------------
// The only case where "complete" is not "won". It runs in its own context so it
// cannot disturb the game above.
{
  const conflictContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const conflictPage = await conflictContext.newPage();
  await conflictPage.goto(`${server.base}/index.html`);
  await conflictPage.click('button:has-text("Fácil")');
  await conflictPage.waitForSelector('.cell');
  const empties = await conflictPage.evaluate(() =>
    [...document.querySelectorAll('.cell')]
      .filter((c) => c.dataset.given !== 'true')
      .map((c) => Number(c.dataset.index)),
  );
  // Fill every empty cell with 1: the board is full and full of conflicts.
  for (const index of empties) {
    await conflictPage.click(`.cell[data-index="${index}"]`);
    await conflictPage.click('button[data-digit="1"]');
  }
  const conflicting = await conflictPage.evaluate(() => ({
    filled: [...document.querySelectorAll('.cell')].every((c) => c.textContent !== ''),
    victoryHidden: document.getElementById('victory').classList.contains('hidden'),
    conflicts: document.querySelectorAll('[data-conflict="true"]').length,
    stillPlaying: !document.getElementById('board').classList.contains('hidden'),
  }));
  checks.equal('the conflicting board is complete', conflicting.filled, true);
  checks.atLeast('the conflicts are marked', conflicting.conflicts, 2, 'cells');
  checks.ok('a complete but conflicting board does not win', conflicting.victoryHidden);
  checks.ok('the player can keep correcting a conflicting board', conflicting.stillPlaying);
  await conflictContext.close();
}

// --- 9. No console errors ---------------------------------------------------
checks.equal('no console errors', consoleErrors.length, 0, consoleErrors.join(' | '));

await browser.close();
server.close();
checks.finish('e2e.keypad');
