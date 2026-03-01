/**
 * entity status
 *
 * Show current Entity status.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export default async function status(args, projectRoot) {
  const mindPath = join(projectRoot, 'mind');

  // Check if entity is running
  let running = false;
  let pid = null;
  const pidFile = join(homedir(), '.entity', 'entity.pid');

  if (existsSync(pidFile)) {
    pid = parseInt(readFileSync(pidFile, 'utf-8').trim());
    try {
      process.kill(pid, 0);
      running = true;
    } catch {
      running = false;
    }
  }

  console.log('');
  console.log('═'.repeat(50));
  console.log('  Entity Status');
  console.log('═'.repeat(50));
  console.log('');

  // Running status
  if (running) {
    console.log(`  Status: \x1b[32mRunning\x1b[0m (PID: ${pid})`);
  } else {
    console.log('  Status: \x1b[31mStopped\x1b[0m');
  }

  // Check if mind exists
  if (!existsSync(mindPath)) {
    console.log('  Mind: \x1b[31mNot initialized\x1b[0m');
    console.log('');
    console.log('  Run "npm run onboard" to set up your entity.');
    console.log('');
    return;
  }

  // Read emotional state
  try {
    const stateJson = readFileSync(join(mindPath, 'emotions/state.json'), 'utf-8');
    const state = JSON.parse(stateJson);

    console.log(`  Emotion: ${state.primary} (${(state.intensity * 100).toFixed(0)}%)`);
    if (state.secondary) {
      console.log(`           ${state.secondary} (${(state.secondaryIntensity * 100).toFixed(0)}%)`);
    }
    console.log(`  Momentum: ${state.momentum}`);
  } catch {
    console.log('  Emotion: Unable to read');
  }

  // Read context
  try {
    const context = readFileSync(join(mindPath, 'world/context.md'), 'utf-8');
    const lines = context.split('\n');
    for (const line of lines) {
      if (line.includes('**My name**:')) {
        console.log(`  Name: ${line.split(':').slice(1).join(':').trim()}`);
      }
      if (line.includes('**Autonomy level**:')) {
        console.log(`  Autonomy: ${line.split(':').slice(1).join(':').trim()}`);
      }
    }
  } catch {
    // Ignore
  }

  // Read config to show LLM
  try {
    const configPath = join(projectRoot, 'config', 'local.js');
    if (existsSync(configPath)) {
      const configModule = await import(configPath);
      const config = configModule.default;
      console.log(`  LLM: ${config.llm?.model || 'unknown'}`);
    }
  } catch {
    // Ignore
  }

  // Count goals
  try {
    const goals = readFileSync(join(mindPath, 'goals/active.md'), 'utf-8');
    const goalCount = (goals.match(/^## Goal/gm) || []).length;
    console.log(`  Active Goals: ${goalCount}`);
  } catch {
    // Ignore
  }

  console.log('');
  console.log('─'.repeat(50));
  console.log('');
  console.log('  Commands:');
  console.log('    entity start     Start the daemon');
  console.log('    entity chat      Interactive conversation');
  console.log('    entity logs      View thought stream');
  console.log('    entity doctor    Run health checks');
  console.log('');
}
