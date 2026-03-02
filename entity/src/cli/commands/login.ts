/**
 * entity login
 *
 * Local OAuth login for provider-backed credentials.
 */

import { loadConfig } from '../../utils/config.js';
import { getAuthManager } from '../../auth/index.js';

function parseArgs(args: any = []) {
  const result = {
    deviceCode: false,
    noBrowser: false,
    issuer: null,
    clientId: null,
    scopes: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--device-code') {
      result.deviceCode = true;
      continue;
    }

    if (arg === '--no-browser') {
      result.noBrowser = true;
      continue;
    }

    if (arg === '--issuer' && args[i + 1]) {
      result.issuer = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--client-id' && args[i + 1]) {
      result.clientId = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--scopes' && args[i + 1]) {
      result.scopes = args[i + 1]
        .split(/[\s,]+/)
        .map((scope: any) => scope.trim())
        .filter(Boolean);
      i += 1;
    }
  }

  return result;
}

export default async function login(args: any) {
  const options = parseArgs(args);
  const config = await loadConfig();
  const authManager = getAuthManager(config);

  try {
    console.log('Starting OAuth login...');

    const result = await authManager.login({
      issuer: options.issuer || undefined,
      clientId: options.clientId || undefined,
      scopes: options.scopes || undefined,
      deviceCode: options.deviceCode,
      noBrowser: options.noBrowser,
      onAuthorizationUrl: async (url: any) => {
        if (options.noBrowser && !options.deviceCode) {
          console.log('');
          console.log('Open this URL to continue sign-in:');
          console.log(`  ${url}`);
          console.log('');
        }
      },
      onDevicePrompt: async (prompt: any) => {
        const verificationUrl = prompt.verification_uri_complete || prompt.verification_uri;
        console.log('');
        console.log('Device authorization required:');
        console.log(`  URL:  ${verificationUrl}`);
        if (prompt.user_code) {
          console.log(`  Code: ${prompt.user_code}`);
        }
        console.log('Waiting for authorization...');
        console.log('');
      },
    });

    if (result.flow === 'browser') {
      if (!options.noBrowser) {
        console.log('Browser login flow started. Complete authorization in your browser.');
      }
    }

    console.log('Login successful.');
  } catch (err: any) {
    console.error(`Login failed: ${err.message}`);
    process.exitCode = 1;
  }
}
