#!/usr/bin/env node
/**
 * Start Entity as Background Process
 *
 * Runs the entity in the background with nohup-style behavior.
 * Logs are written to logs/entity.log
 *
 * Usage: npm run start-daemon
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Ensure logs directory exists
const logsDir = join(projectRoot, 'logs');
mkdirSync(logsDir, { recursive: true });

const distEntry = join(projectRoot, 'dist/index.js');
if (!existsSync(distEntry)) {
  console.error('Build output missing at dist/index.js. Run `npm run build` first.');
  process.exit(1);
}

// Start the entity process
const child = spawn('node', [distEntry], {
  detached: true,
  stdio: 'ignore',
  cwd: projectRoot,
  env: {
    ...process.env,
    ENTITY_DAEMON: '1',
  },
});

// Write PID file for later management
const pidFile = join(projectRoot, 'entity.pid');
writeFileSync(pidFile, String(child.pid));

child.unref();

console.log(`Entity started in background. PID: ${child.pid}`);
console.log(`PID file: ${pidFile}`);
console.log(`Logs: ${join(logsDir, 'entity.log')}`);
console.log('\nTo stop: kill $(cat entity.pid)');
