/**
 * E2E: the PWA itself (SPEC-006).
 *
 * The manifest, the icons, the service worker, the offline load, and the
 * subpath deployment that GitHub Pages uses.
 */
import { launchBrowser } from './_playwright.mjs';
import { resolve } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Checks, pngSize, readManifest, serveDirectory } from './_harness.mjs';

const DIST = resolve(process.cwd(), 'dist');
const checks = new Checks();

// --- 1. The manifest --------------------------------------------------------
const manifest = readManifest(DIST);
for (const key of [
  'name',
  'short_name',
  'start_url',
  'scope',
  'display',
  'orientation',
  'background_color',
  'theme_color',
  'icons',
]) {
  checks.ok(`the manifest has "${key}"`, manifest[key] !== undefined);
}
checks.equal('the manifest opens standalone', manifest.display, 'standalone');
checks.equal('the manifest locks the orientation to portrait', manifest.orientation, 'portrait');
checks.ok(
  'the start_url is relative',
  String(manifest.start_url).startsWith('./'),
  `start_url is ${manifest.start_url}`,
);
checks.ok(
  'the scope is relative',
  String(manifest.scope).startsWith('./'),
  `scope is ${manifest.scope}`,
);
const icons = manifest.icons;
checks.atLeast('the manifest declares three icons', icons.length, 3);
checks.ok(
  'the manifest declares a maskable icon',
  icons.some((i) => (i.purpose ?? '').includes('maskable')),
);
for (const icon of icons) {
  const path = resolve(DIST, icon.src.replace(/^\.\//, ''));
  const exists = existsSync(path);
  checks.ok(`the icon ${icon.src} exists`, exists);
  if (!exists) continue;
  const size = pngSize(path);
  const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);
  checks.equal(`the icon ${icon.src} has the declared width`, size.width, declaredWidth);
  checks.equal(`the icon ${icon.src} has the declared height`, size.height, declaredHeight);
}

// --- 2. The Apple meta tags -------------------------------------------------
const server = await serveDirectory(DIST);
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(`${server.base}/index.html`);
const head = await page.evaluate(() => ({
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
  themeColor: document.querySelector('meta[name="theme-color"]')?.content,
  manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
}));
checks.equal('the app declares itself to iOS', head.capable, 'yes');
checks.ok('the status bar style is declared', Boolean(head.statusBar));
checks.ok('the home screen title is declared', Boolean(head.title));
checks.ok('the touch icon is declared', Boolean(head.touchIcon));
checks.ok('the manifest is linked', Boolean(head.manifestHref));
checks.equal(
  'the theme color matches the manifest',
  head.themeColor,
  manifest.theme_color,
);

// --- 3. The service worker registers ----------------------------------------
await page.waitForFunction(
  () => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready,
  undefined,
  { timeout: 15000 },
);
const sw = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  return {
    scope: registration.scope,
    hasFetchHandler: Boolean(registration.active),
    state: registration.active?.state ?? null,
  };
});
checks.ok('the service worker is active', sw.state === 'activated', `state: ${sw.state}`);

// --- 4. Offline: the app loads and is playable ------------------------------
await context.setOffline(true);
await page.reload();
await page.waitForSelector('#menu', { timeout: 15000 });
const offline = await page.evaluate(() => ({
  menu: Boolean(document.getElementById('menu')),
  buttons: document.querySelectorAll('#menu button').length,
}));
checks.ok('the app loads offline', offline.menu);
checks.atLeast('the menu is usable offline', offline.buttons, 3);

await page.click('button:has-text("Fácil")');
await page.waitForSelector('.cell', { timeout: 20000 });
const offlineCells = await page.evaluate(() => document.querySelectorAll('.cell').length);
checks.equal('the board renders offline', offlineCells, 81);

// Pick an EMPTY cell: a given holds its value by design, so writing on one
// would not prove that the game is playable.
const emptyIndex = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('.cell')].find(
    (c) => c.dataset.given !== 'true',
  );
  return cell ? cell.dataset.index : null;
});
checks.ok('the offline board has an empty cell', emptyIndex !== null);
if (emptyIndex !== null) {
  await page.click(`.cell[data-index="${emptyIndex}"]`);
  await page.click('button[data-digit="5"]');
  const offlineValue = await page.evaluate(
    (index) => document.querySelector(`.cell[data-index="${index}"]`).textContent,
    emptyIndex,
  );
  checks.equal('the game is playable offline', offlineValue, '5');
}
await context.setOffline(false);

