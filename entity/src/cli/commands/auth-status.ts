/**
 * entity auth-status
 *
 * Show local credential/auth status.
 */

import { loadConfig } from '../../utils/config.js';
import { getAuthManager } from '../../auth/index.js';

export default async function authStatus() {
  const config = await loadConfig();
  const authManager = getAuthManager(config);

  try {
    const status = await authManager.getAuthStatus();

    console.log('');
    console.log('Entity Auth Status');
    console.log('─'.repeat(40));
    console.log(`  Mode:      ${status.mode}`);
    console.log(`  Provider:  ${status.provider}`);
    console.log(`  Source:    ${status.source}`);
    console.log(`  Logged In: ${status.loggedIn ? 'yes' : 'no'}`);
    console.log(`  Expires:   ${status.expiresAt || 'n/a'}`);
    console.log('');
  } catch (err: any) {
    console.error(`Auth status failed: ${err.message}`);
    process.exitCode = 1;
  }
}
