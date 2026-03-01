/**
 * Browser allowlist tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BrowserController } from '../src/execution-engines/browser.js';

describe('BrowserController domain allowlist', () => {
  it('allows all domains when allowlist is empty', () => {
    const browser = new BrowserController({
      actions: {
        browser: {
          allowedDomains: [],
        },
      },
      projectRoot: '/tmp',
    });

    assert.strictEqual(browser.isDomainAllowed('example.com'), true);
    assert.strictEqual(browser.isDomainAllowed('subdomain.example.org'), true);
  });

  it('allows exact and subdomain matches only when allowlist is configured', () => {
    const browser = new BrowserController({
      actions: {
        browser: {
          allowedDomains: ['example.com'],
        },
      },
      projectRoot: '/tmp',
    });

    assert.strictEqual(browser.isDomainAllowed('example.com'), true);
    assert.strictEqual(browser.isDomainAllowed('api.example.com'), true);
    assert.strictEqual(browser.isDomainAllowed('another-example.com'), false);
    assert.strictEqual(browser.isDomainAllowed('example.org'), false);
  });
});
