/**
 * entity reset
 *
 * Factory reset - wipe mind and re-run onboarding.
 */
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import * as readline from 'readline';
export default async function reset(args, projectRoot) {
    const mindPath = join(projectRoot, 'mind');
    const configPath = join(projectRoot, 'config', 'local.js');
    // Get entity name if available
    let entityName = 'Entity';
    try {
        if (existsSync(configPath)) {
            const configModule = await import(configPath);
            entityName = configModule.default?.entity?.name || 'Entity';
        }
    }
    catch {
        // Ignore
    }
    console.log('');
    console.log('\x1b[31m╔══════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[31m║              ⚠️  FACTORY RESET  ⚠️                 ║\x1b[0m');
    console.log('\x1b[31m╚══════════════════════════════════════════════════╝\x1b[0m');
    console.log('');
    console.log(`  This will erase ALL of ${entityName}'s:`);
    console.log('    - Memories');
    console.log('    - Thoughts');
    console.log('    - Goals');
    console.log('    - Emotions');
    console.log('    - Everything they\'ve learned');
    console.log('');
    console.log('  This cannot be undone.');
    console.log('');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const answer1 = await new Promise((resolve) => {
        rl.question(`  Type "${entityName}" to confirm: `, resolve);
    });
    if (answer1 !== entityName) {
        rl.close();
        console.log('\n  Reset cancelled.\n');
        process.exit(0);
    }
    const answer2 = await new Promise((resolve) => {
        rl.question('  Are you absolutely sure? (yes/no) ', resolve);
    });
    rl.close();
    // @ts-expect-error TODO(ts-migration): TS(2339): Property 'toLowerCase' does not exist on type 'unk... Remove this comment to see the full error message
    if (answer2.toLowerCase() !== 'yes') {
        console.log('\n  Reset cancelled.\n');
        process.exit(0);
    }
    console.log('');
    console.log('  Stopping daemon...');
    // Stop daemon if running
    try {
        await import('./stop.js').then((m) => m.default([], projectRoot));
    }
    catch {
        // Ignore
    }
    console.log('  Removing mind directory...');
    if (existsSync(mindPath)) {
        rmSync(mindPath, { recursive: true, force: true });
    }
    console.log('  Removing local config...');
    if (existsSync(configPath)) {
        rmSync(configPath);
    }
    console.log('');
    console.log('\x1b[32m  Reset complete.\x1b[0m');
    console.log('');
    console.log('  Run "npm run onboard" to create a new entity.');
    console.log('');
}
//# sourceMappingURL=reset.js.map