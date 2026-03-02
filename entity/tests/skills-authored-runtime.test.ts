/**
 * Authored skill runtime integrity tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SkillAuthor } from '../src/skills/skill-author.js';
import { SkillsRegistry } from '../src/skills/registry.js';

const BASE_SKILL_SOURCE = `export class BaseSkill {
  constructor(manifest, config = {}) {
    this.manifest = manifest;
    this.config = config;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description;
  }

  getTier(action) {
    const actionDef = this.manifest.actions?.find((a) => a.name === action);
    return actionDef?.tier ?? 2;
  }

  async execute() {
    throw new Error('Not implemented - subclass must override execute()');
  }
}
`;

function createConfig() {
  return {
    cognitive: {
      emotionalDecayRate: 0.1,
      emotionalMomentum: 0.3,
      circuitBreakerThreshold: 0.95,
      circuitBreakerCycles: 5,
    },
    skills: {},
  };
}

function createSkillAuthoredPayload(name: any = 'runtime-skill') {
  return {
    name,
    description: 'Runtime authored skill',
    actions: [
      {
        name: 'run',
        description: 'Run',
        params: {},
        implementation: 'return { ok: true };',
      },
    ],
    reasoning: 'Repeated behavior detected',
  };
}

function authoredRoot(testName: any) {
  return join(process.cwd(), 'entity-workspace', 'test-artifacts', testName);
}

async function writeAuthoredSkill({ root, name, code, approved, codeHash }: any) {
  const skillPath = join(root, 'actions', 'skills', 'authored', name);
  await mkdir(skillPath, { recursive: true });

  const manifest = {
    name,
    version: '1.0.0',
    description: `${name} description`,
    author: 'entity-self-authored',
    actions: [
      {
        name: 'run',
        description: 'Run',
        tier: 4,
        params: {},
      },
    ],
  };

  await Promise.all([
    writeFile(join(skillPath, 'manifest.json'), JSON.stringify(manifest, null, 2)),
    writeFile(join(skillPath, 'index.js'), code),
    writeFile(join(skillPath, 'base-skill.js'), BASE_SKILL_SOURCE),
    writeFile(
      join(skillPath, '.meta.json'),
      JSON.stringify({
        approved,
        approvedAt: new Date().toISOString(),
        hashAlgorithm: 'sha256',
        codeHash,
      }, null, 2)
    ),
  ]);
}

describe('Authored skill runtime', () => {
  it('generates authored code importing local base-skill', () => {
    const author = new SkillAuthor(createConfig(), '/tmp/mind');
    const code = author.generateCode(createSkillAuthoredPayload('import-check'));
    assert.match(code, /import \{ BaseSkill \} from '\.\/base-skill\.js';/);
  });

  it('passes sandbox validation path for generated authored skill', async (t: any) => {
    const root = authoredRoot('authored-sandbox-validation');
    await rm(root, { recursive: true, force: true });
    t.after(async () => {
      await rm(root, { recursive: true, force: true });
    });

    const mindPath = join(root, 'mind');
    await mkdir(mindPath, { recursive: true });
    const author = new SkillAuthor(createConfig(), mindPath);

    const result = await author.generateSkill(createSkillAuthoredPayload('sandbox-ok'));
    assert.strictEqual(result.success, true);
    assert.ok(result.code.includes('export default class'));
  });

  it('saveSkill writes base-skill and code hash metadata', async (t: any) => {
    const root = authoredRoot('authored-save-skill');
    await rm(root, { recursive: true, force: true });
    t.after(async () => {
      await rm(root, { recursive: true, force: true });
    });

    const mindPath = join(root, 'mind');
    await mkdir(mindPath, { recursive: true });
    const author = new SkillAuthor(createConfig(), mindPath);
    const generated = await author.generateSkill(createSkillAuthoredPayload('save-check'));
    assert.strictEqual(generated.success, true);

    const saveResult = await author.saveSkill(generated);
    assert.strictEqual(saveResult.success, true);

    const metaPath = join(saveResult.path, '.meta.json');
    const baseSkillPath = join(saveResult.path, 'base-skill.js');
    assert.strictEqual(existsSync(metaPath), true);
    assert.strictEqual(existsSync(baseSkillPath), true);

    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    assert.strictEqual(meta.approved, true);
    assert.strictEqual(meta.hashAlgorithm, 'sha256');
    assert.strictEqual(typeof meta.codeHash, 'string');
    assert.ok(meta.codeHash.length > 0);
  });

  it('loads only approved authored skills with valid code hash', async (t: any) => {
    const root = authoredRoot('authored-registry-integrity');
    await rm(root, { recursive: true, force: true });
    t.after(async () => {
      await rm(root, { recursive: true, force: true });
    });

    const code = `import { BaseSkill } from './base-skill.js';

export default class DemoSkill extends BaseSkill {
  async execute(action, params) {
    if (action === 'run') {
      return { ok: true, params };
    }
    throw new Error('Unknown action');
  }
}
`;
    const validHash = createHash('sha256').update(code).digest('hex');

    await writeAuthoredSkill({
      root,
      name: 'approved-skill',
      code,
      approved: true,
      codeHash: validHash,
    });
    await writeAuthoredSkill({
      root,
      name: 'unapproved-skill',
      code,
      approved: false,
      codeHash: validHash,
    });
    await writeAuthoredSkill({
      root,
      name: 'tampered-skill',
      code,
      approved: true,
      codeHash: 'deadbeef',
    });

    const registry = new SkillsRegistry(createConfig(), null);
    await registry.loadAuthoredSkills(root);

    assert.strictEqual(registry.has('approved-skill'), true);
    assert.strictEqual(registry.has('unapproved-skill'), false);
    assert.strictEqual(registry.has('tampered-skill'), false);
  });
});
