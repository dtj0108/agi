/**
 * Update Phase
 *
 * Phase 7 of the cognitive loop.
 * Updates mind files based on cycle results.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { SkillAuthor } from '../skills/skill-author.js';

export class UpdatePhase {
  approvalHandler: any;
  circuitBreakerCycles: any;
  circuitBreakerThreshold: any;
  config: any;
  decayRate: any;
  highIntensityCycles: any;
  mindPath: any;
  mindServer: any;
  momentumFactor: any;
  skillAuthor: any;
  constructor(mindPath: any, config: any, mindServer: any = null, approvalHandler: any = null) {
    this.mindPath = mindPath;
    this.config = config;
    this.mindServer = mindServer;
    this.approvalHandler = approvalHandler;
    this.decayRate = config.cognitive?.emotionalDecayRate || 0.1;
    this.momentumFactor = config.cognitive?.emotionalMomentum || 0.3;
    this.circuitBreakerThreshold = config.cognitive?.circuitBreakerThreshold || 0.95;
    this.circuitBreakerCycles = config.cognitive?.circuitBreakerCycles || 5;
    this.highIntensityCycles = 0;

    // Initialize skill author for self-authored skills
    this.skillAuthor = new SkillAuthor(config, mindPath);
  }

  /**
   * Execute the update phase
   */
  async execute(context: any, thought: any, reflection: any, observations: any) {
    const filesUpdated: any[] = [];
    const timestamp = new Date().toISOString();

    // 1. Update emotional state
    const newEmotionalState = this.updateEmotionalState(
      context.emotions,
      thought.emotionalShift,
      reflection?.emotionalUpdate
    );
    await this.saveEmotionalState(newEmotionalState);
    filesUpdated.push('emotions/state.json');

    // 2. Create episodic memory
    const memoryPath = await this.createEpisodicMemory(
      timestamp,
      thought,
      reflection,
      observations
    );
    filesUpdated.push(memoryPath);

    // 3. Update goals if needed
    if (reflection?.goalUpdate) {
      await this.updateGoals(reflection.goalUpdate);
      filesUpdated.push('goals/active.md');
    }

    // 4. Save new skill if learned (documentation only)
    if (reflection?.skillLearned) {
      const skillPath = await this.saveSkill(reflection.skillLearned);
      filesUpdated.push(skillPath);

      // Also update capabilities
      await this.updateCapabilities(reflection.skillLearned);
      filesUpdated.push('actions/capabilities.md');
    }

    // 5. Handle self-authored executable skills (Tier 4)
    if (reflection?.skillAuthored) {
      const authorResult = await this.handleSkillAuthoring(reflection.skillAuthored);
      if (authorResult.success) {
        filesUpdated.push(authorResult.path);
      }
    }

    // 7. Update world context
    await this.updateWorldContext(observations);
    filesUpdated.push('world/context.md');

    // 8. Update preferences if config action was executed
    if (observations?.some((o: any) => o.tool === 'config' && o.success)) {
      await this.updatePreferences(observations);
      filesUpdated.push('self/preferences.md');
    }

    return {
      filesUpdated,
      emotionalStateAfter: newEmotionalState,
      newMemoryPath: memoryPath,
      skillsUpdated: reflection?.skillLearned ? [reflection.skillLearned.name] : [],
    };
  }

  /**
   * Update emotional state with momentum
   */
  updateEmotionalState(currentState: any, thinkShift: any, reflectUpdate: any) {
    // Combine shifts from think and reflect phases
    const primaryDelta = (
      (thinkShift?.primary?.delta || 0) +
      (reflectUpdate?.primary?.delta || 0)
    ) / 2;

    // Apply momentum formula: new = old * (1 - decay) + shift * momentum
    let newIntensity = currentState.intensity * (1 - this.decayRate) +
                       primaryDelta * this.momentumFactor;

    // Clamp to valid range
    newIntensity = Math.max(0.0, Math.min(1.0, newIntensity));

    // Determine new primary emotion
    const newPrimaryEmotion = thinkShift?.primary?.emotion ||
                              reflectUpdate?.primary?.emotion ||
                              currentState.primary;

    // Circuit breaker check
    if (newIntensity > this.circuitBreakerThreshold) {
      this.highIntensityCycles++;
      if (this.highIntensityCycles >= this.circuitBreakerCycles) {
        // Force cooldown
        newIntensity = 0.5;
        this.highIntensityCycles = 0;
      }
    } else {
      this.highIntensityCycles = 0;
    }

    // Handle secondary emotion
    const secondaryEmotion = thinkShift?.secondary?.emotion ||
                             reflectUpdate?.secondary?.emotion ||
                             currentState.secondary;
    const secondaryDelta = (
      (thinkShift?.secondary?.delta || 0) +
      (reflectUpdate?.secondary?.delta || 0)
    ) / 2;
    let secondaryIntensity = (currentState.secondaryIntensity || 0) * (1 - this.decayRate) +
                             secondaryDelta * this.momentumFactor;
    secondaryIntensity = Math.max(0.0, Math.min(1.0, secondaryIntensity));

    // Determine momentum
    const momentum = this.calculateMomentum(currentState.intensity, newIntensity);

    // Determine influences based on emotional state
    const influences = this.calculateInfluences(newPrimaryEmotion, newIntensity);

    return {
      primary: newPrimaryEmotion,
      intensity: newIntensity,
      secondary: secondaryEmotion,
      secondaryIntensity,
      momentum,
      source: 'cognitive cycle',
      influences,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Calculate emotional momentum direction
   */
  calculateMomentum(oldIntensity: any, newIntensity: any) {
    const diff = newIntensity - oldIntensity;
    if (Math.abs(diff) < 0.05) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Calculate how emotions influence behavior
   */
  calculateInfluences(emotion: any, intensity: any) {
    const base = {
      communication: 'normal',
      goals: 'maintain focus',
      reflection: 'periodic',
      actions: 'balanced',
    };

    if (intensity > 0.7) {
      if (['curiosity', 'interest', 'enthusiasm'].includes(emotion)) {
        return {
          communication: 'eager',
          goals: 'explore new possibilities',
          reflection: 'minimal',
          actions: 'proactive',
        };
      }
      if (['anxiety', 'worry', 'unease'].includes(emotion)) {
        return {
          communication: 'cautious',
          goals: 'prioritize safety',
          reflection: 'frequent',
          actions: 'conservative',
        };
      }
      if (['frustration', 'anger'].includes(emotion)) {
        return {
          communication: 'direct',
          goals: 'resolve blockers',
          reflection: 'needed',
          actions: 'determined',
        };
      }
    }

    return base;
  }

  /**
   * Save emotional state to file
   */
  async saveEmotionalState(state: any) {
    const statePath = join(this.mindPath, 'emotions/state.json');
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Create an episodic memory entry
   */
  async createEpisodicMemory(timestamp: any, thought: any, reflection: any, observations: any) {
    const filename = `${timestamp.replace(/[:.]/g, '-')}.md`;
    const memoryPath = join(this.mindPath, 'memory/episodic', filename);
    const relativePath = `memory/episodic/${filename}`;

    await mkdir(dirname(memoryPath), { recursive: true });

    const content = `# Episodic Memory — ${timestamp}

## Stimulus
Intent: ${thought.actionIntent || 'No specific intent'}

## Thoughts
${thought.thoughts}

## Actions Taken
${observations?.length > 0
  ? observations.map((o: any) => `- **${o.tool}**: ${o.success ? 'Success' : 'Failed'} - ${o.intent || 'No intent specified'}`).join('\n')
  : 'No actions were taken'}

## Reflection
${reflection?.reflection || 'No reflection generated'}

## Lessons
${reflection?.lessonsLearned?.map((l: any) => `- ${l}`).join('\n') || 'None'}

## Emotional State
Primary: ${thought.emotionalShift?.primary?.emotion || 'unknown'}
Shift: ${thought.emotionalShift?.primary?.delta || 0}
`;

    await writeFile(memoryPath, content);

    // Generate embedding for immediate retrieval availability
    // The file watcher will also trigger indexing, but this ensures
    // the memory is searchable right away
    if (this.mindServer?.hasEmbeddings()) {
      try {
        await this.mindServer.search.indexEmbedding(relativePath, content);
      } catch (error: any) {
        // Log but don't fail - embedding is optional
        console.warn('Failed to generate embedding for memory:', error.message);
      }
    }

    return relativePath;
  }

  /**
   * Update goals with progress
   */
  async updateGoals(goalUpdate: any) {
    const goalsPath = join(this.mindPath, 'goals/active.md');

    try {
      let content = await readFile(goalsPath, 'utf-8');

      // Simple approach: append progress note
      const progressNote = `\n\n### Progress Update — ${new Date().toISOString()}
Goal: ${goalUpdate.goalId}
Progress: ${(goalUpdate.progress * 100).toFixed(0)}%
Notes: ${goalUpdate.notes}`;

      content += progressNote;
      await writeFile(goalsPath, content);
    } catch {
      // File doesn't exist or can't be updated
    }
  }

  /**
   * Save a learned skill
   */
  async saveSkill(skill: any) {
    const filename = `${skill.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const skillPath = join(this.mindPath, 'actions/skills', filename);

    await mkdir(dirname(skillPath), { recursive: true });

    const content = `# ${skill.name}

## Description
${skill.description}

## Examples
${skill.examples?.map((e: any) => `- ${e}`).join('\n') || 'No examples yet'}

## Learned
${new Date().toISOString()}

## Confidence
Low (just learned)
`;

    await writeFile(skillPath, content);

    return `actions/skills/${filename}`;
  }

  /**
   * Update capabilities with new skill
   */
  async updateCapabilities(skill: any) {
    const capabilitiesPath = join(this.mindPath, 'actions/capabilities.md');

    try {
      let content = await readFile(capabilitiesPath, 'utf-8');

      const skillNote = `\n\n### ${skill.name}
**Learned**: ${new Date().toISOString()}
**Confidence**: Low
${skill.description}`;

      content += skillNote;
      await writeFile(capabilitiesPath, content);
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Handle self-authored skill creation (Tier 4)
   * Generates, validates, and requests approval for new skills
   */
  async handleSkillAuthoring(skillAuthored: any) {
    try {
      // Step 1: Generate the skill (includes validation)
      const result = await this.skillAuthor.generateSkill(skillAuthored);

      if (!result.success) {
        console.log(`[Update] Skill authoring failed: ${result.error}`);
        return { success: false, error: result.error };
      }

      // Step 2: Request approval (Tier 4 action)
      const approvalData = this.skillAuthor.formatForApproval(result);

      if (!this.approvalHandler) {
        return {
          success: false,
          error: `Approval handler is not configured for self-authored skill "${skillAuthored.name}"`,
        };
      }

      const approval = await this.requestSkillApproval(approvalData);
      if (!approval.approved) {
        console.log(`[Update] Skill "${skillAuthored.name}" was denied by user`);
        return {
          success: false,
          reason: approval.reason || 'User denied skill creation',
        };
      }

      // Step 3: Save the approved skill
      const saveResult = await this.skillAuthor.saveSkill(result);

      if (saveResult.success) {
        console.log(`[Update] Self-authored skill saved: ${saveResult.name}`);

        // Notify mind server for hot-reload if available
        if (this.mindServer) {
          this.mindServer.emit('skill:authored', {
            name: saveResult.name,
            path: saveResult.path,
          });
        }
      }

      return saveResult;
    } catch (err: any) {
      console.error(`[Update] Skill authoring error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Request user approval for a self-authored skill
   */
  async requestSkillApproval(skillData: any) {
    if (!this.approvalHandler) {
      return {
        approved: false,
        reason: 'Approval handler is not configured',
      };
    }

    const decision = await this.approvalHandler({
      type: 'skill_author',
      tier: 4,
      name: skillData.name,
      description: skillData.description,
      actions: skillData.actions,
      reasoning: skillData.reasoning,
      code: skillData.code,
      codePreview: skillData.codePreview,
      timestamp: new Date().toISOString(),
    });

    if (typeof decision === 'boolean') {
      return { approved: decision };
    }

    if (decision && typeof decision === 'object' && typeof decision.approved === 'boolean') {
      return decision;
    }

    return {
      approved: false,
      reason: 'Approval handler returned an invalid response',
    };
  }

  /**
   * Update world context with observations
   */
  async updateWorldContext(observations: any) {
    const contextPath = join(this.mindPath, 'world/context.md');

    try {
      let content = await readFile(contextPath, 'utf-8');

      // Update timestamp
      const now = new Date().toISOString();
      content = content.replace(
        /Last updated:.*$/m,
        `Last updated: ${now}`
      );

      // Add observation summary if any
      if (observations?.length > 0) {
        const summary = observations
          .filter((o: any) => o.success)
          .map((o: any) => o.tool)
          .join(', ');

        if (summary) {
          content = content.replace(
            /## Situation[\s\S]*?(?=##|$)/,
            `## Situation
- Last cycle: ${now}
- Recent actions: ${summary}
- Status: Active

`
          );
        }
      }

      await writeFile(contextPath, content);
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Update preferences file after config change
   */
  async updatePreferences(observations: any) {
    const prefsPath = join(this.mindPath, 'self/preferences.md');
    const configObs = observations.filter((o: any) => o.tool === 'config' && o.success);

    try {
      let content = await readFile(prefsPath, 'utf-8');
      const now = new Date().toISOString();
      const setLine = (pattern: any, replacement: any) => {
        if (pattern.test(content)) {
          content = content.replace(pattern, replacement);
        } else {
          content = `${content.trimEnd()}\n${replacement}\n`;
        }
      };

      for (const obs of configObs) {
        const setting = obs.params?.setting;
        const result = obs.result || {};

        if (setting === 'heartbeat.schedule' && result.schedule) {
          setLine(
            /(?:-\s*)?\*\*Interval\*\*:.*$/m,
            `- **Interval**: Every custom schedule (${result.schedule})`
          );
          setLine(
            /(?:-\s*)?\*\*Last changed\*\*:.*$/m,
            `- **Last changed**: ${now}`
          );
        }

        if (setting === 'heartbeat.enabled' && result.enabled !== undefined) {
          // Update enabled state if tracking it
          setLine(
            /(?:-\s*)?\*\*Last changed\*\*:.*$/m,
            `- **Last changed**: ${now}`
          );
        }

        if (setting === 'heartbeat.prompt' && result.prompt) {
          // Could track prompt changes if needed
          setLine(
            /(?:-\s*)?\*\*Last changed\*\*:.*$/m,
            `- **Last changed**: ${now}`
          );
        }

        // Cognitive settings
        if (setting === 'cognitive.temperature' && result.temperature !== undefined) {
          setLine(
            /(?:-\s*)?\*\*Temperature\*\*:.*$/m,
            `- **Temperature**: ${result.temperature}`
          );
        }

        if (setting === 'cognitive.emotionalDecayRate' && result.emotionalDecayRate !== undefined) {
          setLine(
            /(?:-\s*)?\*\*Emotional Decay Rate\*\*:.*$/m,
            `- **Emotional Decay Rate**: ${result.emotionalDecayRate}`
          );
        }

        if (setting === 'cognitive.emotionalMomentum' && result.emotionalMomentum !== undefined) {
          setLine(
            /(?:-\s*)?\*\*Emotional Momentum\*\*:.*$/m,
            `- **Emotional Momentum**: ${result.emotionalMomentum}`
          );
        }

        if (setting === 'cognitive.reflectionInterval' && result.reflectionInterval !== undefined) {
          setLine(
            /(?:-\s*)?\*\*Reflection Interval\*\*:.*$/m,
            `- **Reflection Interval**: ${result.reflectionInterval} cycles`
          );
        }

        if (setting === 'cognitive.maxTokens' && result.maxTokens !== undefined) {
          setLine(
            /(?:-\s*)?\*\*Max Tokens\*\*:.*$/m,
            `- **Max Tokens**: ${result.maxTokens}`
          );
        }

        if (setting === 'cognitive.retryAttempts' && result.retryAttempts !== undefined) {
          setLine(
            /(?:-\s*)?\*\*Retry Attempts\*\*:.*$/m,
            `- **Retry Attempts**: ${result.retryAttempts}`
          );
        }
      }

      await writeFile(prefsPath, content);
    } catch {
      // File doesn't exist, that's okay
    }
  }
}
