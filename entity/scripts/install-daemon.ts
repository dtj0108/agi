#!/usr/bin/env node
/**
 * Entity Daemon Installer
 *
 * Installs Entity as a background service on macOS (launchd) or Linux (systemd).
 * Can be run independently of the onboarding wizard.
 *
 * Usage:
 *   tsx scripts/install-daemon.ts
 *   tsx scripts/install-daemon.ts --uninstall
 *   tsx scripts/install-daemon.ts --status
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { homedir, platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(join(__dirname, '..'));
const DIST_ENTRY = join(PROJECT_ROOT, 'dist', 'index.js');

const PLIST_ID = 'com.entity.daemon';
const SERVICE_ID = 'entity';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    uninstall: args.includes('--uninstall'),
    status: args.includes('--status'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function assertDistRuntime() {
  if (!existsSync(DIST_ENTRY)) {
    console.error('Build output missing at dist/index.js. Run `npm run build` first.');
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Entity Daemon Installer

Usage:
  tsx scripts/install-daemon.ts [options]

Options:
  --status      Check if daemon is installed and running
  --uninstall   Remove the daemon service
  --help, -h    Show this help message

Examples:
  tsx scripts/install-daemon.ts              # Install daemon
  tsx scripts/install-daemon.ts --status     # Check status
  tsx scripts/install-daemon.ts --uninstall  # Remove daemon
`);
}

/**
 * macOS launchd installation
 */
function installLaunchd() {
  assertDistRuntime();
  const home = homedir();
  const plistDir = join(home, 'Library', 'LaunchAgents');
  const plistPath = join(plistDir, `${PLIST_ID}.plist`);

  console.log('Installing Entity as macOS launch agent...');

  // Ensure directory exists
  mkdirSync(plistDir, { recursive: true });

  // Read API key from environment or config
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '';

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_ID}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${PROJECT_ROOT}/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>ENTITY_DAEMON</key>
        <string>1</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_ROOT}/logs/entity.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_ROOT}/logs/entity-error.log</string>
</dict>
</plist>`;

  // Create logs directory
  mkdirSync(join(PROJECT_ROOT, 'logs'), { recursive: true });

  // Write plist
  writeFileSync(plistPath, plist);
  console.log(`Created: ${plistPath}`);

  // Load the service
  try {
    execSync(`launchctl load ${plistPath}`, { stdio: 'inherit' });
    console.log('Service loaded successfully.');
    console.log(`
Entity is now running as a background service.

Useful commands:
  launchctl list | grep entity       # Check if running
  launchctl stop ${PLIST_ID}         # Stop service
  launchctl start ${PLIST_ID}        # Start service
  launchctl unload ${plistPath}      # Unload service
  tail -f ${PROJECT_ROOT}/logs/entity.log  # View logs
`);
  } catch (error: any) {
    console.error('Failed to load service:', error.message);
    console.log(`
Service file was created but not loaded.
You can manually load it with:
  launchctl load ${plistPath}
`);
  }
}

function uninstallLaunchd() {
  const home = homedir();
  const plistPath = join(home, 'Library', 'LaunchAgents', `${PLIST_ID}.plist`);

  console.log('Removing Entity macOS launch agent...');

  if (!existsSync(plistPath)) {
    console.log('No launch agent found.');
    return;
  }

  try {
    execSync(`launchctl unload ${plistPath}`, { stdio: 'inherit' });
    console.log('Service unloaded.');
  } catch (error: any) {
    // Service might not be loaded
  }

  unlinkSync(plistPath);
  console.log(`Removed: ${plistPath}`);
  console.log('Entity daemon uninstalled.');
}

function statusLaunchd() {
  const home = homedir();
  const plistPath = join(home, 'Library', 'LaunchAgents', `${PLIST_ID}.plist`);

  console.log('macOS Launch Agent Status:');
  console.log('─'.repeat(40));

  if (!existsSync(plistPath)) {
    console.log('Status: Not installed');
    console.log(`Plist: ${plistPath} (not found)`);
    return;
  }

  console.log(`Plist: ${plistPath} (exists)`);

  try {
    const result = execSync(`launchctl list | grep ${PLIST_ID}`, { encoding: 'utf8' });
    const parts = result.trim().split(/\s+/);
    const pid = parts[0];
    const status = parts[1];

    if (pid !== '-') {
      console.log(`Status: Running (PID: ${pid})`);
    } else if (status === '0') {
      console.log('Status: Loaded but not running');
    } else {
      console.log(`Status: Loaded (exit code: ${status})`);
    }
  } catch (error: any) {
    console.log('Status: Installed but not loaded');
  }
}

/**
 * Linux systemd installation
 */
function installSystemd() {
  assertDistRuntime();
  const home = homedir();
  const serviceDir = join(home, '.config', 'systemd', 'user');
  const servicePath = join(serviceDir, `${SERVICE_ID}.service`);

  console.log('Installing Entity as systemd user service...');

  // Ensure directory exists
  mkdirSync(serviceDir, { recursive: true });

  const service = `[Unit]
