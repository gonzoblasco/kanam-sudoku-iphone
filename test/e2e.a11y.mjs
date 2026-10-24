/**
 * E2E: accessibility (SPEC-003 and SPEC-006).
 *
 * axe-core runs against the live app. The script is loaded from a CDN in the
 * test only: it must never end up in the shipped bundle.
 */
import { launchBrowser } from './_playwright.mjs';
import { resolve } from 'node:path';
import { Checks, serveDirectory } from './_harness.mjs';

const AXE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

const DIST = resolve(process.cwd(), 'dist');
const checks = new Checks();

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const server = await serveDirectory(DIST);
await page.goto(`${server.base}/index.html`);
await page.waitForSelector('#menu');
await page.click('button:has-text("Fácil")');
await page.waitForSelector('.cell');

await page.addScriptTag({ url: AXE_URL });
const result = await page.evaluate(async () => {
  // @ts-ignore - axe is injected at runtime by the test.
  const axe = globalThis.axe;
  if (!axe) return { error: 'axe was not injected' };
  const outcome = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  });
  return {
    violations: outcome.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      target: v.nodes[0]?.target?.join(' ') ?? '',
    })),
  };
});

if ('error' in result) {
  checks.ok('axe-core is available', false, result.error);
} else {
  checks.equal(
    'axe-core reports no violations',
    result.violations.length,
    0,
    result.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes} at ${v.target}`).join(' | '),
  );
  for (const violation of result.violations) {
    console.log(`  violation: ${violation.id} [${violation.impact}] ${violation.help}`);
    console.log(`    at ${violation.target} (${violation.nodes} nodes)`);
  }
}

// --- The live region and the grid semantics ---------------------------------
const semantics = await page.evaluate(() => ({
  grid: document.getElementById('board')?.getAttribute('role'),
  rows: document.querySelectorAll('[role="row"]').length,
  cells: document.querySelectorAll('[role="gridcell"]').length,
  live: document.getElementById('live')?.getAttribute('aria-live'),
  liveHidden: document
    .getElementById('live')
    ?.classList.contains('sr-only'),
  labelledCells: [...document.querySelectorAll('.cell')].filter((c) =>
    (c.getAttribute('aria-label') ?? '').length > 0,
  ).length,
}));
checks.equal('the board is a grid', semantics.grid, 'grid');
checks.equal('the board has 9 rows', semantics.rows, 9);
checks.equal('the board has 81 grid cells', semantics.cells, 81);
checks.equal('the live region is polite', semantics.live, 'polite');
checks.ok('the live region is visually hidden', semantics.liveHidden === true);
checks.equal('every cell has an accessible name', semantics.labelledCells, 81);

await browser.close();
server.close();
checks.finish('e2e.a11y');
