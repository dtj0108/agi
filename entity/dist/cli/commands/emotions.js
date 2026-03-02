/**
 * entity emotions
 *
 * Show current emotional state.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
export default async function emotions(args, projectRoot) {
    const mindPath = join(projectRoot, 'mind');
    const statePath = join(mindPath, 'emotions/state.json');
    if (!existsSync(statePath)) {
        console.error('Emotional state not found. Run "npm run onboard" first.');
        process.exit(1);
    }
    const content = readFileSync(statePath, 'utf-8');
    const state = JSON.parse(content);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Emotional State');
    console.log('═══════════════════════════════════════════════════\n');
    // Primary emotion with intensity bar
    const primaryBar = createBar(state.intensity);
    console.log(`  Primary:   ${state.primary}`);
    console.log(`             ${primaryBar} ${(state.intensity * 100).toFixed(0)}%`);
    console.log('');
    // Secondary emotion
    if (state.secondary) {
        const secondaryBar = createBar(state.secondaryIntensity || 0);
        console.log(`  Secondary: ${state.secondary}`);
        console.log(`             ${secondaryBar} ${((state.secondaryIntensity || 0) * 100).toFixed(0)}%`);
        console.log('');
    }
    // Momentum
    const momentumIcon = state.momentum === 'rising' ? '↑' :
        state.momentum === 'falling' ? '↓' :
            state.momentum === 'stable' ? '→' : '~';
    console.log(`  Momentum:  ${momentumIcon} ${state.momentum}`);
    console.log('');
    // Source
    console.log(`  Source:    ${state.source}`);
    console.log('');
    // Influences
    if (state.influences) {
        console.log('  Influences:');
        for (const [key, value] of Object.entries(state.influences)) {
            console.log(`    ${key}: ${value}`);
        }
        console.log('');
    }
    // Last updated
    console.log(`  Updated:   ${state.lastUpdated}`);
    console.log('');
    console.log('───────────────────────────────────────────────────\n');
}
function createBar(value, width = 20) {
    const filled = Math.round(value * width);
    const empty = width - filled;
    return '\x1b[32m' + '█'.repeat(filled) + '\x1b[0m' + '░'.repeat(empty);
}
//# sourceMappingURL=emotions.js.map