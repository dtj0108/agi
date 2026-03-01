/**
 * Plan Phase
 *
 * Phase 3 of the cognitive loop.
 * Creates an action plan if needed.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PLAN_SCHEMA } from './schemas.js';

export class PlanPhase {
  constructor(llm, promptBuilder, mindPath, actionGateway, options = {}) {
    this.llm = llm;
    this.promptBuilder = promptBuilder;
    this.mindPath = mindPath;
    this.actionGateway = actionGateway;
    this.maxSteps = 10;
    this.fallbackFactory = options.fallbackFactory || null;
  }

  /**
   * Execute the plan phase
   */
  async execute(context, thought) {
    // If no action needed, return null
    if (!thought.needsAction) {
      return null;
    }

    // Build the prompt
    const systemPrompt = this.promptBuilder.buildSystemPrompt(context, 'plan');
    const messages = this.promptBuilder.buildPlanMessages(thought);

    // Call LLM
    const result = await this.llm.completeJSON(
      systemPrompt,
      messages,
      PLAN_SCHEMA,
      {
        phase: 'plan',
        fallbackFactory: () => (
          this.fallbackFactory
            ? this.fallbackFactory(context, thought)
            : {
              goal: thought.actionIntent || 'Unable to produce structured plan',
              steps: [],
              rollback: null,
              emotionalContext: 'fallback',
            }
        ),
      }
    );

    const plan = result.parsed;

    // Validate and normalize the plan
    const normalized = {
      planId: uuidv4(),
      goal: plan.goal || 'Unknown goal',
      steps: this.normalizeSteps(plan.steps || []),
      rollback: plan.rollback || null,
      emotionalContext: plan.emotionalContext || '',
      needsApproval: false,
      createdAt: new Date().toISOString(),
    };

    // Classify tiers for each step
    for (const step of normalized.steps) {
      step.tier = this.actionGateway.classifyTier({
        tool: step.tool,
        params: step.params,
      });

      // If any step is Tier 3, mark plan as needing approval
      if (step.tier === 3) {
        normalized.needsApproval = true;
      }
    }

    // Save plan to file
    await this.savePlan(normalized);

    return normalized;
  }

  /**
   * Normalize plan steps
   */
  normalizeSteps(steps) {
    // Limit to max steps
    const limited = steps.slice(0, this.maxSteps);

    return limited.map((step, index) => ({
      stepIndex: index,
      tool: step.tool || 'unknown',
      action: step.action || '',
      params: step.params || {},
      intent: step.intent || '',
      tier: 1, // Will be updated by tier classification
    }));
  }

  /**
   * Save plan to mind directory
   */
  async savePlan(plan) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${plan.planId.slice(0, 8)}.json`;
    const planPath = join(this.mindPath, 'actions/plans', filename);

    // Ensure directory exists
    await mkdir(dirname(planPath), { recursive: true });

    await writeFile(planPath, JSON.stringify(plan, null, 2));
  }
}
