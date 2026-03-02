/**
 * Auth manager singleton registry
 */

import { AuthManager } from './manager.js';

const managersByConfig = new WeakMap();
const fallbackManagers = new Map();

function getManagerKey(config: any) {
  if (config?.projectRoot) {
    return String(config.projectRoot);
  }
  if (config?.mind?.path) {
    return String(config.mind.path);
  }
  return 'default';
}

export function getAuthManager(config: any) {
  if (config && typeof config === 'object') {
    if (!managersByConfig.has(config)) {
      managersByConfig.set(config, new AuthManager(config));
    }
    return managersByConfig.get(config);
  }

  const key = getManagerKey(config);
  if (!fallbackManagers.has(key)) {
    fallbackManagers.set(key, new AuthManager(config));
  }
  return fallbackManagers.get(key);
}

export function createAuthManager(config: any, dependencies: any = {}) {
  return new AuthManager(config, dependencies);
}

export function resetAuthManagers() {
  fallbackManagers.clear();
}

export { AuthManager } from './manager.js';
