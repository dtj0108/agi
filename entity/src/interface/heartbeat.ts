/**
 * Heartbeat
 *
 * Triggers autonomous cognitive cycles on a schedule.
 */

import cron from 'node-cron';
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getTelemetry } from '../observability/telemetry.js';

export class Heartbeat extends EventEmitter {
  cognitiveEngine: any;
  config: any;
  enabled: any;
  prompt: any;
  schedule: any;
  task: any;
  constructor(config: any, cognitiveEngine: any) {
    super();
    this.config = config;
    this.cognitiveEngine = cognitiveEngine;
    this.task = null;
    this.enabled = config.heartbeat?.enabled !== false;
    this.schedule = config.heartbeat?.schedule || '*/30 * * * *';
    this.prompt = config.heartbeat?.prompt ||
      'Time has passed. Review my goals, reflect on recent events, and consider what I should do next.';
  }

  /**
   * Start the heartbeat scheduler
   */
  start() {
    const telemetry = getTelemetry();
    if (!this.enabled) {
      console.log('[Heartbeat] Disabled by config');
      return;
    }

    if (this.task) {
      return;
    }

    // Validate cron schedule
    if (!cron.validate(this.schedule)) {
      console.error(`[Heartbeat] Invalid cron schedule: ${this.schedule}`);
      // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
      telemetry.recordEvent('heartbeat_invalid_schedule', { schedule: this.schedule });
      return;
    }

    this.task = cron.schedule(this.schedule, async () => {
      console.log('[Heartbeat] Triggering autonomous cycle');

      try {
        const result = await this.cognitiveEngine.runCycle({
          type: 'heartbeat',
          content: this.prompt,
          metadata: {
            source: 'heartbeat',
            timestamp: new Date().toISOString(),
          },
        });

        this.emit('cycle_complete', result);
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
        telemetry.incrementCounter('heartbeat.cycle.success', 1);
      } catch (err: any) {
        console.error('[Heartbeat] Cycle failed:', err.message);
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
        telemetry.incrementCounter('heartbeat.cycle.failed', 1);
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
        telemetry.recordError('heartbeat', err, { stage: 'trigger' });
        this.emit('cycle_error', err);
      }
    });

    // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
    telemetry.recordEvent('heartbeat_started', { schedule: this.schedule });
    console.log(`[Heartbeat] Scheduled: ${this.schedule}`);
  }

  /**
   * Stop the heartbeat scheduler
   */
  stop() {
    const telemetry = getTelemetry();
    if (this.task) {
      this.task.stop();
      this.task = null;
      // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 1.
      telemetry.recordEvent('heartbeat_stopped');
    }
  }

  /**
   * Trigger a heartbeat cycle immediately
   */
  async triggerNow() {
    try {
      return await this.cognitiveEngine.runCycle({
        type: 'heartbeat',
        content: this.prompt,
        metadata: {
          source: 'heartbeat_manual',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
      getTelemetry().recordError('heartbeat', error, { stage: 'manual_trigger' });
      throw error;
    }
  }

  /**
   * Update the heartbeat schedule at runtime
   */
  updateSchedule(newSchedule: any) {
    if (!cron.validate(newSchedule)) {
      throw new Error(`Invalid cron schedule: ${newSchedule}`);
    }

    const wasRunning = this.task !== null;

    // Stop current task
    this.stop();

    // Update schedule
    this.schedule = newSchedule;
    this.enabled = true;

    // Restart if it was running
    if (wasRunning) {
      this.start();
    }

    console.log(`[Heartbeat] Schedule updated to: ${newSchedule}`);
    return { schedule: newSchedule, enabled: this.enabled };
  }

  /**
   * Update the heartbeat prompt
   */
  updatePrompt(newPrompt: any) {
    this.prompt = newPrompt;
    console.log(`[Heartbeat] Prompt updated`);
    return { prompt: newPrompt };
  }

  /**
   * Enable or disable the heartbeat
   */
  setEnabled(enabled: any) {
    if (enabled) {
      this.enabled = true;
      if (!this.task) {
        this.start();
      }
    } else if (this.enabled || this.task) {
      this.enabled = false;
      this.stop();
    }
    console.log(`[Heartbeat] ${enabled ? 'Enabled' : 'Disabled'}`);
    return { enabled: this.enabled };
  }

  /**
   * Get current heartbeat status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      schedule: this.schedule,
      prompt: this.prompt,
      running: this.task !== null,
    };
  }

  /**
   * Load preferences from mind file (called on startup)
   */
  async loadFromMind(mindPath: any) {
    try {
      const prefsPath = join(mindPath, 'self/preferences.md');
      const content = await readFile(prefsPath, 'utf-8');

      // Parse schedule from markdown - looks for cron pattern in parentheses
      // Format: **Interval**: Every 5 minutes (*/5 * * * *)
      const cronMatch = content.match(/\*\*Interval\*\*:.*?\(([*/\d\s,\-]+)\)/);
      const cronValue = cronMatch?.[1]?.trim();
      if (cronValue && cron.validate(cronValue)) {
        this.schedule = cronValue;
        console.log(`[Heartbeat] Loaded schedule from mind: ${this.schedule}`);
      }
    } catch {
      // No preferences file or parse error, use config defaults
      // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
      getTelemetry().recordEvent('heartbeat_preferences_unavailable', {
        path: join(mindPath, 'self/preferences.md'),
      });
    }
  }
}
