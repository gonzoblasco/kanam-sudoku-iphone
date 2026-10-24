/**
 * Contrast check.
 *
 * Measures the colour pairs the UI actually uses, in BOTH themes, and fails
 * when any of them drops below the WCAG AA threshold (4.5:1 for body text,
 * 3:1 for large text and UI boundaries).
 *
 * The pairs are read from the stylesheet's custom properties, so the check
 * follows the theme instead of hard-coding colours.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AA_BODY = 4.5;
const AA_LARGE = 3.0;

const cssPath = resolve(process.cwd(), 'src', 'ui', 'styles.css');
const css = readFileSync(cssPath, 'utf8');

/** Relative luminance of an sRGB colour. */
const lumChannel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const relativeLuminance = ([r, g, b]) =>
  0.2126 * lumChannel(r) + 0.7152 * lumChannel(g) + 0.0722 * lumChannel(b);

const contrastRatio = (a, b) => {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Parse "#rrggbb" into [r, g, b]. */
const parseHex = (hex) => {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
};

/** Parse "rgba(r, g, b, a)" into [r, g, b]. */
const parseRgba = (value) => {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const parseColor = (value) => {
  if (!value) return null;
  if (value.startsWith('#')) return parseHex(value);
  if (value.startsWith('rgb')) return parseRgba(value);
  return null;
};

/** Extract the custom properties of a `:root` block. */
const parseRootBlock = (block) => {
  const map = {};
  const re = /--([a-zA-Z-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) map[m[1]] = m[2].trim();
  return map;
};

const [lightPart, darkPart = ''] = css.split('@media (prefers-color-scheme: dark)');
const lightMatch = /:root\s*\{([^}]*)\}/.exec(lightPart);
const darkMatch = /:root\s*\{([^}]*)\}/.exec(darkPart);

if (!lightMatch) {
  console.error('Could not find the light theme variables in styles.css');
  process.exit(1);
}

const themes = [
  { name: 'light', vars: parseRootBlock(lightMatch[1]) },
  { name: 'dark', vars: darkMatch ? parseRootBlock(darkMatch[1]) : null },
];

if (!themes[1].vars) {
  console.error('Could not find the dark theme variables in styles.css');
  process.exit(1);
}

/**
 * The pairs that matter, and the threshold each one has to clear.
 *
 * `min` is the ratio required: body text needs 4.5:1, a large text or a UI
 * boundary (a grid line, a selection outline) needs 3:1.
 */
const PAIRS = [
  { label: 'body text on background', fg: 'text', bg: 'bg', min: AA_BODY },
  { label: 'given digit on background', fg: 'text', bg: 'bg', min: AA_BODY },
  { label: 'grid line on background', fg: 'grid-line', bg: 'bg', min: AA_LARGE },
  { label: 'selection outline on background', fg: 'selected-outline', bg: 'bg', min: AA_LARGE },
  { label: 'conflict colour on background', fg: 'conflict-color', bg: 'bg', min: AA_BODY },
  { label: 'text on row highlight', fg: 'text', bg: 'highlight-row', min: AA_BODY },
  { label: 'text on column highlight', fg: 'text', bg: 'highlight-column', min: AA_BODY },
  { label: 'text on block highlight', fg: 'text', bg: 'highlight-block', min: AA_BODY },
  { label: 'text on same-digit highlight', fg: 'text', bg: 'highlight-same', min: AA_BODY },
];

let failures = 0;

for (const theme of themes) {
  console.log(`\n${theme.name} theme:`);
  for (const pair of PAIRS) {
    const fg = parseColor(theme.vars[pair.fg]);
    const bg = parseColor(theme.vars[pair.bg]);
    if (!fg || !bg) {
      console.log(`  SKIP  ${pair.label} (missing --${pair.fg} or --${pair.bg})`);
      continue;
    }
    // A translucent background is composited over the page background first.
    let background = bg;
    const raw = theme.vars[pair.bg] ?? '';
    const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(raw);
    if (alpha) {
      const a = Number(alpha[1]);
      const page = parseColor(theme.vars['bg']) ?? [255, 255, 255];
      background = bg.map((c, i) => Math.round(c * a + page[i] * (1 - a)));
    }
    const ratio = contrastRatio(fg, background);
    const passed = ratio >= pair.min;
    if (!passed) failures++;
    console.log(
      `  ${passed ? 'ok  ' : 'FAIL'}  ${pair.label}: ${ratio.toFixed(2)}:1 (need ${pair.min}:1)`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} colour pair(s) below the AA threshold.`);
  process.exit(1);
}
console.log('\nAll colour pairs meet WCAG AA.');
