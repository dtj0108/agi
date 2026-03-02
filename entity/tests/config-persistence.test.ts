/**
 * Config Persistence Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { UpdatePhase } from '../src/cognitive-engine/update.js';

const INITIAL_PREFERENCES = `# My Preferences

## Heartbeat
- **Interval**: Every 30 minutes (*/30 * * * *)
- **Last changed**: 2000-01-01

## Cognitive
- **Temperature**: 0.7
- **Emotional Decay Rate**: 0.1
- **Emotional Momentum**: 0.3
- **Reflection Interval**: 10 cycles
- **Max Tokens**: 8192
`;

describe('UpdatePhase.updatePreferences', () => {
  it('persists successful config observation results into preferences.md', async (t: any) => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'entity-config-persist-'));
    const mindPath = join(tempRoot, 'mind');
    await mkdir(join(mindPath, 'self'), { recursive: true });
    await writeFile(join(mindPath, 'self/preferences.md'), INITIAL_PREFERENCES, 'utf-8');

    t.after(async () => {
      await rm(tempRoot, { recursive: true, force: true });
    });

    const update = new UpdatePhase(mindPath, {
      cognitive: {
        emotionalDecayRate: 0.1,
        emotionalMomentum: 0.3,
        circuitBreakerThreshold: 0.95,
        circuitBreakerCycles: 5,
      },
    });

    await update.updatePreferences([
      {
        tool: 'config',
        success: true,
        params: { setting: 'heartbeat.schedule' },
        result: { success: true, schedule: '*/5 * * * *' },
      },
      {
        tool: 'config',
        success: true,
        params: { setting: 'cognitive.temperature' },
        result: { success: true, temperature: 0.2 },
      },
      {
        tool: 'config',
        success: true,
        params: { setting: 'cognitive.emotionalDecayRate' },
        result: { success: true, emotionalDecayRate: 0.25 },
      },
      {
        tool: 'config',
        success: true,
        params: { setting: 'cognitive.emotionalMomentum' },
        result: { success: true, emotionalMomentum: 0.45 },
      },
      {
        tool: 'config',
        success: true,
        params: { setting: 'cognitive.reflectionInterval' },
        result: { success: true, reflectionInterval: 4 },
      },
      {
        tool: 'config',
        success: true,
        params: { setting: 'cognitive.maxTokens' },
        result: { success: true, maxTokens: 4096 },
      },
      {
        tool: 'config',
        success: true,
        params: { setting: 'cognitive.retryAttempts' },
        result: { success: true, retryAttempts: 6 },
      },
    ]);

    const updated = await readFile(join(mindPath, 'self/preferences.md'), 'utf-8');

    assert.ok(updated.includes('- **Interval**: Every custom schedule (*/5 * * * *)'));
    assert.ok(updated.includes('- **Temperature**: 0.2'));
    assert.ok(updated.includes('- **Emotional Decay Rate**: 0.25'));
    assert.ok(updated.includes('- **Emotional Momentum**: 0.45'));
    assert.ok(updated.includes('- **Reflection Interval**: 4 cycles'));
    assert.ok(updated.includes('- **Max Tokens**: 4096'));
    assert.ok(updated.includes('- **Retry Attempts**: 6'));

    assert.ok(updated.includes('- **Last changed**:'));
    assert.ok(!updated.includes('- **Last changed**: 2000-01-01'));
  });
});
