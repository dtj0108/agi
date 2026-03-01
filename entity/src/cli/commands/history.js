/**
 * entity history
 *
 * Show git history for mind.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';

export default async function history(args, projectRoot) {
  const mindPath = join(projectRoot, 'mind');

  if (!existsSync(join(mindPath, '.git'))) {
    console.error('Mind git repository not found.');
    process.exit(1);
  }

  const git = simpleGit(mindPath);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Mind History (Cognitive Timeline)');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    const log = await git.log({ maxCount: 30 });

    for (const commit of log.all) {
      const date = new Date(commit.date);
      const formattedDate = date.toLocaleString();

      console.log(`  \x1b[33m${commit.hash.slice(0, 7)}\x1b[0m  ${commit.message}`);
      console.log(`           \x1b[2m${formattedDate}\x1b[0m`);
      console.log('');
    }

    console.log('───────────────────────────────────────────────────');
    console.log('  Use "entity rollback <hash>" to restore a state');
    console.log('───────────────────────────────────────────────────\n');
  } catch (err) {
    console.error(`Failed to get history: ${err.message}`);
    process.exit(1);
  }
}
