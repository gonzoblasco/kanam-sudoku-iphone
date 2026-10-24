/**
 * E2E: the board layout and its touch behaviour, at an iPhone viewport.
 *
 * The checks are the acceptance criteria of SPEC-003.
 */
import { launchBrowser } from './_playwright.mjs';
import { resolve } from 'node:path';
import { Checks, serveDirectory } from './_harness.mjs';

const DIST = resolve(process.cwd(), 'dist');
const checks = new Checks();

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
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

// --- 1. No vertical scroll at 390x844 ---------------------------------------
const scroll = await page.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  innerHeight: window.innerHeight,
  scrollY: window.scrollY,
}));
checks.atMost('no vertical scroll', scroll.scrollHeight, scroll.innerHeight, 'px');
checks.equal('scroll starts at the top', scroll.scrollY, 0);

// --- 2. The board is square and wide enough ---------------------------------
const board = await page.evaluate(() => {
  const el = document.getElementById('board');
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom };
});
checks.atMost('the board is square', Math.abs(board.width - board.height), 1, 'px');
checks.atLeast('the board is wide enough', board.width, 340, 'px');

// --- 3. Touch targets are at least 44x44 -------------------------------------
const cellSizes = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.cell')];
  return cells.map((c) => {
    const r = c.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
});
checks.equal('the board has 81 cells', cellSizes.length, 81);
const smallest = cellSizes.reduce(
  (acc, s) => ({ w: Math.min(acc.w, s.w), h: Math.min(acc.h, s.h) }),
  { w: Infinity, h: Infinity },
);
checks.atLeast('every cell is at least 44px wide', smallest.w, 44, 'px');
checks.atLeast('every cell is at least 44px tall', smallest.h, 44, 'px');

// --- 4. Block borders are thicker than the inner ones -----------------------
const borders = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.cell')];
  const style = (el, prop) => parseFloat(getComputedStyle(el)[prop]);
  return {
    blockBorder: style(cells[0], 'borderLeftWidth'),
    innerBorder: style(cells[1], 'borderLeftWidth'),
  };
});
checks.ok(
  'block borders are thicker than inner ones',
  borders.blockBorder > borders.innerBorder,
  `block ${borders.blockBorder}px vs inner ${borders.innerBorder}px`,
);

// --- 5. Selecting a cell highlights row, column, block and same digit --------
// Select an EMPTY cell. The puzzle is generated with a fresh seed on every run,
// so selecting a cell whose digit repeats elsewhere would legitimately produce
// `same` highlights instead of `block`/`row`/`column` ones.
const selectedIndex = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('.cell')].find(
    (c) => c.dataset.given !== 'true',
  );
  return cell ? Number(cell.dataset.index) : 40;
});
await page.click(`.cell[data-index="${selectedIndex}"]`);
// The highlight is ONE value per cell, with the precedence
// same > block > column > row (data-model.md). So the property to assert is
// that every cell of the row, the column and the block IS highlighted, and
// that the label of each cell follows the precedence.
const highlight = await page.evaluate((selectedIndex) => {
  const cells = [...document.querySelectorAll('.cell')];
  const of = (predicate) => cells.filter(predicate);
  const index = (c) => Number(c.dataset.index);
  const label = (c) => c.getAttribute('data-highlight');

  const selected = selectedIndex;
  const row = of((c) => Math.floor(index(c) / 9) === Math.floor(selected / 9));
  const column = of((c) => index(c) % 9 === selected % 9);
  const block = of((c) => {
    const r = Math.floor(index(c) / 9);
    const col = index(c) % 9;
    const sr = Math.floor(selected / 9);
    const sc = selected % 9;
    return (
      Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(col / 3) === Math.floor(sc / 3)
    );
  });

  const counts = { row: 0, column: 0, block: 0, same: 0 };
  for (const el of cells) {
    const value = label(el);
    if (value && value in counts) counts[value]++;
  }

  return {
    counts,
    selected: document.querySelectorAll('[data-selected="true"]').length,
    rowHighlighted: row.filter((c) => label(c) !== null).length,
    rowTotal: row.length,
    columnHighlighted: column.filter((c) => label(c) !== null).length,
    columnTotal: column.length,
    blockHighlighted: block.filter((c) => label(c) !== null).length,
    blockTotal: block.length,
    // Every cell of the row that is not in the block must say "row".
    rowLabelledRow: row.filter(
      (c) =>
        label(c) === 'row' ||
        (Math.floor(index(c) / 9 / 3) === Math.floor(Math.floor(selected / 9) / 3) &&
          Math.floor((index(c) % 9) / 3) === Math.floor((selected % 9) / 3)),
    ).length,
  };
}, selectedIndex);
checks.equal('exactly one cell is selected', highlight.selected, 1);
// The selected cell is not highlighted itself: 8 of 9 in each unit.
checks.equal('the rest of the row is highlighted', highlight.rowHighlighted, 8);
checks.equal('the rest of the column is highlighted', highlight.columnHighlighted, 8);
checks.equal('the rest of the block is highlighted', highlight.blockHighlighted, 8);
checks.equal('the row has 9 cells', highlight.rowTotal, 9);
checks.equal('the column has 9 cells', highlight.columnTotal, 9);
checks.equal('the block has 9 cells', highlight.blockTotal, 9);
// The labels follow the precedence: a cell in the block says "block", even
// when it is also in the row or the column.
checks.equal('the block label wins over row and column', highlight.counts.block, 8);

