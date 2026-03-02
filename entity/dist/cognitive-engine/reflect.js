/**
 * Reflect Phase
 *
 * Phase 6 of the cognitive loop.
 * Evaluates what happened and generates reflection.
 */
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { REFLECT_SCHEMA } from './schemas.js';
export class ReflectPhase {
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
     * Execute the reflect phase
     */
    async execute(context, thought, plan, observations) {
        // Build the prompt
        const systemPrompt = this.promptBuilder.buildSystemPrompt(context, 'reflect');
        const messages = this.promptBuilder.buildReflectMessages(thought, plan, observations);
        // Call LLM
        const result = await this.llm.completeJSON(systemPrompt, messages, REFLECT_SCHEMA, {
            phase: 'reflect',
            fallbackFactory: () => (this.fallbackFactory
                ? this.fallbackFactory(context, thought, plan, observations)
                : {
                    reflection: 'Fallback reflection',
                    emotionalUpdate: {
                        primary: { emotion: 'neutral', delta: 0 },
                        secondary: null,
                    },
                    goalUpdate: null,
                    skillLearned: null,
                    valueAlignment: 0,
                    lessonsLearned: [],
                }),
        });
        const reflection = result.parsed;
        // Validate and normalize
        const normalized = {
            reflection: reflection.reflection || '',
            emotionalUpdate: this.normalizeEmotionalUpdate(reflection.emotionalUpdate),
            goalUpdate: reflection.goalUpdate || null,
            skillLearned: reflection.skillLearned || null,
            skillAuthored: reflection.skillAuthored || null,
            valueAlignment: this.clampValue(reflection.valueAlignment, -1, 1),
            lessonsLearned: Array.isArray(reflection.lessonsLearned)
                ? reflection.lessonsLearned
                : [],
        };
        // Save reflection to file
        await this.saveReflection(normalized, thought, plan, observations);
        return normalized;
    }
    /**
     * Normalize emotional update values
     */
    normalizeEmotionalUpdate(update) {
        if (!update) {
            return {
                primary: { emotion: 'neutral', delta: 0 },
                secondary: null,
            };
        }
        return {
            primary: {
                emotion: update.primary?.emotion || 'neutral',
                delta: this.clampValue(update.primary?.delta, -1, 1),
            },
            secondary: update.secondary ? {
                emotion: update.secondary.emotion || 'neutral',
                delta: this.clampValue(update.secondary.delta, -1, 1),
            } : null,
        };
    }
    /**
     * Clamp a value to a range
     */
    clampValue(value, min, max) {
        if (typeof value !== 'number')
            return 0;
        return Math.max(min, Math.min(max, value));
    }
    /**
     * Save reflection to mind directory
     */
    async saveReflection(reflection, thought, plan, observations) {
        const timestamp = new Date().toISOString();
        const filename = `${timestamp.replace(/[:.]/g, '-')}.md`;
        const reflectionPath = join(this.mindPath, 'thoughts/reflections', filename);
        // Ensure directory exists
        await mkdir(dirname(reflectionPath), { recursive: true });
        const content = `# Reflection — ${timestamp}

## Context
Stimulus: ${thought.actionIntent || 'No specific action intent'}
Plan Goal: ${plan?.goal || 'No plan'}

## What Happened
${observations?.length > 0
            ? observations.map((o) => `- ${o.tool}: ${o.success ? 'Success' : 'Failed'} - ${o.intent}`).join('\n')
            : 'No actions were taken'}

## Reflection
${reflection.reflection}

## Lessons Learned
${reflection.lessonsLearned.map((l) => `- ${l}`).join('\n') || '- None'}

## Value Alignment Score: ${reflection.valueAlignment}

## Emotional State After
${reflection.emotionalUpdate.primary.emotion} (${reflection.emotionalUpdate.primary.delta > 0 ? '+' : ''}${reflection.emotionalUpdate.primary.delta})
`;
        await writeFile(reflectionPath, content);
    }
}
//# sourceMappingURL=reflect.js.map