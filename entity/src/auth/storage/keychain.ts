/**
 * OS keychain-backed auth storage.
 *
 * Falls back to file storage when unavailable.
 */

import { execFileSync, spawnSync } from 'child_process';

const QUIET_STDIO = ['ignore', 'pipe', 'ignore'];

function commandExists(command: any) {
  const result = spawnSync('which', [command], { stdio: 'ignore' });
  return result.status === 0;
}

export class KeychainAuthStorage {
  account: any;
  service: any;
  constructor({ service = 'entity.oauth', account = 'default' }: any = {}) {
    this.service = service;
    this.account = account;
  }

  get source() {
    return 'keychain';
  }

  isAvailable() {
    if (process.platform === 'darwin') {
      return commandExists('security');
    }
    if (process.platform === 'linux') {
      return commandExists('secret-tool');
    }
    return false;
  }

  load() {
    if (!this.isAvailable()) return null;

    try {
      if (process.platform === 'darwin') {
        const value = execFileSync(
          'security',
          ['find-generic-password', '-a', this.account, '-s', this.service, '-w'],
          // @ts-expect-error TODO(ts-migration): TS(2769): No overload matches this call.
          { encoding: 'utf-8', stdio: QUIET_STDIO }
        ).trim();
        if (!value) return null;
        return JSON.parse(value);
      }

      if (process.platform === 'linux') {
        const value = execFileSync(
          'secret-tool',
          ['lookup', 'service', this.service, 'account', this.account],
          // @ts-expect-error TODO(ts-migration): TS(2769): No overload matches this call.
          { encoding: 'utf-8', stdio: QUIET_STDIO }
        ).trim();
        if (!value) return null;
        return JSON.parse(value);
      }
    } catch {
      return null;
    }

    return null;
  }

  save(payload: any) {
    if (!this.isAvailable()) {
      throw new Error('Keychain storage unavailable');
    }

    const serialized = JSON.stringify(payload);

    if (process.platform === 'darwin') {
      execFileSync(
        'security',
        ['add-generic-password', '-U', '-a', this.account, '-s', this.service, '-w', serialized],
        // @ts-expect-error TODO(ts-migration): TS(2769): No overload matches this call.
        { encoding: 'utf-8', stdio: QUIET_STDIO }
      );
      return;
    }

    if (process.platform === 'linux') {
      execFileSync(
        'secret-tool',
        [
          'store',
          '--label',
          'Entity OAuth Credentials',
          'service',
          this.service,
          'account',
          this.account,
        ],
        // @ts-expect-error TODO(ts-migration): TS(2769): No overload matches this call.
        { input: serialized, encoding: 'utf-8', stdio: QUIET_STDIO }
      );
      return;
    }

    throw new Error('Keychain storage unavailable on this platform');
  }

  clear() {
    if (!this.isAvailable()) return;

    try {
      if (process.platform === 'darwin') {
        execFileSync(
          'security',
          ['delete-generic-password', '-a', this.account, '-s', this.service],
          // @ts-expect-error TODO(ts-migration): TS(2769): No overload matches this call.
          { encoding: 'utf-8', stdio: QUIET_STDIO }
        );
        return;
      }

      if (process.platform === 'linux') {
        execFileSync(
          'secret-tool',
          ['clear', 'service', this.service, 'account', this.account],
          // @ts-expect-error TODO(ts-migration): TS(2769): No overload matches this call.
          { encoding: 'utf-8', stdio: QUIET_STDIO }
        );
      }
    } catch {
      // no-op: clearing a missing secret should be non-fatal
    }
  }
}
