/**
 * entity goals
 *
 * Show active goals.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export default async function goals(args: any, projectRoot: any) {
  const mindPath = join(projectRoot, 'mind');
  const goalsPath = join(mindPath, 'goals/active.md');

  if (!existsSync(goalsPath)) {
    console.error('Goals file not found. Run "npm run onboard" first.');
    process.exit(1);
  }

  const content = readFileSync(goalsPath, 'utf-8');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Active Goals');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(content);
}
