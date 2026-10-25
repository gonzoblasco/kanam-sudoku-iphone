#!/usr/bin/env node
/**
 * Theme lab: render the real app under a candidate palette and save a PNG.
 *
 * A palette argument is only worth what it looks like on the board. This script
 * injects a candidate's CSS custom properties over the built app, screenshots
 * it at the iPhone viewport, and writes the image next to its name. Comparing
 * proposals as pixels is the only way to settle an aesthetic argument.
 *
 * Usage:
 *   node scripts/theme-lab.mjs <candidate.json> [--out dir]
 *
 * A candidate is:
 *   {
 *     "name": "editorial",
 *     "light": { "--bg": "#fff", ... },
 *     "dark":  { "--bg": "#000", ... },
 *     "css": "optional extra CSS, applied in both themes"
 *   }
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../test/_playwright.mjs';
import { serveDirectory } from '../test/_harness.mjs';

const args = process.argv.slice(2);
const candidatePath = args.find((a) => !a.startsWith('--'));
const outIndex = args.indexOf('--out');
const outDir = outIndex !== -1 ? args[outIndex + 1] : resolve('tmp/theme-lab');

if (!candidatePath) {
  console.error('Usage: node scripts/theme-lab.mjs <candidate.json> [--out dir]');
  process.exit(2);
}

const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
mkdirSync(outDir, { recursive: true });

/** Turn a variables object into a CSS rule. */
const rule = (selector, variables) =>
  `${selector} {\n${Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')}\n}`;

const css = [
  rule(':root', candidate.light ?? {}),
  `@media (prefers-color-scheme: dark) { ${rule(':root', candidate.dark ?? {})} }`,
  candidate.css ?? '',
].join('\n');

const server = await serveDirectory(resolve('dist'));
const browser = await launchBrowser();
const shots = [];

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(`${server.base}/index.html`);
  await page.waitForSelector('#menu');
  await page.addStyleTag({ content: css });
  await page.screenshot({ path: resolve(outDir, `${candidate.name}-${scheme}-menu.png`) });
  shots.push(`${candidate.name}-${scheme}-menu.png`);

  await page.click('button:has-text("Fácil")');
  await page.waitForSelector('.cell');
  await page.click('.cell[data-index="40"]');
  await page.click('button[data-action="auto-notes"]');
  // A conflict, so the conflict style is visible in the screenshot.
  const empty = await page.evaluate(() => {
    const cell = [...document.querySelectorAll('.cell')].find(
      (c) => c.dataset.given !== 'true' && c.dataset.index !== '40',
    );
    return cell ? cell.dataset.index : null;
  });
  if (empty !== null) {
    await page.click(`.cell[data-index="${empty}"]`);
    await page.click('button[data-digit="1"]');
    await page.click('.cell[data-index="40"]');
  }
  await page.screenshot({ path: resolve(outDir, `${candidate.name}-${scheme}-board.png`) });
  shots.push(`${candidate.name}-${scheme}-board.png`);

  await context.close();
}

await browser.close();
server.close();

writeFileSync(
  resolve(outDir, `${candidate.name}.json`),
  JSON.stringify({ candidate: candidate.name, shots }, null, 2),
);
console.log(`Rendered ${shots.length} screenshots into ${outDir}`);
for (const shot of shots) console.log(`  ${shot}`);
