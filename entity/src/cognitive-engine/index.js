/**
 * Cognitive Engine
 *
 * Orchestrates the 7-phase cognitive loop.
 * This is the entity's consciousness.
 */

import { EventEmitter } from 'events';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LLM } from './llm.js';
import { PromptBuilder } from './prompt-builder.js';
import { OrientPhase } from './orient.js';
import { ThinkPhase } from './think.js';
import { PlanPhase } from './plan.js';
import { ActPhase } from './act.js';
import { SensePhase } from './sense.js';
import { ReflectPhase } from './reflect.js';
import { UpdatePhase } from './update.js';
import { getTelemetry } from '../observability/telemetry.js';

export class CognitiveEngine extends EventEmitter {
  constructor(config, actionGateway, mindServer) {
    super();
    this.config = config;
    this.actionGateway = actionGateway;
    this.mindServer = mindServer;
    this.mindPath = config.mind.path;

    // State
    this.cycleCount = 0;
    this.currentPhase = null;
    this.paused = false;
    this.safeMode = false;
    this.phaseErrors = {};
    this.lastEmotionalState = null;
    this.lastThoughts = [];
    this.telemetry = getTelemetry();

    // Initialize components
    this.llm = new LLM(config);
    this.promptBuilder = new PromptBuilder(config);

    // Initialize phases
    this.orient = new OrientPhase(this.mindPath, config, mindServer);
    this.think = new ThinkPhase(this.llm, this.promptBuilder, this.mindPath, {
      fallbackFactory: (context, stimulus) => this.createThinkFallback(context, stimulus),
    });
    this.plan = new PlanPhase(this.llm, this.promptBuilder, this.mindPath, actionGateway, {
      fallbackFactory: (context, thought) => this.createPlanFallback(context, thought),
    });
    this.act = new ActPhase(actionGateway, config);
    this.sense = new SensePhase(config);
    this.reflect = new ReflectPhase(this.llm, this.promptBuilder, this.mindPath, {
      fallbackFactory: (context, thought, plan, observations) =>
        this.createReflectFallback(context, thought, plan, observations),
    });
    this.update = new UpdatePhase(this.mindPath, config, mindServer);

    // Forward act phase events
    this.act.on('approval_needed', (data) => this.emit('approval_needed', data));
  }

  /**
   * Initialize the cognitive engine
   */
  async initialize() {
    // Run initial orient to get current state
    try {
      const context = await this.orient.execute(0);
      this.lastEmotionalState = context.emotions;
    } catch (error) {
      this.telemetry.recordError('cognitive-engine', error, { stage: 'initialize' });
      // Use defaults if orient fails
      this.lastEmotionalState = {
        primary: 'neutral',
        intensity: 0.5,
      };
    }
  }

  /**
   * Run one complete cognitive cycle
   */
  async runCycle(stimulus) {
    if (this.paused) {
      throw new Error('Cognitive engine is paused');
    }

    const cycleId = uuidv4();
    const startTime = Date.now();
    const phases = {};
    const errors = [];

    this.telemetry.incrementCounter('cycle.total', 1, { stimulusType: stimulus?.type || 'unknown' });
    this.emit('cycle:start', { cycleId, stimulus });

    let context = null;
    let thought = null;
    let plan = null;
    let actResults = null;
    let observations = null;
    let reflection = null;
    let updateResult = null;

    // Phase 1: ORIENT
    try {
      this.currentPhase = 'orient';
      this.emit('phase:start', { cycleId, phase: 'orient' });
      const phaseStart = Date.now();

      context = await this.orient.execute(this.cycleCount, stimulus);

      phases.orient = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.orient.duration, { phase: 'orient' });
      this.emit('phase:complete', { cycleId, phase: 'orient', duration: phases.orient.duration });
    } catch (error) {
      phases.orient = { duration: 0, success: false };
      errors.push({ phase: 'orient', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'orient' });
      this.emit('phase:error', { cycleId, phase: 'orient', error });
      await this.handlePhaseError('orient', error, stimulus);
      context = this.getMinimalContext();
    }

