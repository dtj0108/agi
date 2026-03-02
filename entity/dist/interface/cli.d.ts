/**
 * CLI Interface
 *
 * Interactive readline REPL for local interaction.
 */
import { EventEmitter } from 'events';
export declare class CLI extends EventEmitter {
    autonomy: any;
    cognitiveEngine: any;
    config: any;
    mindServer: any;
    paused: any;
    rl: any;
    constructor(config: any, cognitiveEngine: any, mindServer: any, autonomy?: any);
    /**
     * Start the CLI interface
     */
    start(): void;
    /**
     * Handle a CLI command
     */
    handleCommand(input: any): Promise<void>;
    /**
     * Handle a user message
     */
    handleMessage(content: any): Promise<void>;
    /**
     * Print help
     */
    printHelp(): void;
    /**
     * Show entity status
     */
    showStatus(): Promise<void>;
    /**
     * Show recent thoughts
     */
    showThoughts(): Promise<void>;
    /**
     * Show active goals
     */
    showGoals(): Promise<void>;
    /**
     * Show emotional state
     */
    showEmotions(): Promise<void>;
    /**
     * Print a thought from the stream
     */
    printThought(content: any): void;
    /**
     * Print text
     */
    print(text: any): void;
    /**
     * Stop the CLI
     */
    stop(): void;
}
//# sourceMappingURL=cli.d.ts.map