// --- 5b. A repeated digit elsewhere is highlighted as "same" ---------------
// SPEC-003: selecting a cell whose digit appears in another cell highlights
// that other cell with `data-highlight="same"`.
const sameCheck = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.cell')];
  // A cell with a digit, and another cell with the same digit.
  const byValue = new Map();
  for (const cell of cells) {
    const value = cell.textContent?.trim();
    if (!value) continue;
    const list = byValue.get(value) ?? [];
    list.push(Number(cell.dataset.index));
    byValue.set(value, list);
  }
  const duplicate = [...byValue.entries()].find(([, list]) => list.length >= 2);
  return duplicate ? { digit: duplicate[0], indices: duplicate[1] } : null;
});
if (sameCheck) {
  await page.click(`.cell[data-index="${sameCheck.indices[0]}"]`);
  const same = await page.evaluate(
    (indices) =>
      indices.slice(1).map((index) => {
        const cell = document.querySelector(`.cell[data-index="${index}"]`);
        return cell ? cell.getAttribute('data-highlight') : null;
      }),
    sameCheck.indices,
  );
  checks.ok(
    'a repeated digit is highlighted as "same"',
    same.length > 0 && same.every((label) => label === 'same'),
    `digit ${sameCheck.digit}: ${JSON.stringify(same)}`,
  );
} else {
  checks.ok('a repeated digit exists to highlight', false, 'the generated puzzle has no repeated digit');
}

// --- 6. A given cannot be edited --------------------------------------------
const givenEdited = await page.evaluate(async () => {
  const given = document.querySelector('.cell[data-given="true"]');
  if (!given) return 'no given cell found';
  const index = given.dataset.index;
  const before = given.textContent;
  given.click();
  const after = document.querySelector(`.cell[data-index="${index}"]`)?.textContent;
  return before === after ? 'unchanged' : `changed from ${before} to ${after}`;
});
checks.equal('a given is not edited by tapping', givenEdited, 'unchanged');

// --- 7. Tapping does not scroll ---------------------------------------------
const afterTap = await page.evaluate(() => window.scrollY);
checks.equal('tapping does not scroll the page', afterTap, 0);

// --- 8b. prefers-reduced-motion disables the transition ---------------------
{
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${server.base}/index.html`);
  await reducedPage.click('button:has-text("Fácil")');
  await reducedPage.waitForSelector('.cell');
  await reducedPage.click('.cell[data-index="0"]');
  const durations = await reducedPage.evaluate(
    () =>
      [...document.querySelectorAll('.cell')].map((c) => getComputedStyle(c).transitionDuration),
  );
  checks.ok(
    'reduced motion sets every cell transition to 0s',
    durations.every((d) => d === '0s' || d === ''),
    `durations: ${[...new Set(durations)].join(',')}`,
  );
  await reduced.close();
}

// --- 8. No console errors ---------------------------------------------------
checks.equal('no console errors', consoleErrors.length, 0, consoleErrors.join(' | '));

// --- 9. States do not depend on colour alone --------------------------------
// SPEC-003 AC: at least one pair of cells with the same background and a
// different state, distinguished by their data-* attributes. It runs in a fresh
// context: after a selection, the highlight tint is a legitimate difference.
{
const plain = await browser.newContext({ viewport: { width: 390, height: 844 } });
const plainPage = await plain.newPage();
await plainPage.goto(`${server.base}/index.html`);
await plainPage.click('button:has-text("Fácil")');
await plainPage.waitForSelector('.cell');
const statePair = await plainPage.evaluate(() => {
  const cells = [...document.querySelectorAll('.cell')];
  const bg = (c) => getComputedStyle(c).backgroundColor;
  const stateOf = (c) =>
    [...c.attributes]
      .filter((a) => a.name.startsWith('data-') && !['data-index', 'data-row', 'data-col', 'data-block'].includes(a.name))
      .map((a) => `${a.name}=${a.value}`)
      .sort()
      .join(',');
  const given = cells.find((c) => c.dataset.given === 'true');
  const empty = cells.find((c) => c.dataset.given !== 'true' && !c.textContent);
  if (!given || !empty) return null;
  return {
    sameBackground: bg(given) === bg(empty),
    givenState: stateOf(given),
    emptyState: stateOf(empty),
    givenWeight: getComputedStyle(given).fontWeight,
    emptyWeight: getComputedStyle(empty).fontWeight,
  };
});
await plain.close();
checks.ok('a given and an empty cell share a background', statePair?.sameBackground === true, JSON.stringify(statePair));
checks.ok(
  'their data-* states differ (a given is not distinguished by colour)',
  statePair !== null && statePair.givenState !== statePair.emptyState,
  `${statePair?.givenState} vs "${statePair?.emptyState}"`,
);
checks.ok(
  'the given also carries a typographic weight',
  statePair !== null && statePair.givenWeight !== statePair.emptyWeight,
  `${statePair?.givenWeight} vs ${statePair?.emptyWeight}`,
);
}

await browser.close();
server.close();
checks.finish('e2e.board');
