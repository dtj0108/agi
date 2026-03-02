/**
 * entity chat
 *
 * Interactive conversation with the Entity.
 */

import * as readline from 'readline';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import WebSocket from 'ws';

export default async function chat(args: any, projectRoot: any) {
  const mindPath = join(projectRoot, 'mind');

  // Check if mind exists
  if (!existsSync(mindPath)) {
    console.error('Mind directory not found. Run "npm run onboard" first.');
    process.exit(1);
  }

  // Load config
  let config: any;
  try {
    const configPath = join(projectRoot, 'config', 'local.js');
    if (existsSync(configPath)) {
      const configModule = await import(configPath);
      config = configModule.default;
    } else {
      const defaultConfigPath = join(projectRoot, 'config', 'default.js');
      const configModule = await import(defaultConfigPath);
      config = configModule.default;
    }
  } catch (err: any) {
    console.error('Failed to load config:', err.message);
    process.exit(1);
  }

  // Get entity name
  const entityName = config?.entity?.name || 'Entity';

  // Check if daemon is running
  const pidFile = join(homedir(), '.entity', 'entity.pid');
  let daemonRunning = false;

  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim());
    try {
      process.kill(pid, 0);
      daemonRunning = true;
    } catch {
      daemonRunning = false;
    }
  }

  if (!daemonRunning) {
    console.log(`${entityName} is not running. Starting in foreground mode...`);
    console.log('(Use "entity start" to run as daemon, then "entity chat" to connect)\n');

    // Run directly
    // @ts-expect-error TODO(ts-migration): TS(2339): Property 'main' does not exist on type 'typeof imp... Remove this comment to see the full error message
    const { main } = await import('../../index.js');
    return;
  }

  // Connect via WebSocket
  const wsPort = config?.interface?.wsPort || 3001;
  const wsHost = config?.interface?.host || '127.0.0.1';
  const wsUrl = `ws://${wsHost}:${wsPort}`;

  console.log(`Connecting to ${entityName}...`);

  const ws = new WebSocket(wsUrl);

  ws.on('error', (err: any) => {
    console.error(`Connection failed: ${err.message}`);
    console.log('Make sure the entity daemon is running: entity start');
    process.exit(1);
  });

  ws.on('open', () => {
    console.log(`Connected to ${entityName}`);
    console.log('Type a message or /help for commands. Ctrl+C to exit.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `\x1b[36myou>\x1b[0m `,
    });

    rl.prompt();

    rl.on('line', (line: any) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      if (input === '/quit' || input === '/exit') {
        ws.close();
        process.exit(0);
      }

      if (input === '/help') {
        console.log('\nCommands:');
        console.log('  /status    Show entity status');
        console.log('  /pause     Pause cognitive loop');
        console.log('  /resume    Resume cognitive loop');
        console.log('  /quit      Exit chat');
        console.log('\nEverything else is sent as a message.\n');
        rl.prompt();
        return;
      }

      // Send message
      ws.send(JSON.stringify({
        type: 'message',
        content: input,
      }));
    });

    rl.on('close', () => {
      ws.close();
      process.exit(0);
    });

    // Handle responses
    ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'response':
            console.log(`\n\x1b[32m${entityName}>\x1b[0m ${msg.content}\n`);
            rl.prompt();
            break;

          case 'thought':
            console.log(`\x1b[2m[thought] ${msg.content.slice(0, 80)}${msg.content.length > 80 ? '...' : ''}\x1b[0m`);
            break;

          case 'emotion':
            console.log(`\x1b[2m[emotion] ${msg.primary} (${(msg.intensity * 100).toFixed(0)}%)\x1b[0m`);
            break;

          case 'error':
            console.error(`\x1b[31mError: ${msg.message}\x1b[0m`);
            rl.prompt();
            break;

          default:
            // Ignore unknown message types
            break;
        }
      } catch {
        // Ignore parse errors
      }
    });
  });

  ws.on('close', () => {
    console.log('\nDisconnected.');
    process.exit(0);
  });
}
