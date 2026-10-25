#!/usr/bin/env node
/**
 * Contrast calculator for palette proposals.
 *
 * A palette is only accepted when every foreground/background pair it uses
 * clears WCAG AA. This tool computes the ratios from the palette itself, so a
 * proposal can be checked before a single line of CSS is written.
 *
 * Usage:
 *   node scripts/palette-check.mjs            # check the built-in candidate
 *   node scripts/palette-check.mjs file.json  # check a palette file
 *
 * A palette file is `{ "themes": [{ "name": "light", "colors": { "bg": "#fff", ... },
 * "pairs": [["text", "bg", 4.5], ...] }] }`.
 */
import { readFileSync } from 'node:fs';

/** sRGB channel to linear light. */
const linear = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Relative luminance of an sRGB colour. */
const luminance = ([r, g, b]) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** Expand #rgb, #rrggbb, #rrggbbaa or rgba() into [r, g, b, a]. */
const parse = (value) => {
  const text = String(value).trim();
  const rgbMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]),
      Number(rgbMatch[2]),
      Number(rgbMatch[3]),
      rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]),
    ];
  }
  const hex = text.replace('#', '');
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
      1,
    ];
  }
  if (hex.length !== 6 && hex.length !== 8) throw new Error(`bad colour: ${value}`);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  ];
};

/** Composite a translucent colour over an opaque one. */
const composite = (fg, bg) => {
  const [r, g, b, a] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  if (a >= 1) return [r, g, b, 1];
  return [
    Math.round(r * a + br * (1 - a)),
    Math.round(g * a + bg_ * (1 - a)),
    Math.round(b * a + bb * (1 - a)),
    1,
  ];
};

/** WCAG contrast ratio between two colours, compositing the first if translucent. */
export const ratio = (fg, bg) => {
  const front = composite(fg, bg);
  const back = parse(bg);
  const l1 = luminance(front);
  const l2 = luminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Check a palette: returns the list of pairs that fail. */
export const checkPalette = (theme) => {
  const failures = [];
  for (const [fg, bg, min = 4.5] of theme.pairs) {
    const fgValue = theme.colors[fg];
    const bgValue = theme.colors[bg];
    if (fgValue === undefined) failures.push(`${fg}: missing from the palette`);
    else if (bgValue === undefined) failures.push(`${bg}: missing from the palette`);
    else {
      const r = ratio(fgValue, bgValue);
      if (r < min) failures.push(`${fg} on ${bg}: ${r.toFixed(2)}:1 < ${min}:1`);
    }
  }
  return failures;
};

/** Print every pair of a theme with its ratio. */
const report = (theme) => {
  console.log(`\n${theme.name}:`);
  let worst = Infinity;
  for (const [fg, bg, min = 4.5] of theme.pairs) {
    const r = ratio(theme.colors[fg], theme.colors[bg]);
    worst = Math.min(worst, r - min);
    const ok = r >= min;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${fg} on ${bg}: ${r.toFixed(2)}:1 (need ${min})`,
    );
  }
  return worst;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/palette-check.mjs <palette.json>');
    console.error('       (the built-in candidate is checked by the unit tests)');
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let failed = 0;
  for (const theme of data.themes) {
    const failures = checkPalette(theme);
    report(theme);
    for (const failure of failures) console.error(`  -> ${failure}`);
    failed += failures.length;
  }
  if (failed > 0) {
    console.error(`\n${failed} pair(s) below AA.`);
    process.exit(1);
  }
  console.log('\nEvery pair meets AA.');
}