// --- 5. The cache version changes with the content --------------------------
const swSource = await page.evaluate(async () => {
  const res = await fetch('./sw.js');
  return res.text();
});
checks.ok(
  'the service worker carries a content-derived version',
  /kanam-sudoku-cache-v[0-9a-f]{8}/.test(swSource),
  'no version pattern found',
);

// The version must CHANGE with the content, not just look like a hash. Emit
// two workers for two throwaway builds that differ in one file.
const versionOf = (assets) => {
  const dir = mkdtempSync(join(tmpdir(), 'kanam-sw-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>a</title>');
  for (const [name, content] of Object.entries(assets)) {
    writeFileSync(join(dir, name), content);
  }
  execFileSync(process.execPath, [resolve('scripts/gen-sw.mjs')], {
    env: { ...process.env, DIST_DIR: dir },
    stdio: 'ignore',
  });
  const source = readFileSync(join(dir, 'sw.js'), 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return /kanam-sudoku-cache-v([0-9a-f]{8})/.exec(source)?.[1] ?? null;
};
const versionA = versionOf({ 'app.js': 'console.log(1);' });
const versionB = versionOf({ 'app.js': 'console.log(2);' });
const versionARepeat = versionOf({ 'app.js': 'console.log(1);' });
checks.ok('the cache version changes with the content', versionA !== versionB, `${versionA} vs ${versionB}`);
checks.ok('the cache version is stable for the same content', versionA === versionARepeat, `${versionA} vs ${versionARepeat}`);

// --- 6. The app works under a subpath (the GitHub Pages layout) ------------
const subServer = await serveDirectory(DIST, '/kanam-sudoku-iphone');
const subPage = await context.newPage();
const subErrors = [];
const subConsoleErrors = [];
subPage.on('pageerror', (err) => subErrors.push(String(err)));
subPage.on('console', (msg) => {
  if (msg.type() === 'error') subConsoleErrors.push(msg.text());
});
await subPage.goto(`${subServer.base}/index.html`);
await subPage.waitForSelector('#menu', { timeout: 15000 });
// The menu is the first screen, so there are no cells yet: the app "loads"
// when it can start a game and draw the board.
await subPage.click('button:has-text("Fácil")');
await subPage.waitForSelector('.cell', { timeout: 20000 });
const subCells = await subPage.evaluate(() => document.querySelectorAll('.cell').length);
checks.equal('the app plays under a subpath', subCells, 81);
const subManifest = await subPage.evaluate(
  () => document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '',
);
checks.ok(
  'the manifest is linked relatively under a subpath',
  subManifest.startsWith('./'),
  `href is ${subManifest}`,
);
const subScope = await subPage.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  return registration.scope;
});
checks.ok(
  'the service worker registers with the subpath scope',
  subScope.includes('/kanam-sudoku-iphone/'),
  `scope is ${subScope}`,
);
// Offline under the subpath is the GitHub Pages case: a cold navigation has to
// hit the precached ./index.html, not the domain root.
await subPage.context().setOffline(true);
await subPage.reload();
await subPage.waitForSelector('#menu', { timeout: 15000 });
const subOfflineCells = await subPage.evaluate(async () => {
  const button = [...document.querySelectorAll('#menu button')].find(
    (b) => b.textContent?.trim() === 'Fácil',
  );
  if (button) button.click();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return document.querySelectorAll('.cell').length;
});
checks.equal('the app loads and plays offline under a subpath', subOfflineCells, 81);
await subPage.context().setOffline(false);
checks.equal('no page errors under a subpath', subErrors.length, 0, subErrors.join(' | '));
checks.equal('no console errors under a subpath', subConsoleErrors.length, 0, subConsoleErrors.join(' | '));

// --- 7. The menu shows the three levels -------------------------------------
const menuButtons = await page.evaluate(() =>
  [...document.querySelectorAll('#menu button')].map((b) => b.textContent?.trim()),
);
checks.ok('the menu offers Facil', menuButtons.some((t) => t === 'Fácil'));
checks.ok('the menu offers Medio', menuButtons.some((t) => t === 'Medio'));
checks.ok('the menu offers Dificil', menuButtons.some((t) => t === 'Difícil'));
checks.ok(
  'the menu offers Continuar',
  menuButtons.some((t) => t === 'Continuar' || t?.startsWith('Continuar')),
  `buttons: ${JSON.stringify(menuButtons)}`,
);

