/**
 * entity logs
 *
 * Show thought stream.
 */

import { existsSync, readFileSync, watch } from 'fs';
import { join } from 'path';

export default async function logs(args, projectRoot) {
  const mindPath = join(projectRoot, 'mind');
  const streamPath = join(mindPath, 'thoughts/stream.md');

  if (!existsSync(streamPath)) {
    console.error('Thought stream not found. Run "npm run onboard" first.');
    process.exit(1);
  }

  const follow = args.includes('--follow') || args.includes('-f');

  // Read and display current content
  const content = readFileSync(streamPath, 'utf-8');
  const entries = content.split('---').filter(e => e.trim());

  // Show last 20 entries
  const recentEntries = entries.slice(-20);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Thought Stream');
  console.log('═══════════════════════════════════════════════════\n');

  for (const entry of recentEntries) {
    console.log('---');
    console.log(entry.trim());
    console.log('');
  }

  if (!follow) {
    console.log('───────────────────────────────────────────────────');
    console.log('  Use --follow (-f) to tail in real time');
    console.log('───────────────────────────────────────────────────\n');
    return;
  }

  // Follow mode
  console.log('───────────────────────────────────────────────────');
  console.log('  Following thought stream (Ctrl+C to exit)');
  console.log('───────────────────────────────────────────────────\n');

  let lastSize = readFileSync(streamPath).length;

  // Watch for changes
  const watcher = watch(streamPath, (eventType) => {
    if (eventType === 'change') {
      const newContent = readFileSync(streamPath, 'utf-8');
      if (newContent.length > lastSize) {
        // Get new content
        const newPart = newContent.slice(lastSize);
        process.stdout.write(newPart);
      }
      lastSize = newContent.length;
    }
  });

  // Keep process alive
  process.on('SIGINT', () => {
    watcher.close();
    console.log('\n\nStopped following.');
    process.exit(0);
  });

  // Prevent exit
  await new Promise(() => {});
}
