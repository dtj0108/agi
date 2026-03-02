/**
 * entity logout
 *
 * Clear locally stored OAuth credentials.
 */

import { loadConfig } from '../../utils/config.js';
import { getAuthManager } from '../../auth/index.js';

export default async function logout() {
  const config = await loadConfig();
  const authManager = getAuthManager(config);

  try {
    await authManager.logout();
    console.log('Local OAuth credentials cleared.');
  } catch (err: any) {
    console.error(`Logout failed: ${err.message}`);
    process.exitCode = 1;
  }
}