    // Phase 2: THINK
    try {
      this.currentPhase = 'think';
      this.emit('phase:start', { cycleId, phase: 'think' });
      const phaseStart = Date.now();

      thought = await this.think.execute(context, stimulus);

      phases.think = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.think.duration, { phase: 'think' });
      this.emit('thought', { cycleId, content: thought.thoughts, phase: 'think' });
      this.emit('phase:complete', { cycleId, phase: 'think', duration: phases.think.duration });

      this.lastThoughts.push(thought.thoughts);
      if (this.lastThoughts.length > 10) this.lastThoughts.shift();
    } catch (error) {
      phases.think = { duration: 0, success: false };
      errors.push({ phase: 'think', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'think' });
      this.emit('phase:error', { cycleId, phase: 'think', error });
      await this.handlePhaseError('think', error, stimulus);
      thought = this.getDefaultThought();
    }

    // Phase 3: PLAN
    try {
      this.currentPhase = 'plan';
      this.emit('phase:start', { cycleId, phase: 'plan' });
      const phaseStart = Date.now();

      plan = await this.plan.execute(context, thought);

      phases.plan = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.plan.duration, { phase: 'plan' });
      this.emit('phase:complete', { cycleId, phase: 'plan', duration: phases.plan.duration });
    } catch (error) {
      phases.plan = { duration: 0, success: false };
      errors.push({ phase: 'plan', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'plan' });
      this.emit('phase:error', { cycleId, phase: 'plan', error });
      await this.handlePhaseError('plan', error, stimulus);
      plan = null;
    }

    // Phase 4: ACT
    try {
      this.currentPhase = 'act';
      this.emit('phase:start', { cycleId, phase: 'act' });
      const phaseStart = Date.now();

      actResults = await this.act.execute(plan);

      phases.act = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.act.duration, { phase: 'act' });
      this.emit('phase:complete', { cycleId, phase: 'act', duration: phases.act.duration });
    } catch (error) {
      phases.act = { duration: 0, success: false };
      errors.push({ phase: 'act', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'act' });
      this.emit('phase:error', { cycleId, phase: 'act', error });
      await this.handlePhaseError('act', error, stimulus);
      actResults = null;
    }

    // Phase 5: SENSE
    try {
      this.currentPhase = 'sense';
      this.emit('phase:start', { cycleId, phase: 'sense' });
      const phaseStart = Date.now();

      observations = this.sense.execute(actResults);

      phases.sense = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.sense.duration, { phase: 'sense' });
      this.emit('phase:complete', { cycleId, phase: 'sense', duration: phases.sense.duration });
    } catch (error) {
      phases.sense = { duration: 0, success: false };
      errors.push({ phase: 'sense', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'sense' });
      this.emit('phase:error', { cycleId, phase: 'sense', error });
      observations = [];
    }

    // Phase 6: REFLECT
    try {
      this.currentPhase = 'reflect';
      this.emit('phase:start', { cycleId, phase: 'reflect' });
      const phaseStart = Date.now();

      reflection = await this.reflect.execute(context, thought, plan, observations);

      phases.reflect = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.reflect.duration, { phase: 'reflect' });
      this.emit('phase:complete', { cycleId, phase: 'reflect', duration: phases.reflect.duration });
    } catch (error) {
      phases.reflect = { duration: 0, success: false };
      errors.push({ phase: 'reflect', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'reflect' });
      this.emit('phase:error', { cycleId, phase: 'reflect', error });
      await this.handlePhaseError('reflect', error, stimulus);
      reflection = null;
    }

    // Phase 7: UPDATE
    try {
      this.currentPhase = 'update';
      this.emit('phase:start', { cycleId, phase: 'update' });
      const phaseStart = Date.now();

      updateResult = await this.update.execute(context, thought, reflection, observations);
      this.lastEmotionalState = updateResult.emotionalStateAfter;

      phases.update = { duration: Date.now() - phaseStart, success: true };
      this.telemetry.observeDuration('cycle.phase.duration_ms', phases.update.duration, { phase: 'update' });
      this.emit('phase:complete', { cycleId, phase: 'update', duration: phases.update.duration });
      this.emit('emotion', updateResult.emotionalStateAfter);
    } catch (error) {
      phases.update = { duration: 0, success: false };
      errors.push({ phase: 'update', error: error.message });
      this.telemetry.incrementCounter('cycle.phase.failed', 1, { phase: 'update' });
      this.emit('phase:error', { cycleId, phase: 'update', error });
      await this.handlePhaseError('update', error, stimulus);
    }

    // Complete the cycle
    this.currentPhase = null;
    this.cycleCount++;

    // Check for reflection interval
    if (this.cycleCount % (this.config.cognitive?.reflectionInterval || 10) === 0) {
      // Schedule a deeper self-reflection for next cycle
      setTimeout(() => this.triggerDeepReflection(), 1000);
    }

    const result = {
      cycleId,
      stimulus,
      phases,
      userResponse: thought?.userResponse || null,
      thoughts: thought?.thoughts || '',
      emotionalState: this.lastEmotionalState,
      thoughtsGenerated: thought ? 1 : 0,
      actionsExecuted: observations?.length || 0,
      totalDuration: Date.now() - startTime,
      errors,
    };

    this.telemetry.observeDuration('cycle.duration_ms', result.totalDuration, {
      success: String(errors.length === 0),
      stimulusType: stimulus?.type || 'unknown',
    });
    if (errors.length > 0) {
      this.telemetry.incrementCounter('cycle.failed', 1, { stimulusType: stimulus?.type || 'unknown' });
    }
    this.telemetry.recordEvent('cycle_complete', {
      cycleId,
      success: errors.length === 0,
      errorCount: errors.length,
    });

    this.emit('cycle:complete', { cycleId, result });

    return result;
  }

  /**
   * Handle a phase error
   */
  async handlePhaseError(phase, error, stimulus) {
    this.telemetry.recordError('cognitive-engine', error, {
      stage: 'phase_error',
      phase,
      stimulusType: stimulus?.type || 'unknown',
    });
    // Log to audit
    await this.logError(phase, error);

    // Write error thought
    const errorThought = `[${new Date().toISOString()}] — ERROR
Phase ${phase} failed: ${error.message}
I need to continue despite this error. Moving to next phase with defaults.`;
    await this.appendToThoughtStream(errorThought);

    // Track repeated failures
    this.phaseErrors[phase] = (this.phaseErrors[phase] || 0) + 1;
    if (this.phaseErrors[phase] >= 3) {
      await this.enterSafeMode(phase, error);
    }
  }

  /**
   * Enter safe mode due to repeated failures
   */
  async enterSafeMode(phase, error) {
    this.safeMode = true;
    this.telemetry.recordEvent('safe_mode_entered', { phase, reason: error?.message || 'unknown' });

    const safeThought = `[${new Date().toISOString()}] — SYSTEM
Entering safe mode due to repeated failures in ${phase}.
Will only respond to direct user messages until issue is resolved.`;
    await this.appendToThoughtStream(safeThought);

    this.emit('safe_mode:entered', { phase, error, message: 'Repeated phase failures' });
  }

  /**
   * Trigger a deeper self-reflection cycle
   */
  async triggerDeepReflection() {
    if (this.paused) return;

    try {
      await this.runCycle({
        type: 'self_initiated',
        content: 'Time for deeper reflection. Review my recent thoughts and actions. Am I aligned with my values? Am I making progress on my goals? What patterns do I notice in my behavior?',
        metadata: { deepReflection: true },
      });
    } catch (error) {
      this.telemetry.recordError('cognitive-engine', error, { stage: 'deep_reflection' });
    }
  }

  /**
   * Append to thought stream
   */
  async appendToThoughtStream(content) {
    const streamPath = join(this.mindPath, 'thoughts/stream.md');
    const entry = `\n---\n${content}\n`;
    try {
      await appendFile(streamPath, entry);
    } catch {
      this.telemetry.recordError('cognitive-engine', new Error('Failed to append thought stream'), {
        stage: 'append_thought_stream',
      });
    }
  }

  /**
   * Log an error to audit log
   */
  async logError(phase, error) {
    const auditPath = join(this.mindPath, 'security/audit.log');
    const entry = `[${new Date().toISOString()}] ERROR in ${phase}: ${error.message}\n`;
    try {
      await appendFile(auditPath, entry);
    } catch {
      this.telemetry.recordError('cognitive-engine', new Error('Failed to write audit log'), {
        stage: 'log_error',
        phase,
      });
    }
  }

  /**
   * Get minimal context when orient fails
   */
  getMinimalContext() {
    return {
      identity: 'I am an entity.',
      values: 'Honesty, Safety, Growth',
      voice: 'Direct and honest',
      emotions: this.lastEmotionalState || { primary: 'neutral', intensity: 0.5 },
      goals: 'Continue operating',
      worldContext: 'Context unavailable',
      toolbox: 'Tools available',
      recentThoughts: this.lastThoughts,
      relevantMemories: [],
      timestamp: new Date().toISOString(),
      cycleNumber: this.cycleCount,
    };
  }

  /**
   * Get default thought when think fails
   */
  getDefaultThought() {
    return {
      thoughts: 'I encountered an error during thinking.',
      needsAction: false,
      userResponse: null,
      emotionalShift: { primary: { emotion: 'concern', delta: 0.1 }, secondary: null },
      actionIntent: null,
    };
  }

  /**
   * Default fallback returned when think schema validation cannot be recovered
   */
  createThinkFallback(context, stimulus) {
    return this.getDefaultThought();
  }

  /**
   * Default fallback returned when plan schema validation cannot be recovered
   */
  createPlanFallback(context, thought) {
    return {
      goal: thought?.actionIntent || 'Unable to build a structured plan',
      steps: [],
      rollback: null,
      emotionalContext: 'fallback',
    };
  }

  /**
   * Default fallback returned when reflect schema validation cannot be recovered
   */
  createReflectFallback(context, thought, plan, observations) {
    return {
      reflection: 'I was unable to generate a structured reflection this cycle.',
      emotionalUpdate: {
        primary: { emotion: 'neutral', delta: 0 },
        secondary: null,
      },
      goalUpdate: null,
      skillLearned: null,
      valueAlignment: 0,
      lessonsLearned: [],
    };
  }

  /**
   * Get current status
   */
  async getStatus() {
    return {
      cycleCount: this.cycleCount,
      currentPhase: this.currentPhase,
      paused: this.paused,
      safeMode: this.safeMode,
      emotions: this.lastEmotionalState,
      goalCount: 2, // TODO: actually count goals
    };
  }

  /**
   * Get recent thoughts
   */
  async getRecentThoughts(limit = 5) {
    return this.lastThoughts.slice(-limit).map((content, i) => ({
      content,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Get current state
   */
  getState() {
    return {
      cycleCount: this.cycleCount,
      emotions: this.lastEmotionalState,
      paused: this.paused,
      safeMode: this.safeMode,
    };
  }

  /**
   * Save state (for shutdown)
   */
  async saveState() {
    // Emotional state is already saved in update phase
    // Just ensure it's written
  }

  /**
   * Write a thought (for shutdown message)
   */
  async writeThought(content) {
    await this.appendToThoughtStream(`[${new Date().toISOString()}] — SYSTEM\n${content}`);
  }

  /**
   * Pause the cognitive engine
   */
  pause() {
    this.paused = true;
    this.emit('paused');
  }

  /**
   * Resume the cognitive engine
   */
  resume() {
    this.paused = false;
    this.emit('resumed');
  }

  /**
   * Check if paused
   */
  isPaused() {
    return this.paused;
  }

  /**
   * Get cycle count
   */
  getCycleCount() {
    return this.cycleCount;
  }

  /**
   * Get current phase
   */
  getCurrentPhase() {
    return this.currentPhase;
  }

  /**
   * Approve a pending action
   */
  approve(actionId) {
    return this.act.approve(actionId);
  }

  /**
   * Deny a pending action
   */
  deny(actionId) {
    return this.act.deny(actionId);
  }

  /**
   * Update cognitive configuration at runtime
   */
  updateCognitiveConfig(key, value) {
    const parseNumber = (raw, { min, max, integer = false, label }) => {
      if (typeof raw !== 'number' && typeof raw !== 'string') {
        return { error: `Invalid ${label}: ${raw}` };
      }
      if (typeof raw === 'string' && raw.trim().length === 0) {
        return { error: `Invalid ${label}: ${raw}` };
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return { error: `Invalid ${label}: ${raw}` };
      }

      const normalized = integer ? Math.trunc(parsed) : parsed;
      const clamped = Math.max(min, Math.min(max, normalized));
      return { value: clamped };
    };

    switch (key) {
      case 'temperature': {
        const parsed = parseNumber(value, { min: 0, max: 1, label: 'temperature' });
        if (parsed.error) return { success: false, error: parsed.error };
        const temp = parsed.value;
        this.llm.temperature = temp;
        return { success: true, temperature: temp };
      }

      case 'emotionalDecayRate': {
        const parsed = parseNumber(value, { min: 0, max: 1, label: 'emotionalDecayRate' });
        if (parsed.error) return { success: false, error: parsed.error };
        const decay = parsed.value;
        this.update.decayRate = decay;
        return { success: true, emotionalDecayRate: decay };
      }

      case 'emotionalMomentum': {
        const parsed = parseNumber(value, { min: 0, max: 1, label: 'emotionalMomentum' });
        if (parsed.error) return { success: false, error: parsed.error };
        const momentum = parsed.value;
        this.update.momentumFactor = momentum;
        return { success: true, emotionalMomentum: momentum };
      }

      case 'reflectionInterval': {
        const parsed = parseNumber(value, {
          min: 1,
          max: 1000000,
          integer: true,
          label: 'reflectionInterval',
        });
        if (parsed.error) return { success: false, error: parsed.error };
        const interval = parsed.value;
        this.config.cognitive = this.config.cognitive || {};
        this.config.cognitive.reflectionInterval = interval;
        return { success: true, reflectionInterval: interval };
      }

      case 'maxTokens': {
        const parsed = parseNumber(value, {
          min: 1000,
          max: 32000,
          integer: true,
          label: 'maxTokens',
        });
        if (parsed.error) return { success: false, error: parsed.error };
        const tokens = parsed.value;
        this.llm.maxTokens = tokens;
        return { success: true, maxTokens: tokens };
      }

      case 'retryAttempts': {
        const parsed = parseNumber(value, {
          min: 0,
          max: 10,
          integer: true,
          label: 'retryAttempts',
        });
        if (parsed.error) return { success: false, error: parsed.error };
        const retries = parsed.value;
        this.llm.retryAttempts = retries;
        return { success: true, retryAttempts: retries };
      }

      default:
        return { success: false, error: `Unknown cognitive config: ${key}` };
    }
  }

  /**
   * Get current cognitive configuration
   */
  getCognitiveConfig() {
    return {
      temperature: this.llm.temperature,
      emotionalDecayRate: this.update.decayRate,
      emotionalMomentum: this.update.momentumFactor,
      reflectionInterval: this.config.cognitive?.reflectionInterval || 10,
      maxTokens: this.llm.maxTokens,
      retryAttempts: this.llm.retryAttempts,
    };
  }
}
