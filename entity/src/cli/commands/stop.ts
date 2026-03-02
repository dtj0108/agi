/**
 * entity stop
 *
 * Stop the Entity daemon.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

export default async function stop(args: any, projectRoot: any) {
  const os = platform();

  // Try system daemon first
  if (os === 'darwin') {
    const plistPath = join(homedir(), 'Library', 'LaunchAgents', 'com.entity.daemon.plist');
    if (existsSync(plistPath)) {
      console.log('Stopping via launchctl...');
      const proc = spawn('launchctl', ['stop', 'com.entity.daemon'], { stdio: 'inherit' });
      await new Promise((resolve: any) => proc.on('close', resolve));
      console.log('Entity daemon stopped.');
      return;
    }
  } else if (os === 'linux') {
    const servicePath = join(homedir(), '.config', 'systemd', 'user', 'entity.service');
    if (existsSync(servicePath)) {
      console.log('Stopping via systemctl...');
      const proc = spawn('systemctl', ['--user', 'stop', 'entity'], { stdio: 'inherit' });
      await new Promise((resolve: any) => proc.on('close', resolve));
      console.log('Entity daemon stopped.');
      return;
    }
  }

  // Fall back to PID file
  const pidFile = join(homedir(), '.entity', 'entity.pid');
  if (!existsSync(pidFile)) {
    console.log('Entity is not running (no PID file found).');
    return;
  }

  const pid = parseInt(readFileSync(pidFile, 'utf-8').trim());

  try {
    // Check if process exists
    process.kill(pid, 0);

    // Send SIGTERM
    console.log(`Stopping Entity (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');

    // Wait for process to exit
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((resolve: any) => setTimeout(resolve, 100));
      try {
        process.kill(pid, 0);
        attempts++;
      } catch {
        // Process exited
        break;
      }
    }

    // Force kill if still running
    try {
      process.kill(pid, 0);
      console.log('Force killing...');
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already dead
    }

    console.log('Entity stopped.');
  } catch (err: any) {
    if (err.code === 'ESRCH') {
      console.log('Entity was not running.');
    } else {
      throw err;
    }
  }

  // Clean up PID file
  try {
    unlinkSync(pidFile);
  } catch {
    // Ignore
  }
}
