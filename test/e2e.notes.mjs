/**
 * E2E: the notes system (SPEC-007).
 *
 * The suite checks the notes mode, the pencil-mark grid, the automatic
 * candidates and the persistence of the notes, in a real browser at an iPhone
 * viewport.
 */
import { launchBrowser } from './_playwright.mjs';
import { resolve } from 'node:path';
import { Checks, serveDirectory } from './_harness.mjs';

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

/**
 * Put the app in notes mode (or out of it) and assert the state.
 *
 * The suite states the mode it needs instead of counting button presses: a
 * sequence of clicks that has to stay balanced is a sequence that breaks the
 * day someone adds a step.
 */
const setNotesMode = async (on) => {
  const current = await page.getAttribute('button[data-action="notes-mode"]', 'aria-pressed');
  if ((current === 'true') !== on) {
    await page.click('button[data-action="notes-mode"]');
  }
  const now = await page.getAttribute('button[data-action="notes-mode"]', 'aria-pressed');
  checks.equal(`the notes mode is ${on ? 'on' : 'off'}`, now, String(on));
};
await page.goto(`${server.base}/index.html`);
await page.waitForSelector('#menu');
await page.click('button:has-text("Fácil")');
await page.waitForSelector('.cell');

// --- 1. The notes toolbar exists --------------------------------------------
const toolbar = await page.evaluate(() => {
  const container = document.getElementById('notes-toolbar');
  const buttons = [...container.querySelectorAll('button')];
  return {
    visible: container && !container.classList.contains('hidden'),
    count: buttons.length,
    actions: buttons.map((b) => b.dataset.action),
    labels: buttons.map((b) => b.getAttribute('aria-label')),
  };
});
checks.ok('the notes toolbar is visible', toolbar.visible);
checks.equal('the toolbar has three controls', toolbar.count, 3);
checks.ok('the toolbar has a notes mode button', toolbar.actions.includes('notes-mode'));
checks.ok('the toolbar has an auto button', toolbar.actions.includes('auto-notes'));
checks.ok('the toolbar has a clear button', toolbar.actions.includes('clear-notes'));
checks.ok(
  'the auto button names its purpose',
  (toolbar.labels ?? []).some((l) => l && l.includes('candidatos')),
  JSON.stringify(toolbar.labels),
);
checks.ok(
  'the clear button names its purpose',
  (toolbar.labels ?? []).some((l) => l && l.includes('anotaciones')),
  JSON.stringify(toolbar.labels),
);

// --- 2. The notes mode toggles ----------------------------------------------
const pressedBefore = await page.getAttribute('button[data-action="notes-mode"]', 'aria-pressed');
checks.equal('the notes mode starts off', pressedBefore, 'false');

await setNotesMode(true);
await setNotesMode(false);

// --- 3. An empty cell to work on --------------------------------------------
const emptyIndex = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('.cell')].find(
    (c) => c.dataset.given !== 'true',
  );
  return cell ? cell.dataset.index : null;
});
checks.ok('the board has an empty cell', emptyIndex !== null);

// --- 4. In notes mode a digit marks a candidate, not a value ----------------
await setNotesMode(true);
await page.click(`.cell[data-index="${emptyIndex}"]`);
await page.click('button[data-digit="5"]');

const marked = await page.evaluate((index) => {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  return {
    value: cell.querySelector('.cell-value')?.textContent ?? '',
    slots: [...cell.querySelectorAll('.note-slot')].map((s) => s.textContent),
    positions: [...cell.querySelectorAll('.note-slot')].map((s) => s.dataset.position),
    hidden: cell.querySelector('.note-grid')?.getAttribute('aria-hidden'),
  };
}, emptyIndex);
checks.equal(
  'the cell does not hold the digit as a value',
  marked.value,
  '',
  'notes mode must not write a value',
);
checks.equal('the note grid has nine slots', marked.slots.length, 9);
checks.equal('the digit 5 sits in the fifth slot', marked.slots[4], '5');
checks.equal('the other slots are empty', marked.slots.filter((t) => t !== '').length, 1);
checks.equal('the note grid is hidden from the screen reader', marked.hidden, 'true');

// --- 5. Toggling the same digit removes it ---------------------------------
await page.click('button[data-digit="5"]');
const removed = await page.evaluate(
  (index) => document.querySelectorAll(`.cell[data-index="${index}"] .note-slot`).length,
  emptyIndex,
);
checks.equal('toggling the digit again removes the note', removed, 0);

// --- 6. A filled cell hides its notes ---------------------------------------
// A note on the cell first, then a value on top of it.
await setNotesMode(true);
await page.click(`.cell[data-index="${emptyIndex}"]`);
await page.click('button[data-digit="5"]');
await setNotesMode(false);
// Now write a value on the same cell: the notes must disappear.
await page.click(`.cell[data-index="${emptyIndex}"]`);
await page.click('button[data-digit="3"]');
const filled = await page.evaluate((index) => {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  return {
    value: cell.querySelector('.cell-value')?.textContent ?? '',
    slots: cell.querySelectorAll('.note-slot').length,
  };
}, emptyIndex);
checks.equal('the cell holds the value', filled.value, '3');
checks.equal('a filled cell shows no notes', filled.slots, 0);

