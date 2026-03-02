/**
 * Network-oriented skill policy hardening tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'fs/promises';
import { join } from 'path';
import HttpRequestSkill from '../src/skills/built-in/http-request/index.js';

const httpRequestManifest = {
  name: 'http-request',
  version: '1.0.0',
  description: 'HTTP requests',
  actions: [
    { name: 'get', tier: 2, params: { url: { type: 'string', required: true } } },
  ],
};

describe('Skills network policy', () => {
  it('denies requests when allowlist is empty by default', () => {
    const skill = new HttpRequestSkill(httpRequestManifest, {
      allowedDomains: [],
      blockedDomains: [],
      timeout: 1000,
    });

    assert.throws(
      () => skill.validateUrl('https://example.com/path'),
      /Domain not in allowlist/
    );
  });

  it('allows exact domain and subdomains only when allowlisted', () => {
    const skill = new HttpRequestSkill(httpRequestManifest, {
      allowedDomains: ['example.com'],
      blockedDomains: [],
      timeout: 1000,
    });

    assert.ok(skill.validateUrl('https://example.com').hostname === 'example.com');
    assert.ok(skill.validateUrl('https://api.example.com/v1').hostname === 'api.example.com');
    assert.throws(() => skill.validateUrl('https://example.org'), /Domain not in allowlist/);
  });

  it('blocks private network, credentialed, and non-http URLs', () => {
    const skill = new HttpRequestSkill(httpRequestManifest, {
      allowedDomains: ['*'],
      blockedDomains: [],
      timeout: 1000,
    });

    assert.throws(() => skill.validateUrl('http://localhost:3000'), /forbidden/);
    assert.throws(() => skill.validateUrl('http://127.0.0.1'), /forbidden/);
    assert.throws(() => skill.validateUrl('http://10.0.0.5'), /forbidden/);
    assert.throws(() => skill.validateUrl('http://192.168.1.22'), /forbidden/);
    assert.throws(() => skill.validateUrl('ftp://example.com/file.txt'), /Unsupported URL protocol/);
    assert.throws(() => skill.validateUrl('https://user:pass@example.com'), /Credentialed URLs/);
  });

  it('ships network egress skills at Tier 2 by default', async () => {
    const httpManifestPath = join(process.cwd(), 'src/skills/built-in/http-request/manifest.json');
    const webSearchManifestPath = join(process.cwd(), 'src/skills/built-in/web-search/manifest.json');

    const httpManifest = JSON.parse(await readFile(httpManifestPath, 'utf-8'));
    const webSearchManifest = JSON.parse(await readFile(webSearchManifestPath, 'utf-8'));

    const httpGet = httpManifest.actions.find((action: any) => action.name === 'get');
    const webSearch = webSearchManifest.actions.find((action: any) => action.name === 'search');

    assert.strictEqual(httpGet.tier, 2);
    assert.strictEqual(webSearch.tier, 2);
  });
});
