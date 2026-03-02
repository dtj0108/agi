#!/usr/bin/env node
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const targetUrl = new URL('../dist/index.js', import.meta.url);
const targetPath = fileURLToPath(targetUrl);

console.warn('[DEPRECATED] Running `node src/index.js` is temporary compatibility only. Use `npm start` (dist) or `npm run start:dev` (tsx).');

if (!existsSync(targetPath)) {
  console.error('Build output missing at dist/index.js. Run `npm run build` first.');
  process.exit(1);
}

await import(targetUrl.href);
