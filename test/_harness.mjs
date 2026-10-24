/**
 * Shared helpers for the e2e suites.
 *
 * The suites must FAIL when a check fails. A suite that only prints its
 * checks and always exits 0 verifies nothing: the CI would be green with a
 * broken UI.
 */
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

/**
 * Serve a directory over HTTP.
 *
 * `prefix` mounts the directory under a path, which is how the subpath of
 * GitHub Pages is reproduced without deploying.
 */
export const serveDirectory = async (dir, prefix = '') => {
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (prefix && pathname.startsWith(prefix)) {
      pathname = pathname.slice(prefix.length);
    }
    if (pathname === '' || pathname === '/') pathname = '/index.html';
    const filePath = resolve(dir, `.${pathname}`);
    if (!filePath.startsWith(resolve(dir))) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}${prefix}`,
    close: () => server.close(),
  };
};

/**
 * A check recorder.
 *
 * Every check is recorded as passed or failed, and `finish()` exits with code 1
 * if any of them failed.
 */
export class Checks {
  passed = 0;
  failures = [];

  ok(name, condition, detail = '') {
    if (condition) {
      this.passed++;
      console.log(`  ok  ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      this.failures.push(`${name}${detail ? `: ${detail}` : ''}`);
      console.log(`  FAIL ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  equal(name, actual, expected) {
    this.ok(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }

  atLeast(name, actual, minimum, unit = '') {
    this.ok(name, actual >= minimum, `got ${actual}${unit}, want >= ${minimum}${unit}`);
  }

  atMost(name, actual, maximum, unit = '') {
    this.ok(name, actual <= maximum, `got ${actual}${unit}, want <= ${maximum}${unit}`);
  }

  /** Print the summary and exit with 1 when something failed. */
  finish(suite) {
    const total = this.passed + this.failures.length;
    if (this.failures.length === 0) {
      console.log(`\n${suite}: ${total}/${total} checks passed`);
      return;
    }
    console.error(`\n${suite}: ${this.passed}/${total} checks passed, ${this.failures.length} FAILED`);
    for (const failure of this.failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

/** Read the built manifest. */
export const readManifest = (dist) => {
  const path = resolve(dist, 'manifest.webmanifest');
  if (!existsSync(path)) throw new Error(`manifest not found at ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
};

/** The PNG header of a file, used to check the icon signature. */
export const pngSize = (path) => {
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 4).toString('hex');
  if (signature !== '89504e47') throw new Error(`${path} is not a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};
