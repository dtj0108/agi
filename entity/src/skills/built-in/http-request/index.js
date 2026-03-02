/**
 * HTTP Request Skill
 *
 * Make HTTP requests to external APIs and websites.
 */

import { BaseSkill } from '../../base-skill.js';

export default class HttpRequestSkill extends BaseSkill {
  async execute(action, params) {
    switch (action) {
      case 'get':
        return this.get(params);
      case 'post':
        return this.post(params);
      case 'request':
        return this.request(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Validate URL against allowed/blocked domains
   */
  validateUrl(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      throw new Error(`Invalid URL: ${urlString}`);
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    }

    if (url.username || url.password) {
      throw new Error('Credentialed URLs are not allowed');
    }

    const domain = url.hostname;
    if (this.isPrivateTarget(domain)) {
      throw new Error(`Access to local/private networks is forbidden: ${domain}`);
    }

    const allowedDomains = this.config.allowedDomains || ['*'];
    const blockedDomains = this.config.blockedDomains || [];

    // Check blocked first
    for (const blocked of blockedDomains) {
      if (domain === blocked || domain.endsWith(`.${blocked}`)) {
        throw new Error(`Domain is blocked: ${domain}`);
      }
    }

    // Check allowed
    if (!allowedDomains.includes('*')) {
      const isAllowed = allowedDomains.some(
        allowed => domain === allowed || domain.endsWith(`.${allowed}`)
      );
      if (!isAllowed) {
        throw new Error(`Domain not in allowlist: ${domain}`);
      }
    }

    return url;
  }

  /**
   * Detect local/private network targets that should be blocked.
   */
  isPrivateTarget(hostname) {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      normalized === '0.0.0.0' ||
      normalized === '::1'
    ) {
      return true;
    }

    // IPv4 ranges
    const ipv4Match = normalized.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
    if (ipv4Match) {
      const parts = normalized.split('.').map((value) => Number(value));
      if (parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
        return true;
      }

      const [a, b] = parts;
      if (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        return true;
      }
    }

    // IPv6 local ranges
    if (
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Make an HTTP GET request
   */
  async get({ url, headers = {} }) {
    this.validateUrl(url);

    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Entity/1.0',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      let body;

      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
        // Truncate large text responses
        if (body.length > 50000) {
          body = body.slice(0, 50000) + '\n... (truncated)';
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw err;
    }
  }

  /**
   * Make an HTTP POST request
   */
  async post({ url, body, headers = {} }) {
    return this.request({ url, method: 'POST', body, headers });
  }

  /**
   * Make a custom HTTP request
   */
  async request({ url, method, body, headers = {} }) {
    this.validateUrl(url);

    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const options = {
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'Entity/1.0',
        ...headers,
      },
      signal: controller.signal,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
    }

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      let responseBody;

      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
        if (responseBody.length > 50000) {
          responseBody = responseBody.slice(0, 50000) + '\n... (truncated)';
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw err;
    }
  }
}
