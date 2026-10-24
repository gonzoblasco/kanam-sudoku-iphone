/**
 * Runtime resolution of Playwright for the e2e suites.
 *
 * The project does NOT declare `playwright-core` as a dependency: the shipped
 * app has zero runtime dependencies (ADR-0001), and the CI installs Playwright
 * in its own environment (see .github/workflows/ci.yml).
 *
 * On the developer's machine the module lives in the Playwright cache instead
 * of node_modules, and the browser build that Playwright expects may not be
 * the one that is installed. Both are resolved here, in one place, so the
 * suites themselves stay simple.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE = join(homedir(), 'Library/Caches/ms-playwright');

/** Chromium executables that may be installed, newest build first. */
const BROWSER_CANDIDATES = [
  'chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chromium-1243/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
  'chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chromium-1234/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
];

const executablePath = BROWSER_CANDIDATES.map((relative) => join(CACHE, relative)).find(
  (candidate) => existsSync(candidate),
);

const MODULE_CANDIDATES = [
  'playwright-core',
  join(homedir(), '.bun/install/cache/playwright-core/1.62.1@@@1/index.mjs'),
];

let playwright = null;
let lastError = null;
for (const candidate of MODULE_CANDIDATES) {
  try {
    playwright = await import(candidate);
    break;
  } catch (error) {
    lastError = error;
  }
}

if (!playwright) {
  console.error('Unable to resolve playwright-core for the e2e suites.');
  console.error(`Tried: ${MODULE_CANDIDATES.join(', ')}`);
  console.error(`Last error: ${lastError}`);
  process.exit(1);
}

/**
 * Launch Chromium with the browser that is actually installed.
 *
 * `executablePath` is only passed when the expected build is missing, so the
 * CI (where Playwright downloads its own browser) keeps using its default.
 */
export const launchBrowser = async (options = {}) => {
  const launchOptions = { ...options };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  return playwright.chromium.launch(launchOptions);
};

export const chromium = playwright.chromium;
export { executablePath };
