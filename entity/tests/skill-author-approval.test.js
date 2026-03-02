/**
 * Self-authored skill approval flow tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UpdatePhase } from '../src/cognitive-engine/update.js';
import { ReflectPhase } from '../src/cognitive-engine/reflect.js';
import { CognitiveEngine } from '../src/cognitive-engine/index.js';

function createConfig() {
  return {
    cognitive: {
      emotionalDecayRate: 0.1,
      emotionalMomentum: 0.3,
      circuitBreakerThreshold: 0.95,
      circuitBreakerCycles: 5,
    },
  };
}

function createSkillAuthoredPayload() {
  return {
    name: 'example-skill',
    description: 'Test skill',
    actions: [
      {
        name: 'run',
        description: 'Run the skill',
        params: {},
        implementation: 'return { ok: true };',
      },
    ],
    reasoning: 'Repeated pattern',
  };
}

function stubSkillAuthor(updatePhase) {
  updatePhase.skillAuthor.generateSkill = async () => ({
    success: true,
    manifest: { name: 'example-skill', actions: [] },
    code: 'export default class ExampleSkill {}',
    meta: {},
    path: '/tmp/example-skill',
  });
  updatePhase.skillAuthor.formatForApproval = () => ({
    name: 'example-skill',
    description: 'Test skill',
    actions: [{ name: 'run', params: {} }],
    reasoning: 'Repeated pattern',
    code: 'export default class ExampleSkill {}',
    codePreview: 'preview',
  });
  updatePhase.skillAuthor.saveSkill = async () => ({
    success: true,
    name: 'example-skill',
    path: '/tmp/example-skill',
  });
}

describe('UpdatePhase self-authored skill approvals', () => {
  it('propagates skillAuthored from reflect output', async () => {
    const reflect = new ReflectPhase(
      {
        completeJSON: async () => ({
          parsed: {
            reflection: 'Created a reusable skill.',
            emotionalUpdate: {
              primary: { emotion: 'curiosity', delta: 0.1 },
              secondary: null,
            },
            goalUpdate: null,
            skillLearned: null,
            skillAuthored: createSkillAuthoredPayload(),
            valueAlignment: 0.7,
            lessonsLearned: ['Automate repeated work'],
          },
        }),
      },
      {
        buildSystemPrompt: () => 'system',
        buildReflectMessages: () => [{ role: 'user', content: 'reflect' }],
      },
      '/tmp/mind'
    );
    reflect.saveReflection = async () => {};

    const result = await reflect.execute(
      { emotions: { primary: 'neutral', intensity: 0.5 } },
      { actionIntent: 'create skill' },
      { goal: 'test' },
      []
    );

    assert.ok(result.skillAuthored);
    assert.strictEqual(result.skillAuthored.name, 'example-skill');
  });

  it('saves authored skill after approval', async () => {
    const approvals = [];
    const update = new UpdatePhase(
      '/tmp/mind',
      createConfig(),
      null,
      async (payload) => {
        approvals.push(payload);
        return { approved: true };
      }
    );
    stubSkillAuthor(update);

    const result = await update.handleSkillAuthoring(createSkillAuthoredPayload());
    assert.strictEqual(result.success, true);
    assert.strictEqual(approvals.length, 1);
    assert.strictEqual(approvals[0].type, 'skill_author');
    assert.strictEqual(approvals[0].tier, 4);
    assert.strictEqual(approvals[0].name, 'example-skill');
  });

  it('returns denied result when approval is rejected', async () => {
    const update = new UpdatePhase(
      '/tmp/mind',
      createConfig(),
      null,
      async () => ({ approved: false, reason: 'User denied' })
    );
    stubSkillAuthor(update);

    const result = await update.handleSkillAuthoring(createSkillAuthoredPayload());
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'User denied');
  });

  it('returns timeout-style denial when approval handler reports timeout', async () => {
    const update = new UpdatePhase(
      '/tmp/mind',
      createConfig(),
      null,
      async () => ({ approved: false, reason: 'Approval timeout' })
    );
    stubSkillAuthor(update);

    const result = await update.handleSkillAuthoring(createSkillAuthoredPayload());
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'Approval timeout');
  });

  it('auto-approves self-authored skills in full_trust policy mode', async () => {
    const calls = [];
    const approval = await CognitiveEngine.prototype.requestSkillAuthorApproval.call(
      {
        actionGateway: {
          requiresApprovalForTier: () => false,
          requestApproval: async () => {
            calls.push('requestApproval');
          },
        },
      },
      { name: 'example-skill' }
    );

    assert.deepStrictEqual(approval, {
      approved: true,
      approvalId: null,
      approved_by: 'policy',
    });
    assert.strictEqual(calls.length, 0);
  });

  it('fails closed when approval handler is missing', async () => {
    const update = new UpdatePhase('/tmp/mind', createConfig(), null, null);
    stubSkillAuthor(update);

    const result = await update.handleSkillAuthoring(createSkillAuthoredPayload());
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Approval handler is not configured'));
  });
});