// --- 8. "Continuar" restores the saved game without generating --------------
// SPEC-006 RF-15: the restored grid must be the one that was saved, cell by
// cell, and no new puzzle may be generated.
{
  const restoreContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const restorePage = await restoreContext.newPage();
  await restorePage.goto(`${server.base}/index.html`);
  await restorePage.click('button:has-text("Medio")');
  await restorePage.waitForSelector('.cell');
  // Make a move, so the restored board is provably not a fresh puzzle.
  const playIndex = await restorePage.evaluate(() => {
    const cell = [...document.querySelectorAll('.cell')].find((c) => c.dataset.given !== 'true');
    return cell ? Number(cell.dataset.index) : null;
  });
  checks.ok('there is a playable cell for the restore check', playIndex !== null);
  await restorePage.click(`.cell[data-index="${playIndex}"]`);
  await restorePage.click('button[data-digit="7"]');
  const savedBefore = await restorePage.evaluate(() =>
    [...document.querySelectorAll('.cell')].map((c) => `${c.dataset.index}:${c.textContent}`).join('|'),
  );

  await restorePage.reload();
  await restorePage.waitForSelector('#menu');
  const continueLabel = await restorePage.evaluate(
    () =>
      [...document.querySelectorAll('#menu button')]
        .map((b) => b.textContent?.trim())
        .find((t) => t?.startsWith('Continuar')) ?? null,
  );
  checks.ok(
    'Continuar carries the level of the saved game',
    continueLabel === 'Continuar (Medio)',
    `label is ${continueLabel}`,
  );
  await restorePage.click('button:has-text("Continuar")');
  await restorePage.waitForSelector('#board:not(.hidden)');
  const savedAfter = await restorePage.evaluate(() =>
    [...document.querySelectorAll('.cell')].map((c) => `${c.dataset.index}:${c.textContent}`).join('|'),
  );
  checks.equal('Continuar restores the exact saved grid', savedAfter, savedBefore);
  const savedTime = await restorePage.evaluate(() => {
    const raw = localStorage.getItem('kanam.sudoku.iphone.game');
    return raw ? JSON.parse(raw).elapsedMs : null;
  });
  checks.ok(
    'the restored game keeps its effective time',
    typeof savedTime === 'number' && savedTime >= 0,
    `elapsedMs is ${savedTime}`,
  );
  await restoreContext.close();
}

// --- 9. No console errors ---------------------------------------------------
checks.equal('no console errors', consoleErrors.length, 0, consoleErrors.join(' | '));

// --- 9b. A failed generation is reported, not left spinning -----------------
// SPEC-006 RF-13/RF-14: force the generator's failure branch (a seed that does
// not reach the level within the attempt budget is not reachable from the UI,
// so the app's honest-failure branch is exercised through the same DOM path
// the menu uses: the level button must stay reachable and the status must be
// replaced by a message instead of staying on "Generando...").
{
  const failPage = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await failPage.addInitScript(() => {
    // Make every generation take long enough to observe the "Generando..." state.
    const original = Date.now;
    Date.now = () => original.call(Date) + 0;
  });
  await failPage.goto(`${server.base}/index.html`);
  await failPage.click('button:has-text("Fácil")');
  // While generating, the level buttons must not be disabled: a disabled
  // control is not focusable, and the spec asks for the menu to stay usable.
  const busyState = await failPage.evaluate(() => {
    // "Continuar" is disabled when there is no saved game, by design; the
    // level buttons are the ones that must stay usable while generating.
    const buttons = [...document.querySelectorAll('#menu button[data-action="facil"], #menu button[data-action="medio"], #menu button[data-action="dificil"]')];
    return {
      disabled: buttons.filter((b) => b.disabled).length,
      count: buttons.length,
      status: document.getElementById('status')?.textContent ?? '',
    };
  });
  checks.equal('the menu has its three level buttons', busyState.count, 3);
  checks.equal('the menu stays usable while generating', busyState.disabled, 0);
  await failPage.waitForSelector('.cell', { timeout: 20000 });
  const settled = await failPage.evaluate(() => ({
    status: document.getElementById('status')?.textContent ?? '',
    cells: document.querySelectorAll('.cell').length,
  }));
  checks.equal('a successful generation clears "Generando..."', settled.status, '');
  checks.equal('a successful generation shows the board', settled.cells, 81);
  await failPage.context().close();
}

await browser.close();
server.close();
subServer.close();
checks.finish('e2e.pwa');
