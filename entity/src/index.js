#!/usr/bin/env node
/**
 * Entity - Main Entry Point
 *
 * Boots all 5 services and starts the cognitive loop.
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from './utils/config.js';
import { configureLogger, getLogger } from './utils/logger.js';
import { configureTelemetry, getTelemetry } from './observability/telemetry.js';
import { MindServer } from './mind-server/index.js';
import { CognitiveEngine } from './cognitive-engine/index.js';
import { ActionGateway } from './action-gateway/index.js';
import { ShellExecutor } from './execution-engines/shell.js';
import { BrowserController } from './execution-engines/browser.js';
import { FileOperations } from './execution-engines/files.js';
import { InterfaceLayer } from './interface/index.js';

// Global state for shutdown handling
let mindServer = null;
let cognitiveEngine = null;
let executionEngines = null;
let interfaceLayer = null;
let shuttingDown = false;

async function main() {
  console.log('Entity boot sequence starting...\n');

  // Step 1: Load configuration
  console.log('[1/8] Loading configuration...');
  const config = await loadConfig();

  // Configure logging
  configureLogger(config.logging);
  const log = getLogger('main');
  configureTelemetry(config.observability);
  const telemetry = getTelemetry();

  // Step 2: Verify mind directory exists
  console.log('[2/8] Verifying mind directory...');
  const mindPath = config.mind.path;

  if (!existsSync(mindPath)) {
    telemetry.recordError('main', new Error('Mind directory not found'), { mindPath });
    console.error(`\nError: Mind directory not found at ${mindPath}`);
    console.error('Run "npm run init-mind" to create the mind directory.\n');
    process.exit(1);
  }

  log.info(`Mind path: ${mindPath}`);
  log.info(`LLM: ${config.llm.api} / ${config.llm.model}`);
  telemetry.recordEvent('boot_started', {
    mindPath,
    llmApi: config.llm.api,
    llmModel: config.llm.model,
  });

  // Step 3: Start Mind Server
  console.log('[3/8] Starting Mind Server (file watcher + search + git)...');
  mindServer = new MindServer(config);
  await mindServer.start();
  log.info('Mind Server started');

  // Step 4: Initialize Execution Engines
  console.log('[4/8] Initializing Execution Engines...');
  executionEngines = {
    shell: new ShellExecutor(config),
    browser: new BrowserController(config),
    files: new FileOperations(config),
  };
  log.info('Execution Engines initialized');

  // Step 5: Start Action Gateway
  console.log('[5/8] Starting Action Gateway...');
  const actionGateway = new ActionGateway(config, executionEngines);
  log.info('Action Gateway started');

  // Step 6: Start Cognitive Engine
  console.log('[6/8] Starting Cognitive Engine...');
  cognitiveEngine = new CognitiveEngine(config, actionGateway, mindServer);
  await cognitiveEngine.initialize();
  log.info('Cognitive Engine started');

  // Step 7: Start Interface Layer
  console.log('[7/8] Starting Interface Layer (HTTP + WebSocket + CLI + Heartbeat)...');
  interfaceLayer = new InterfaceLayer(
    config,
    cognitiveEngine,
    actionGateway,
    mindServer
  );

  // Set up kill handler
  interfaceLayer.onKillRequest(() => shutdown('interface'));

  // Load preferences from mind (overrides static config)
  await interfaceLayer.heartbeat.loadFromMind(config.mind.path);

  interfaceLayer.start();
  log.info('Interface Layer started');

  // Step 8: Initial orientation cycle
  console.log('[8/8] Running initial orientation cycle...\n');

  let initialState;
  try {
    initialState = await cognitiveEngine.runCycle({
      type: 'self_initiated',
      content: 'I have just started. Orient myself and check my goals.',
      metadata: { boot: true },
    });
  } catch (err) {
    log.error('Initial cycle failed', err.message);
    telemetry.recordError('main', err, { phase: 'initial_cycle' });
    initialState = {
      emotionalState: { primary: 'uncertain', intensity: 0.5 },
    };
  }

  // Log startup complete
  const emotions = initialState.emotionalState || { primary: 'neutral', intensity: 0.5 };
  console.log('');
  console.log('═'.repeat(60));
  console.log(`Entity is alive. Cycle 0.`);
  console.log(`Emotional state: ${emotions.primary} (${((emotions.intensity || 0) * 100).toFixed(0)}%)`);
  console.log('═'.repeat(60));
  console.log('');

  // Set up signal handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', async (err) => {
    telemetry.recordError('process', err, { signal: 'uncaughtException' });
    console.error('[Fatal] Uncaught exception:', err);
    await shutdown('uncaughtException');
  });
  process.on('unhandledRejection', async (reason) => {
    telemetry.recordError('process', reason instanceof Error ? reason : new Error(String(reason)), {
      signal: 'unhandledRejection',
    });
    console.error('[Fatal] Unhandled rejection:', reason);
    await shutdown('unhandledRejection');
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[Shutdown] Received ${signal}. Graceful shutdown starting...`);

  try {
    const telemetry = getTelemetry();
    telemetry.recordEvent('shutdown_started', { signal });
    // Step 1: Save current emotional state (happens in cognitive engine)
    console.log('[Shutdown] Saving state...');
    if (cognitiveEngine) {
      await cognitiveEngine.saveState();
    }

    // Step 2: Write final thought
    console.log('[Shutdown] Writing final thought...');
    if (cognitiveEngine) {
      await cognitiveEngine.writeThought(`Shutting down. ${new Date().toISOString()}`);
    }

    // Step 3: Commit pending changes
    console.log('[Shutdown] Committing pending mind changes...');
    if (mindServer) {
      await mindServer.git.commitAll('mind: shutdown state save');
    }

    // Step 4: Close browser if running
    console.log('[Shutdown] Closing browser...');
    if (executionEngines?.browser) {
      await executionEngines.browser.close();
    }

    // Step 5: Stop interface layer
    console.log('[Shutdown] Stopping servers...');
    if (interfaceLayer) {
      interfaceLayer.stop();
    }

    // Step 6: Stop mind server
    if (mindServer) {
      await mindServer.stop();
    }

    telemetry.recordEvent('shutdown_complete', { signal, success: true });
    telemetry.flush();

    console.log('[Shutdown] Complete. Goodbye.\n');
    process.exit(0);
  } catch (err) {
    const telemetry = getTelemetry();
    telemetry.recordError('shutdown', err, { signal });
    telemetry.flush();
    console.error('[Shutdown] Error during shutdown:', err.message);
    process.exit(1);
  }
}

// Run
main().catch((err) => {
  const telemetry = getTelemetry();
  telemetry.recordError('main', err, { phase: 'boot' });
  telemetry.flush();
  console.error('Boot failed:', err);
  process.exit(1);
});
