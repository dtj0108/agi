/**
 * JSON Store Skill
 *
 * Persistent key-value storage for Entity data.
 */

import { BaseSkill } from '../../base-skill.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export default class JsonStoreSkill extends BaseSkill {
  constructor(manifest, config) {
    super(manifest, config);
    this.storagePath = config.storagePath || 'entity-workspace/store.json';
    this.data = this.load();
  }

  /**
   * Load data from disk
   */
  load() {
    try {
      if (existsSync(this.storagePath)) {
        const content = readFileSync(this.storagePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error(`[JsonStore] Failed to load: ${err.message}`);
    }
    return {};
  }

  /**
   * Save data to disk
   */
  save() {
    try {
      const dir = dirname(this.storagePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.storagePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      throw new Error(`Failed to save store: ${err.message}`);
    }
  }

  async execute(action, params) {
    switch (action) {
      case 'get':
        return this.get(params);
      case 'set':
        return this.set(params);
      case 'delete':
        return this.delete(params);
      case 'list':
        return this.list(params);
      case 'clear':
        return this.clear();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Get a value by key
   */
  get({ key }) {
    const value = this.data[key];
    return {
      key,
      value: value !== undefined ? value : null,
      found: value !== undefined,
    };
  }

  /**
   * Set a value for a key
   */
  set({ key, value }) {
    const existed = key in this.data;
    const previousValue = this.data[key];

    this.data[key] = value;
    this.save();

    return {
      key,
      value,
      previousValue: existed ? previousValue : null,
      created: !existed,
      updated: existed,
    };
  }

  /**
   * Delete a key
   */
  delete({ key }) {
    const existed = key in this.data;
    const previousValue = this.data[key];

    if (existed) {
      delete this.data[key];
      this.save();
    }

    return {
      key,
      deleted: existed,
      previousValue: existed ? previousValue : null,
    };
  }

  /**
   * List all keys
   */
  list({ prefix } = {}) {
    let keys = Object.keys(this.data);

    if (prefix) {
      keys = keys.filter(k => k.startsWith(prefix));
    }

    return {
      keys,
      count: keys.length,
      prefix: prefix || null,
    };
  }

  /**
   * Clear all data
   */
  clear() {
    const count = Object.keys(this.data).length;
    this.data = {};
    this.save();

    return {
      cleared: true,
      deletedCount: count,
    };
  }
}
