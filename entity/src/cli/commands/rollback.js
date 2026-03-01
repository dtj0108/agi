/**
 * entity rollback
 *
 * Rollback mind to a git commit.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import * as readline from 'readline';

export default async function rollback(args, projectRoot) {
  const mindPath = join(projectRoot, 'mind');

  if (!existsSync(join(mindPath, '.git'))) {
    console.error('Mind git repository not found.');
    process.exit(1);
  }

  const commitHash = args[0];

  if (!commitHash) {
    console.error('Usage: entity rollback <commit-hash>');
    console.log('');
    console.log('Use "entity history" to see available commits.');
    process.exit(1);
  }

  const git = simpleGit(mindPath);

  // Verify commit exists
  try {
    await git.show([commitHash, '--stat']);
  } catch {
    console.error(`Commit not found: ${commitHash}`);
    process.exit(1);
  }

  // Get commit info
  const commitInfo = await git.show([commitHash, '--no-patch', '--format=%h %s (%ar)']);
  console.log('');
  console.log(`Rolling back to: ${commitInfo.trim()}`);
  console.log('');

  // Confirm
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise(resolve => {
    rl.question('This will discard all changes since this commit. Continue? (y/N) ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }

  // Perform rollback
  console.log('');
  console.log('Rolling back...');

  try {
    await git.reset(['--hard', commitHash]);
    console.log('\x1b[32mRollback complete.\x1b[0m');
    console.log('');
    console.log('The entity mind has been restored to the specified commit.');
    console.log('Restart the entity for changes to take effect: entity restart');
    console.log('');
  } catch (err) {
    console.error(`Rollback failed: ${err.message}`);
    process.exit(1);
  }
}
