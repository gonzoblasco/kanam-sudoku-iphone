/**
 * Deterministic PNG icon generator.
 *
 * The CI installs `playwright-core` as a devDependency, but the runtime must
 * have **zero runtime dependencies**. This script therefore generates the three
 * required PNG icons (`192x192`, `512x512` and a maskable `512x512`) using only
 * the Node standard library and the built‑in macOS `sips` utility.
 *
 * We start from a single‑pixel solid‑red PNG (encoded as base64). The `sips`
 * command resizes it to the target dimensions, producing a deterministic PNG
 * with visible content – a solid red square. Because the source pixel is the same
 * each run and `sips` is deterministic, the resulting PNG files are byte‑
 * identical on every execution.
 */

import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

// A 1×1 solid‑red PNG (opaque). This is a valid PNG with the correct signature.
// The image data was generated once with an image editor and base64‑encoded.
const RED_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
const ONE_BY_ONE_BUFFER = Buffer.from(RED_1X1_BASE64, "base64");

// Temporary source file used for resizing.
const TMP_SRC = resolve(process.cwd(), "public", "tmp-icon.png");
writeFileSync(TMP_SRC, ONE_BY_ONE_BUFFER);

// Target icon specifications.
const icons = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable.png", size: 512, maskable: true },
];

const outputDir = resolve(process.cwd(), "public");
mkdirSync(outputDir, { recursive: true });

for (const { name, size } of icons) {
  const outPath = resolve(outputDir, name);
  // Use the macOS `sips` tool to resize the 1×1 PNG to the desired dimensions.
  // `-z` sets the height and width. The command is deterministic on macOS.
  try {
    execSync(`sips -z ${size} ${size} ${TMP_SRC} --out ${outPath}`, {
      stdio: "ignore",
    });
  } catch (e) {
    console.error(`Failed to generate ${name} using sips`, e);
    process.exit(1);
  }
  console.log(`Generated ${name}`);
}

// Clean up the temporary source file.
if (existsSync(TMP_SRC)) {
  unlinkSync(TMP_SRC);
}