// --- 7. Erasing the value brings the notes back ----------------------------
await page.click('button[data-digit="0"]');
const restored = await page.evaluate((index) => {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  return {
    value: cell.querySelector('.cell-value')?.textContent ?? '',
    slots: [...cell.querySelectorAll('.note-slot')].map((s) => s.textContent),
  };
}, emptyIndex);
checks.equal('the cell is empty again', restored.value, '');
checks.equal('the note is back', restored.slots[4], '5');

// --- 8. In notes mode, erase clears the notes and not the value ------------
await setNotesMode(true);
await page.click(`.cell[data-index="${emptyIndex}"]`);
await page.click('button[data-digit="0"]');
const erased = await page.evaluate((index) => {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  return {
    slots: cell.querySelectorAll('.note-slot').length,
    value: cell.querySelector('.cell-value')?.textContent ?? '',
  };
}, emptyIndex);
checks.equal('erase in notes mode clears the notes', erased.slots, 0);
checks.equal('erase in notes mode leaves the value alone', erased.value, '');
await setNotesMode(false);

// --- 9. The automatic candidates annotate every empty cell ------------------
await page.click('button[data-action="auto-notes"]');
const auto = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.cell')];
  const empty = cells.filter((c) => c.dataset.given !== 'true');
  const withNotes = empty.filter((c) => c.querySelector('.note-grid'));
  const filledWithNotes = cells.filter(
    (c) => c.dataset.given === 'true' && c.querySelector('.note-grid'),
  );
  return {
    empty: empty.length,
    withNotes: withNotes.length,
    filledWithNotes: filledWithNotes.length,
  };
});
checks.atLeast('there are empty cells', auto.empty, 20);
checks.equal('every empty cell is annotated', auto.withNotes, auto.empty);
checks.equal('no filled cell is annotated', auto.filledWithNotes, 0);

// --- 10. The automatic notes are legal digits ------------------------------
const illegal = await page.evaluate(() => {
  // Every note must be a digit that does not appear in the row, column or
  // block of its cell.
  const grid = new Array(81).fill(0);
  for (const cell of document.querySelectorAll('.cell')) {
    grid[Number(cell.dataset.index)] =
      cell.dataset.given === 'true' ? Number(cell.textContent) : 0;
  }
  const rowOf = (i) => Math.floor(i / 9);
  const colOf = (i) => i % 9;
  const blockOf = (i) => Math.floor(i / 9 / 3) * 3 + Math.floor((i % 9) / 3);
  const problems = [];
  for (const cell of document.querySelectorAll('.cell')) {
    const index = Number(cell.dataset.index);
    if (grid[index] !== 0) continue;
    for (const slot of cell.querySelectorAll('.note-slot')) {
      if (!slot.textContent) continue;
      const digit = Number(slot.textContent);
      for (let i = 0; i < 81; i++) {
        if (grid[i] !== digit) continue;
        if (
          rowOf(i) === rowOf(index) ||
          colOf(i) === colOf(index) ||
          blockOf(i) === blockOf(index)
        ) {
          problems.push(`cell ${index} notes ${digit}, already in ${i}`);
        }
      }
    }
  }
  return problems;
});
checks.equal('every automatic note is a legal digit', illegal.length, 0, illegal.join(' | '));

// --- 11. Clear removes every note ------------------------------------------
await page.click('button[data-action="clear-notes"]');
const cleared = await page.evaluate(
  () => document.querySelectorAll('.note-grid').length,
);
checks.equal('clear removes every note', cleared, 0);

// --- 12. The notes are announced and named ---------------------------------
await setNotesMode(true);
await page.click(`.cell[data-index="${emptyIndex}"]`);
await page.click('button[data-digit="2"]');
await page.click('button[data-digit="7"]');
const live = await page.textContent('#live');
checks.ok('the live region announces the notes', /anotaciones/.test(live ?? ''), `live: "${live}"`);
const label = await page.getAttribute(`.cell[data-index="${emptyIndex}"]`, 'aria-label');
checks.ok('the cell name includes the notes', /anotaciones/.test(label ?? ''), `label: "${label}"`);
await setNotesMode(false);

// --- 13. The notes survive a reload ----------------------------------------
await page.reload();
await page.waitForSelector('#menu');
await page.click('button:has-text("Continuar")');
await page.waitForSelector('.cell');
const afterReload = await page.evaluate((index) => {
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  return {
    slots: [...cell.querySelectorAll('.note-slot')].map((s) => s.textContent),
  };
}, emptyIndex);
checks.equal('the note survived the reload', afterReload.slots[1], '2');
checks.equal('the second note survived the reload', afterReload.slots[6], '7');

// --- 14. No console errors --------------------------------------------------
checks.equal('no console errors', consoleErrors.length, 0, consoleErrors.join(' | '));

await browser.close();
server.close();
checks.finish('e2e.notes');
