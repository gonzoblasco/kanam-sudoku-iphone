/**
 * Deterministic PNG icon generator.
 *
 * Writes the three icons the manifest needs using ONLY the Node standard
 * library (`node:zlib` for the deflate stream). No image library, no external
 * command: ADR-0003 requires the icons to be generated locally without
 * dependencies, and a script that shells out to a macOS-only tool (`sips`)
 * cannot run in the Linux CI.
 *
 * Determinism: the pixels are computed from constants, the zlib settings are
 * fixed, and no timestamp is written into the file. Two runs produce byte
 * identical PNGs, so regenerating the icons never produces a spurious diff.
 *
 * Usage: `node scripts/generate-icons.mjs` (also `npm run icons`).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// PNG encoding (8-bit RGBA, no interlacing)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
};

/** Encode an RGBA pixel buffer (width * height * 4 bytes) as a PNG. */
const encodePng = (width, height, rgba) => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = none) in front of every scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ---------------------------------------------------------------------------
// The icon design: a sudoku board, drawn from geometry (no anti-aliasing, so
// the result is exactly reproducible on every platform).
// ---------------------------------------------------------------------------

const BACKGROUND = [0x1d, 0x4e, 0xd8, 0xff]; // blue
const LINE = [0xff, 0xff, 0xff, 0xff]; // white grid
const FILLED = [0x0b, 0x1f, 0x4a, 0xff]; // dark blue "given" cells

/**
 * Draw the icon.
 *
 * `inset` is the fraction of the canvas left empty around the artwork. A
 * maskable icon is cropped by the launcher to a circle or a squircle, so its
 * content has to stay inside the safe zone (20% inset); a normal icon uses the
 * whole canvas.
 */
const drawIcon = (size, inset) => {
  const rgba = Buffer.alloc(size * size * 4);
  const put = (x, y, colour) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    rgba[offset] = colour[0];
    rgba[offset + 1] = colour[1];
    rgba[offset + 2] = colour[2];
    rgba[offset + 3] = colour[3];
  };

  const boardSize = Math.round(size * (1 - 2 * inset));
  const boardLeft = Math.round((size - boardSize) / 2);
  const cellSize = boardSize / 9;
  const lineWidth = Math.max(1, Math.round(size * 0.008));
  const blockLineWidth = Math.max(2, Math.round(size * 0.02));

  // Nine givens, shaped like a real puzzle.
  const givens = [
    [0, 0], [0, 4], [0, 8],
    [2, 2], [2, 6],
    [4, 0], [4, 4], [4, 8],
    [8, 2], [8, 6],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      put(x, y, BACKGROUND);
    }
  }

  const inBoard = (x, y) =>
    x >= boardLeft &&
    x < boardLeft + boardSize &&
    y >= boardLeft &&
    y < boardLeft + boardSize;

  // Filled cells first, so the grid lines stay on top.
  for (const [row, col] of givens) {
    const left = boardLeft + Math.round(col * cellSize);
    const top = boardLeft + Math.round(row * cellSize);
    const right = boardLeft + Math.round((col + 1) * cellSize);
    const bottom = boardLeft + Math.round((row + 1) * cellSize);
    const pad = Math.max(2, Math.round(size * 0.02));
    for (let y = top + pad; y < bottom - pad; y++) {
      for (let x = left + pad; x < right - pad; x++) put(x, y, FILLED);
    }
  }

  // Grid lines: 10 per axis, thicker every third one.
  for (let index = 0; index <= 9; index++) {
    const width = index % 3 === 0 ? blockLineWidth : lineWidth;
    const position = boardLeft + Math.round(index * cellSize) - Math.floor(width / 2);
    for (let t = 0; t < width; t++) {
      const p = position + t;
      for (let y = boardLeft; y < boardLeft + boardSize; y++) {
        if (inBoard(p, y)) put(p, y, LINE);
      }
      for (let x = boardLeft; x < boardLeft + boardSize; x++) {
        if (inBoard(x, p)) put(x, p, LINE);
      }
    }
  }

  return encodePng(size, size, rgba);
};

// ---------------------------------------------------------------------------
// Write the icons into public/ (they are versioned, so the build has them)
// ---------------------------------------------------------------------------

const outputDir = resolve(process.cwd(), 'public');
mkdirSync(outputDir, { recursive: true });

const ICONS = [
  { name: 'icon-192.png', size: 192, inset: 0.08 },
  { name: 'icon-512.png', size: 512, inset: 0.08 },
  // Maskable: the launcher may crop the outer 20%, so the artwork is inset.
  { name: 'icon-maskable.png', size: 512, inset: 0.2 },
];

for (const icon of ICONS) {
  const png = drawIcon(icon.size, icon.inset);
  if (png.subarray(0, 4).toString('hex') !== '89504e47') {
    console.error(`Generated ${icon.name} is not a PNG`);
    process.exit(1);
  }
  writeFileSync(resolve(outputDir, icon.name), png);
  console.log(`Generated public/${icon.name} (${icon.size}x${icon.size}, ${png.length} bytes)`);
}

// The build fails if an icon is missing or corrupt (spec-006).
for (const icon of ICONS) {
  const path = resolve(outputDir, icon.name);
  if (!existsSync(path)) {
    console.error(`Missing icon after generation: ${path}`);
    process.exit(1);
  }
  const signature = readFileSync(path).subarray(0, 4).toString('hex');
  if (signature !== '89504e47') {
    console.error(`${path} is not a PNG (signature ${signature})`);
    process.exit(1);
  }
}
