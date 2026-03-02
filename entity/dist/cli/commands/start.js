/**
 * entity start
 *
 * Start the Entity daemon.
 */
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
export default async function start(args, projectRoot) {
    const os = platform();
    // Check if mind exists
    const mindPath = join(projectRoot, 'mind');
    if (!existsSync(mindPath)) {
        console.error('Mind directory not found. Run "npm run onboard" first.');
        process.exit(1);
    }
    // Check if daemon is already running
    const pidFile = join(homedir(), '.entity', 'entity.pid');
    if (existsSync(pidFile)) {
        const pid = readFileSync(pidFile, 'utf-8').trim();
        try {
            process.kill(parseInt(pid), 0);
            console.log(`Entity is already running (PID: ${pid})`);
            return;
        }
        catch {
            // Process not running, continue
        }
    }
    // Try to use system daemon if installed
    if (os === 'darwin') {
        const plistPath = join(homedir(), 'Library', 'LaunchAgents', 'com.entity.daemon.plist');
        if (existsSync(plistPath)) {
            console.log('Starting via launchctl...');
            const proc = spawn('launchctl', ['start', 'com.entity.daemon'], { stdio: 'inherit' });
            proc.on('close', (code) => {
                if (code === 0) {
                    console.log('Entity daemon started.');
                }
                else {
                    console.error('Failed to start daemon. Try running manually: npm start');
                }
            });
            return;
        }
    }
    else if (os === 'linux') {
        const servicePath = join(homedir(), '.config', 'systemd', 'user', 'entity.service');
        if (existsSync(servicePath)) {
            console.log('Starting via systemctl...');
            const proc = spawn('systemctl', ['--user', 'start', 'entity'], { stdio: 'inherit' });
            proc.on('close', (code) => {
                if (code === 0) {
                    console.log('Entity daemon started.');
                }
                else {
                    console.error('Failed to start daemon. Try running manually: npm start');
                }
            });
            return;
        }
    }
    // Fall back to spawning directly
    console.log('Starting Entity in background...');
    const logsDir = join(homedir(), '.entity', 'logs');
    const { mkdirSync, writeFileSync } = await import('fs');
    mkdirSync(logsDir, { recursive: true });
    const out = await import('fs').then((fs) => fs.openSync(join(logsDir, 'stdout.log'), 'a'));
    const err = await import('fs').then((fs) => fs.openSync(join(logsDir, 'stderr.log'), 'a'));
    const indexPath = join(projectRoot, 'src', 'index.js');
    const child = spawn(process.execPath, [indexPath], {
        detached: true,
        stdio: ['ignore', out, err],
        cwd: projectRoot,
        env: { ...process.env, ENTITY_DAEMON: '1' },
    });
    // Save PID
    writeFileSync(pidFile, String(child.pid ?? 0));
    child.unref();
    console.log(`Entity started (PID: ${child.pid})`);
    console.log(`Logs: ${logsDir}`);
}
//# sourceMappingURL=start.js.map