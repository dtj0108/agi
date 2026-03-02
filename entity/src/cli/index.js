#!/usr/bin/env node
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const targetUrl = new URL('../../dist/cli/index.js', import.meta.url);
const targetPath = fileURLToPath(targetUrl);

console.warn('[DEPRECATED] Running `node src/cli/index.js` is temporary compatibility only. Use the built `entity` binary or `node dist/cli/index.js`.');

if (!existsSync(targetPath)) {
  console.error('Build output missing at dist/cli/index.js. Run `npm run build` first.');
  process.exit(1);
}

await import(targetUrl.href);
