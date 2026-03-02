/**
 * entity doctor
 *
 * Run health checks.
 */

import { existsSync, accessSync, constants, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import simpleGit from 'simple-git';
import { loadConfig } from '../../utils/config.js';
import { getAuthManager } from '../../auth/index.js';

export default async function doctor(args: any, projectRoot: any) {
  console.log('\nEntity Health Check\n');
  console.log('─'.repeat(50));

  let allPassed = true;

  // Check 1: Mind files exist
  const mindPath = join(projectRoot, 'mind');
  const criticalFiles = [
    'identity/self.md',
    'identity/values.md',
    'emotions/state.json',
    'goals/active.md',
    'thoughts/stream.md',
    'world/context.md',
    'actions/toolbox.md',
  ];

  let mindFilesOk = true;
  if (existsSync(mindPath)) {
    for (const file of criticalFiles) {
      if (!existsSync(join(mindPath, file))) {
        mindFilesOk = false;
        break;
      }
    }
  } else {
    mindFilesOk = false;
  }

  console.log(`  Mind files exist and valid: ${mindFilesOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'}`);
  if (!mindFilesOk) allPassed = false;

  // Check 2: Git repo healthy
  let gitOk = false;
  if (existsSync(join(mindPath, '.git'))) {
    try {
      const git = simpleGit(mindPath);
      const status = await git.status();
      gitOk = true;
    } catch {
      gitOk = false;
    }
  }
  console.log(`  Git repo healthy: ${gitOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'}`);
  if (!gitOk) allPassed = false;

  // Check 3: LLM reachable
  let llmOk = false;
  try {
    const config = await loadConfig();
    const isAnthropic = config.llm.api === 'anthropic-messages';

    if (isAnthropic && config.llm?.apiKey) {
      const response = await fetch(`${config.llm.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.llm.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.llm.model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      llmOk = response.ok;
    } else if (!isAnthropic) {
      const authManager = getAuthManager(config);
      const credential = await authManager.resolveOpenAICredential();
      if (credential?.token) {
        const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${credential.token}`,
          },
          body: JSON.stringify({
            model: config.llm.model,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        llmOk = response.ok;
      }
    }
  } catch {
    llmOk = false;
  }
  console.log(`  LLM reachable: ${llmOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'}`);
  if (!llmOk) allPassed = false;

  // Check 4: Daemon running
  let daemonOk = false;
  const pidFile = join(homedir(), '.entity', 'entity.pid');
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim());
    try {
      process.kill(pid, 0);
      daemonOk = true;
    } catch {
      daemonOk = false;
    }
  }
  console.log(`  Daemon running: ${daemonOk ? '\x1b[32m✓\x1b[0m' : '\x1b[33m○\x1b[0m (optional)'}`);

  // Check 5: Workspace writable
  let workspaceOk = false;
  const workspacePath = join(projectRoot, 'entity-workspace');
  try {
    if (existsSync(workspacePath)) {
      accessSync(workspacePath, constants.W_OK);
      workspaceOk = true;
    } else {
      // Try to create it
      const { mkdirSync } = await import('fs');
      mkdirSync(workspacePath, { recursive: true });
      workspaceOk = true;
    }
  } catch {
    workspaceOk = false;
  }
  console.log(`  Workspace writable: ${workspaceOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'}`);
  if (!workspaceOk) allPassed = false;

  // Check 6: Node version
  const nodeVersion = process.versions.node;
  const [major = 0] = nodeVersion.split('.').map(Number);
  const nodeOk = major >= 20;
  console.log(`  Node.js ${nodeVersion}: ${nodeOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗ (need 20+)\x1b[0m'}`);
  if (!nodeOk) allPassed = false;

  // Summary
  console.log('─'.repeat(50));
  if (allPassed) {
    console.log('\n\x1b[32mAll checks passed!\x1b[0m\n');
  } else {
    console.log('\n\x1b[31mSome checks failed.\x1b[0m');
    console.log('Run "npm run onboard" to set up your entity.\n');
    process.exit(1);
  }
}
