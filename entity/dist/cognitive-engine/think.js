/**
 * Think Phase
 *
 * Phase 2 of the cognitive loop.
 * Processes stimulus and generates thoughts.
 */
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { THINK_SCHEMA } from './schemas.js';
export class ThinkPhase {
    fallbackFactory;
    llm;
    mindPath;
    promptBuilder;
    constructor(llm, promptBuilder, mindPath, options = {}) {
        this.llm = llm;
        this.promptBuilder = promptBuilder;
        this.mindPath = mindPath;
        this.fallbackFactory = options.fallbackFactory || null;
    }
    /**
     * Execute the think phase
     */
    async execute(context, stimulus) {
        // Build the prompt
        const systemPrompt = this.promptBuilder.buildSystemPrompt(context, 'think');
        const messages = this.promptBuilder.buildMessages(stimulus);
        // Call LLM
        const result = await this.llm.completeJSON(systemPrompt, messages, THINK_SCHEMA, {
            phase: 'think',
            fallbackFactory: () => (this.fallbackFactory
                ? this.fallbackFactory(context, stimulus)
                : {
                    thoughts: '',
                    needsAction: false,
                    userResponse: null,
                    emotionalShift: {
                        primary: { emotion: 'neutral', delta: 0 },
                        secondary: null,
                    },
                    actionIntent: null,
                }),
        });
        const thought = result.parsed;
        // Validate and normalize the response
        const normalized = {
            thoughts: thought.thoughts || '',
            needsAction: Boolean(thought.needsAction),
            userResponse: thought.userResponse || null,
            emotionalShift: this.normalizeEmotionalShift(thought.emotionalShift),
            actionIntent: thought.actionIntent || null,
        };
        // Append thoughts to stream
        await this.appendToThoughtStream(normalized.thoughts, 'THINK');
        return normalized;
    }
    /**
     * Normalize emotional shift values
     */
    normalizeEmotionalShift(shift) {
        if (!shift) {
            return {
                primary: { emotion: 'neutral', delta: 0 },
                secondary: null,
            };
        }
        return {
            primary: {
                emotion: shift.primary?.emotion || 'neutral',
                delta: this.clampDelta(shift.primary?.delta),
            },
            secondary: shift.secondary ? {
                emotion: shift.secondary.emotion || 'neutral',
                delta: this.clampDelta(shift.secondary.delta),
            } : null,
        };
    }
    /**
     * Clamp delta value to -1.0 to 1.0
     */
    clampDelta(delta) {
        if (typeof delta !== 'number')
            return 0;
        return Math.max(-1, Math.min(1, delta));
    }
    /**
     * Append an entry to the thought stream
     */
    async appendToThoughtStream(thoughts, phase) {
        const streamPath = join(this.mindPath, 'thoughts/stream.md');
        const timestamp = new Date().toISOString();
        const entry = `
---
[${timestamp}] — ${phase}

${thoughts}
`;
        await appendFile(streamPath, entry);
    }
}
//# sourceMappingURL=think.js.map