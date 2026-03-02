/**
 * CLI Interface
 *
 * Interactive readline REPL for local interaction.
 */
import * as readline from 'readline';
import { EventEmitter } from 'events';
// ANSI color codes
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};
export class CLI extends EventEmitter {
    autonomy;
    cognitiveEngine;
    config;
    mindServer;
    paused;
    rl;
    constructor(config, cognitiveEngine, mindServer, autonomy = null) {
        super();
        this.config = config;
        this.cognitiveEngine = cognitiveEngine;
        this.mindServer = mindServer;
        this.autonomy = autonomy;
        this.rl = null;
        this.paused = false;
    }
    /**
     * Start the CLI interface
     */
    start() {
        // Don't start CLI if running as daemon
        if (process.env.ENTITY_DAEMON === '1') {
            return;
        }
        // Don't start if stdin is not a TTY
        if (!process.stdin.isTTY) {
            return;
        }
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: `${COLORS.cyan}entity>${COLORS.reset} `,
        });
        this.print(`\n${COLORS.bright}Entity CLI${COLORS.reset}`);
        this.print(`Type a message or use /help for commands\n`);
        this.rl.prompt();
        this.rl.on('line', async (line) => {
            const input = line.trim();
            if (!input) {
                this.rl.prompt();
                return;
            }
            if (input.startsWith('/')) {
                await this.handleCommand(input);
            }
            else {
                await this.handleMessage(input);
            }
            this.rl.prompt();
        });
        this.rl.on('close', () => {
            this.print('\nGoodbye.');
            this.emit('exit');
        });
        // Subscribe to thought stream
        this.cognitiveEngine.on('thought', (data) => {
            this.printThought(data.content);
        });
    }
    /**
     * Handle a CLI command
     */
    async handleCommand(input) {
        const [cmd, ...args] = input.slice(1).split(/\s+/);
        switch (cmd) {
            case 'help':
                this.printHelp();
                break;
            case 'status':
                await this.showStatus();
                break;
            case 'thoughts':
                await this.showThoughts();
                break;
            case 'goals':
                await this.showGoals();
                break;
            case 'emotions':
                await this.showEmotions();
                break;
            case 'pause':
                this.paused = true;
                this.cognitiveEngine.pause();
                this.emit('pause');
                this.print(`${COLORS.yellow}Cognitive loop paused${COLORS.reset}`);
                break;
            case 'resume':
                this.paused = false;
                this.cognitiveEngine.resume();
                this.emit('resume');
                this.print(`${COLORS.green}Cognitive loop resumed${COLORS.reset}`);
                break;
            case 'go':
                if (!this.autonomy) {
                    this.print(`${COLORS.red}Autonomy controller unavailable${COLORS.reset}`);
                    break;
                }
                this.autonomy.setMode('go', { source: 'cli' });
                this.print(`${COLORS.green}Autonomy mode set to go${COLORS.reset}`);
                break;
            case 'stop':
                if (!this.autonomy) {
                    this.print(`${COLORS.red}Autonomy controller unavailable${COLORS.reset}`);
                    break;
                }
                this.autonomy.setMode('manual', { source: 'cli' });
                this.print(`${COLORS.yellow}Autonomy mode set to manual${COLORS.reset}`);
                break;
            case 'rollback':
                if (args[0]) {
                    try {
                        await this.mindServer.rollback(args[0]);
                        this.print(`${COLORS.yellow}Rolled back to ${args[0]}${COLORS.reset}`);
                    }
                    catch (err) {
                        this.print(`${COLORS.red}Rollback failed: ${err.message}${COLORS.reset}`);
                    }
                }
                else {
                    this.print(`${COLORS.red}Usage: /rollback <commit-hash>${COLORS.reset}`);
                }
                break;
            case 'kill':
                this.print(`${COLORS.red}Shutting down...${COLORS.reset}`);
                this.emit('kill');
                break;
            case 'clear':
                console.clear();
                break;
            default:
                this.print(`${COLORS.red}Unknown command: /${cmd}${COLORS.reset}`);
                this.print(`Type /help for available commands`);
        }
    }
    /**
     * Handle a user message
     */
    async handleMessage(content) {
        if (this.paused) {
            this.print(`${COLORS.yellow}Entity is paused. Use /resume to continue.${COLORS.reset}`);
            return;
        }
        this.print(`${COLORS.dim}Processing...${COLORS.reset}`);
        try {
            const result = await this.cognitiveEngine.runCycle({
                type: 'user_message',
                content,
                metadata: { source: 'cli' },
            });
            this.print('');
            if (result.userResponse) {
                this.print(`${COLORS.green}${result.userResponse}${COLORS.reset}`);
            }
            else {
                this.print(`${COLORS.dim}(No response generated)${COLORS.reset}`);
            }
            this.print('');
        }
        catch (err) {
            this.print(`${COLORS.red}Error: ${err.message}${COLORS.reset}`);
        }
    }
    /**
     * Print help
     */
    printHelp() {
        const help = `
${COLORS.bright}Available Commands:${COLORS.reset}
  /status     - Show current emotional state and goals
  /thoughts   - Show recent thought stream
  /goals      - Show active goals
  /emotions   - Show emotional state details
  /pause      - Pause cognitive loop
  /resume     - Resume cognitive loop
  /go         - Start continuous autonomous mode
  /stop       - Stop continuous autonomous mode (manual mode)
  /rollback   - Rollback mind to a git commit
  /kill       - Shut down entity
  /clear      - Clear screen
  /help       - Show this help

${COLORS.dim}Everything else is sent as a message to the entity.${COLORS.reset}
    `;
        this.print(help);
    }
    /**
     * Show entity status
     */
    async showStatus() {
        const status = await this.cognitiveEngine.getStatus();
        const autonomy = this.autonomy?.getStatus?.();
        this.print(`
${COLORS.bright}Entity Status${COLORS.reset}
  Cycle Count: ${status.cycleCount}
  Paused: ${this.paused}
  Safe Mode: ${status.safeMode}
  Autonomy Mode: ${autonomy?.mode || 'unknown'}
  Primary Emotion: ${status.emotions?.primary || 'unknown'} (${((status.emotions?.intensity || 0) * 100).toFixed(0)}%)
  Uptime: ${Math.floor(process.uptime() / 60)} minutes
    `);
    }
    /**
     * Show recent thoughts
     */
    async showThoughts() {
        const thoughts = await this.cognitiveEngine.getRecentThoughts(5);
        this.print(`\n${COLORS.bright}Recent Thoughts:${COLORS.reset}`);
        if (thoughts.length === 0) {
            this.print(`  ${COLORS.dim}No recent thoughts${COLORS.reset}`);
        }
        else {
            for (const thought of thoughts) {
                this.print(`  ${COLORS.dim}---${COLORS.reset}`);
                this.print(`  ${thought.content.slice(0, 200)}${thought.content.length > 200 ? '...' : ''}`);
            }
        }
        this.print('');
    }
    /**
     * Show active goals
     */
    async showGoals() {
        try {
            const goals = await this.mindServer.readFile('goals/active.md');
            this.print(`\n${COLORS.bright}Active Goals:${COLORS.reset}`);
            this.print(goals);
        }
        catch {
            this.print(`${COLORS.red}Could not read goals${COLORS.reset}`);
        }
    }
    /**
     * Show emotional state
     */
    async showEmotions() {
        try {
            const emotionsRaw = await this.mindServer.readFile('emotions/state.json');
            const state = JSON.parse(emotionsRaw);
            this.print(`
${COLORS.bright}Emotional State:${COLORS.reset}
  Primary: ${COLORS.magenta}${state.primary}${COLORS.reset} (${(state.intensity * 100).toFixed(0)}%)
  Secondary: ${state.secondary || 'none'} (${((state.secondaryIntensity || 0) * 100).toFixed(0)}%)
  Momentum: ${state.momentum}
  Source: ${state.source}
      `);
        }
        catch {
            this.print(`${COLORS.red}Could not read emotional state${COLORS.reset}`);
        }
    }
    /**
     * Print a thought from the stream
     */
    printThought(content) {
        // Don't interrupt the prompt too much
        const short = content.slice(0, 100);
        this.print(`\n${COLORS.dim}[thought]${COLORS.reset} ${short}${content.length > 100 ? '...' : ''}`);
    }
    /**
     * Print text
     */
    print(text) {
        process.stdout.write(text + '\n');
    }
    /**
     * Stop the CLI
     */
    stop() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }
}
//# sourceMappingURL=cli.js.map