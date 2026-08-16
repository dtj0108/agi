#!/usr/bin/env node
/**
 * Entity CLI
 *
 * Command-line interface for managing the Entity daemon.
 *
 * Commands:
 *   entity start       Start the daemon
 *   entity stop        Stop the daemon
 *   entity restart     Restart the daemon
 *   entity status      Show status
 *   entity chat        Interactive conversation
 *   entity doctor      Health check
 *   entity logs        Show thought stream
 *   entity thoughts    Alias for logs
 *   entity goals       Show active goals
 *   entity emotions    Show emotional state
 *   entity rollback    Rollback mind to git commit
 *   entity history     Show mind git history
 *   entity reset       Factory reset
 *   entity login       Sign in using local OAuth
 *   entity logout      Clear local OAuth credentials
 *   entity auth-status Show auth source/status
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
// Parse command
const [, , command, ...args] = process.argv;
// Help text
const HELP = `
Entity CLI

Usage:
  entity <command> [options]

Commands:
  start              Start the entity daemon
  stop               Stop the entity daemon
  restart            Restart the entity daemon
  status             Show current status (emotions, goals, cycles)
  chat               Start interactive conversation
  doctor             Run health checks
  logs [--follow]    Show thought stream (--follow to tail)
  thoughts           Alias for logs
  goals              Show active goals
  emotions           Show emotional state
  rollback <hash>    Rollback mind to a git commit
  history            Show git history for mind
  reset              Factory reset (wipes mind, re-runs onboarding)
  login              Sign in using local OAuth flow
  logout             Clear local OAuth credentials
  auth-status        Show local auth status

Options:
  --help, -h         Show this help message
  --version, -v      Show version

Examples:
  entity start       # Start the daemon
  entity chat        # Talk to your entity
  entity logs -f     # Follow the thought stream
  entity rollback abc123  # Rollback to commit
`;
async function main() {
    // Handle flags
    if (!command || command === '--help' || command === '-h') {
        console.log(HELP);
        process.exit(0);
    }
    if (command === '--version' || command === '-v') {
        const pkg = await import(join(PROJECT_ROOT, 'package.json'), { with: { type: 'json' } });
        console.log(`entity v${pkg.default.version}`);
        process.exit(0);
    }
    // Route to command handlers
    try {
        switch (command) {
            case 'start':
                await (await import('./commands/start.js')).default(args, PROJECT_ROOT);
                break;
            case 'stop':
                await (await import('./commands/stop.js')).default(args, PROJECT_ROOT);
                break;
            case 'restart':
                await (await import('./commands/stop.js')).default(args, PROJECT_ROOT);
                await (await import('./commands/start.js')).default(args, PROJECT_ROOT);
                break;
            case 'status':
                await (await import('./commands/status.js')).default(args, PROJECT_ROOT);
                break;
            case 'chat':
                await (await import('./commands/chat.js')).default(args, PROJECT_ROOT);
                break;
            case 'doctor':
                await (await import('./commands/doctor.js')).default(args, PROJECT_ROOT);
                break;
            case 'logs':
            case 'thoughts':
                await (await import('./commands/logs.js')).default(args, PROJECT_ROOT);
                break;
            case 'goals':
                await (await import('./commands/goals.js')).default(args, PROJECT_ROOT);
                break;
            case 'emotions':
                await (await import('./commands/emotions.js')).default(args, PROJECT_ROOT);
                break;
            case 'rollback':
                await (await import('./commands/rollback.js')).default(args, PROJECT_ROOT);
                break;
            case 'history':
                await (await import('./commands/history.js')).default(args, PROJECT_ROOT);
                break;
            case 'reset':
                await (await import('./commands/reset.js')).default(args, PROJECT_ROOT);
                break;
            case 'login':
                await (await import('./commands/login.js')).default(args);
                break;
            case 'logout':
                await (await import('./commands/logout.js')).default();
                break;
            case 'auth-status':
                await (await import('./commands/auth-status.js')).default();
                break;
            default:
                console.error(`Unknown command: ${command}`);
                console.log('Run "entity --help" for usage.');
                process.exit(1);
        }
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map