/**
 * Generate the service worker file (`dist/sw.js`).
 * It reads the built assets in `dist/`, creates a precache list of relative
 * URLs (prefixed with "./"), computes a version hash based on the content of
 * those assets, and injects both into the SW template (`src/sw/sw-template.js`).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import crypto from "node:crypto";

const projectRoot = process.cwd();
const distDir = resolve(projectRoot, "dist");
const templatePath = resolve(projectRoot, "src", "sw", "sw-template.js");

// Collect all files that should be precached (excluding the generated sw.js itself).
function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      // Exclude source map files and the eventual sw.js (if already present).
      if (entry.name.endsWith('.map')) continue;
      const rel = "./" + relative(distDir, fullPath).replace(/\\/g, '/');
      files.push(rel);
    }
  }
  return files;
}

const precacheAssets = collectFiles(distDir);
// Ensure the fallback entry `./index.html` is present.
if (!precacheAssets.includes('./index.html')) {
  precacheAssets.unshift('./index.html');
}

// Compute hash over concatenated file contents for versioning.
const hash = crypto.createHash('sha256');
for (const asset of precacheAssets) {
  const filePath = resolve(distDir, asset.replace(/^\.\//, ''));
  try {
    const data = readFileSync(filePath);
    hash.update(data);
  } catch (e) {
    // If a file is missing (unlikely), skip it – version will still be deterministic.
    console.error(`Failed to read asset for hash: ${asset}`, e);
  }
}
const version = hash.digest('hex').slice(0, 8);

// Load template and replace placeholders.
let template = readFileSync(templatePath, "utf8");
// Replace PRECACHE_ASSETS array.
const assetsJson = JSON.stringify(precacheAssets, null, 2);
template = template.replace(/const PRECACHE_ASSETS = \[\];/, `const PRECACHE_ASSETS = ${assetsJson};`);
// Replace version placeholder.
template = template.replace(/{{VERSION}}/g, version);

// Write to dist/sw.js
const outputPath = resolve(distDir, "sw.js");
writeFileSync(outputPath, template, "utf8");
console.log(`Service worker generated at ${outputPath} with version ${version}`);