Description=Entity - File-based Conscious AI Framework
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
ExecStart=/usr/bin/node ${PROJECT_ROOT}/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=ENTITY_DAEMON=1

[Install]
WantedBy=default.target
`;

  writeFileSync(servicePath, service);
  console.log(`Created: ${servicePath}`);

  // Reload and enable
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    execSync(`systemctl --user enable ${SERVICE_ID}`, { stdio: 'inherit' });
    execSync(`systemctl --user start ${SERVICE_ID}`, { stdio: 'inherit' });

    console.log('Service installed and started.');
    console.log(`
Entity is now running as a background service.

Useful commands:
  systemctl --user status ${SERVICE_ID}    # Check status
  systemctl --user stop ${SERVICE_ID}      # Stop service
  systemctl --user start ${SERVICE_ID}     # Start service
  systemctl --user restart ${SERVICE_ID}   # Restart service
  journalctl --user -u ${SERVICE_ID} -f    # View logs
`);
  } catch (error: any) {
    console.error('Failed to start service:', error.message);
    console.log(`
Service file was created but not started.
You can manually start it with:
  systemctl --user daemon-reload
  systemctl --user enable ${SERVICE_ID}
  systemctl --user start ${SERVICE_ID}
`);
  }
}

function uninstallSystemd() {
  const home = homedir();
  const servicePath = join(home, '.config', 'systemd', 'user', `${SERVICE_ID}.service`);

  console.log('Removing Entity systemd user service...');

  if (!existsSync(servicePath)) {
    console.log('No systemd service found.');
    return;
  }

  try {
    execSync(`systemctl --user stop ${SERVICE_ID}`, { stdio: 'pipe' });
  } catch (error: any) {
    // Service might not be running
  }

  try {
    execSync(`systemctl --user disable ${SERVICE_ID}`, { stdio: 'pipe' });
  } catch (error: any) {
    // Service might not be enabled
  }

  unlinkSync(servicePath);
  execSync('systemctl --user daemon-reload', { stdio: 'pipe' });

  console.log(`Removed: ${servicePath}`);
  console.log('Entity daemon uninstalled.');
}

function statusSystemd() {
  const home = homedir();
  const servicePath = join(home, '.config', 'systemd', 'user', `${SERVICE_ID}.service`);

  console.log('Systemd User Service Status:');
  console.log('─'.repeat(40));

  if (!existsSync(servicePath)) {
    console.log('Status: Not installed');
    console.log(`Service file: ${servicePath} (not found)`);
    return;
  }

  console.log(`Service file: ${servicePath} (exists)`);

  try {
    const result = execSync(`systemctl --user is-active ${SERVICE_ID}`, { encoding: 'utf8' });
    console.log(`Status: ${result.trim()}`);
  } catch (error: any) {
    console.log('Status: inactive or failed');
  }

  try {
    const enabled = execSync(`systemctl --user is-enabled ${SERVICE_ID}`, { encoding: 'utf8' });
    console.log(`Enabled: ${enabled.trim()}`);
  } catch (error: any) {
    console.log('Enabled: no');
  }
}

// Main
const args = parseArgs();

if (args.help) {
  printHelp();
  process.exit(0);
}

const os = platform();

if (os === 'darwin') {
  if (args.status) {
    statusLaunchd();
  } else if (args.uninstall) {
    uninstallLaunchd();
  } else {
    installLaunchd();
  }
} else if (os === 'linux') {
  if (args.status) {
    statusSystemd();
  } else if (args.uninstall) {
    uninstallSystemd();
  } else {
    installSystemd();
  }
} else {
  console.error(`Unsupported platform: ${os}`);
  console.log('Supported platforms: darwin (macOS), linux');
  process.exit(1);
}
