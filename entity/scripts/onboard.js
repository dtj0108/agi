#!/usr/bin/env node
/**
 * Entity Onboarding Wizard
 *
 * Interactive 7-phase wizard for setting up a new Entity.
 * Uses @clack/prompts for the terminal UI.
 *
 * Usage:
 *   npm run onboard
 *   node scripts/onboard.js
 *
 * Non-interactive mode:
 *   node scripts/onboard.js --non-interactive \
 *     --user-name "Drew" \
 *     --entity-name "Atlas" \
 *     --llm-provider anthropic \
 *     --llm-api-key "sk-ant-..." \
 *     --autonomy balanced \
 *     --deploy local
 */

import * as p from '@clack/prompts';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { homedir, platform } from 'os';
import { initMindPersonalized } from './init-mind-personalized.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Parse command line arguments for non-interactive mode
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { interactive: true };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--non-interactive') {
      parsed.interactive = false;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

// ASCII art logo
const LOGO = `
  ███████╗███╗   ██╗████████╗██╗████████╗██╗   ██╗
  ██╔════╝████╗  ██║╚══██╔══╝██║╚══██╔══╝╚██╗ ██╔╝
  █████╗  ██╔██╗ ██║   ██║   ██║   ██║    ╚████╔╝
  ██╔══╝  ██║╚██╗██║   ██║   ██║   ██║     ╚██╔╝
  ███████╗██║ ╚████║   ██║   ██║   ██║      ██║
  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝   ╚═╝      ╚═╝
`;

/**
 * Phase 1: Welcome
 */
async function phase1Welcome(interactive) {
  if (!interactive) return true;

  console.log(LOGO);

  p.intro('Welcome to Entity');

  p.note(
    `You're about to create an entity — a persistent AI with its own mind,
memory, emotions, and the ability to act on your computer.

This wizard will set everything up.`,
    'What is Entity?'
  );

  p.note(
    `This entity will have access to your shell, browser, and files within
a sandboxed workspace. You control what it can do through autonomy settings.`,
    'Security Notice'
  );

  const ready = await p.confirm({
    message: 'Ready to begin?',
    initialValue: true,
  });

  if (p.isCancel(ready) || !ready) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  return true;
}

/**
 * Phase 2: Meet the User
 */
async function phase2MeetUser(args) {
  if (!args.interactive) {
    return {
      name: args.userName || 'User',
      callName: args.callName || args.userName || 'User',
      whatYouDo: args.whatYouDo || '',
      workingOn: args.workingOn || '',
      commStyle: args.commStyle || 'casual',
      helpAreas: args.helpAreas ? args.helpAreas.split(',') : ['everything'],
      anythingElse: args.anythingElse || '',
    };
  }

  p.log.step("Let's start with you. The entity needs to know who it's working with.");

  const name = await p.text({
    message: "What's your name?",
    placeholder: 'Your full name',
    validate: (value) => {
      if (!value || value.trim().length === 0) return 'Name is required';
    },
  });
  if (p.isCancel(name)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const firstName = name.split(' ')[0];
  const callName = await p.text({
    message: 'What should the entity call you?',
    placeholder: firstName,
    defaultValue: firstName,
  });
  if (p.isCancel(callName)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const whatYouDo = await p.text({
    message: 'What do you do?',
    placeholder: 'e.g. founder building a SaaS product, software engineer at Google, student studying CS...',
  });
  if (p.isCancel(whatYouDo)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const workingOn = await p.text({
    message: 'What are you working on right now?',
    placeholder: 'e.g. launching my startup, learning React, automating my workflow...',
  });
  if (p.isCancel(workingOn)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const commStyle = await p.select({
    message: 'How do you like to communicate?',
    options: [
      { value: 'casual', label: 'Casual & direct', hint: 'default' },
      { value: 'professional', label: 'Professional but friendly' },
      { value: 'formal', label: 'Formal' },
      { value: 'adaptive', label: 'Match my energy' },
    ],
  });
  if (p.isCancel(commStyle)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const helpAreas = await p.multiselect({
    message: 'What do you want the entity to help with?',
    options: [
      { value: 'coding', label: 'Coding & development' },
      { value: 'research', label: 'Research & learning' },
      { value: 'files', label: 'File & project management' },
      { value: 'browser', label: 'Web browsing & automation' },
      { value: 'thinking', label: 'Thinking partner / brainstorming' },
      { value: 'everything', label: 'Everything' },
    ],
    required: true,
  });
  if (p.isCancel(helpAreas)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const anythingElse = await p.text({
    message: 'Anything else the entity should know about you?',
    placeholder: 'hobbies, preferences, pet peeves, anything... (optional)',
  });
  if (p.isCancel(anythingElse)) { p.cancel('Setup cancelled.'); process.exit(0); }

  return {
    name,
    callName: callName || firstName,
    whatYouDo: whatYouDo || '',
    workingOn: workingOn || '',
    commStyle,
    helpAreas,
    anythingElse: anythingElse || '',
  };
}

/**
 * Phase 3: Name the Entity
 */
async function phase3NameEntity(args) {
  if (!args.interactive) {
    return {
      name: args.entityName || 'Entity',
      personality: args.personality || 'curious, direct, thoughtful',
      autonomy: args.autonomy || 'balanced',
    };
  }

  p.log.step("Now let's set up the entity itself.");

  const name = await p.text({
    message: 'What do you want to name your entity?',
    placeholder: 'Entity',
    defaultValue: 'Entity',
  });
  if (p.isCancel(name)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const personality = await p.text({
    message: 'Describe its personality in a few words',
    placeholder: 'e.g. witty and sharp, calm and methodical, warm and enthusiastic...',
    defaultValue: 'curious, direct, thoughtful',
  });
  if (p.isCancel(personality)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const autonomy = await p.select({
    message: 'How autonomous should it be?',
    options: [
      { value: 'conservative', label: 'Conservative', hint: 'asks before any non-read action' },
      { value: 'balanced', label: 'Balanced', hint: 'recommended — reads and simple writes autonomous, rest asks' },
      { value: 'full_trust', label: 'Full trust', hint: 'only dangerous/destructive actions ask' },
    ],
    initialValue: 'balanced',
  });
  if (p.isCancel(autonomy)) { p.cancel('Setup cancelled.'); process.exit(0); }

  return {
    name: name || 'Entity',
    personality: personality || 'curious, direct, thoughtful',
    autonomy,
  };
}

/**
 * Phase 4: LLM Setup
 */
async function phase4LLMSetup(args) {
  if (!args.interactive) {
    const provider = args.llmProvider || 'anthropic';
    return buildLLMConfig(provider, {
      apiKey: args.llmApiKey || '',
      model: args.llmModel || getDefaultModel(provider),
      baseUrl: args.llmBaseUrl || '',
    });
  }

  p.log.step("The entity needs a brain. Choose an LLM provider.");

  const provider = await p.select({
    message: 'Which LLM provider?',
    options: [
      { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'recommended, supports prompt caching' },
      { value: 'openai', label: 'OpenAI (GPT)' },
      { value: 'openrouter', label: 'OpenRouter', hint: 'access any model through one API' },
      { value: 'ollama', label: 'Ollama (local)', hint: 'free, private, runs on your machine' },
      { value: 'custom', label: 'Custom endpoint', hint: 'any OpenAI-compatible API' },
    ],
  });
  if (p.isCancel(provider)) { p.cancel('Setup cancelled.'); process.exit(0); }

  let config;

  switch (provider) {
    case 'anthropic': {
      const apiKey = await p.password({
        message: 'Anthropic API key:',
        validate: (value) => {
          if (!value) return 'API key is required';
        },
      });
      if (p.isCancel(apiKey)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const model = await p.select({
        message: 'Which model?',
        options: [
          { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5', hint: 'recommended' },
          { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
          { value: 'claude-haiku-4-5-20250514', label: 'Claude Haiku 4.5' },
        ],
      });
      if (p.isCancel(model)) { p.cancel('Setup cancelled.'); process.exit(0); }

      config = {
        api: 'anthropic-messages',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey,
        model,
        promptCaching: true,
      };
      break;
    }

    case 'openai': {
      const apiKey = await p.password({
        message: 'OpenAI API key:',
        validate: (value) => {
          if (!value) return 'API key is required';
        },
      });
      if (p.isCancel(apiKey)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const model = await p.select({
        message: 'Which model?',
        options: [
          { value: 'gpt-4o', label: 'GPT-4o', hint: 'recommended' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-5', label: 'GPT-5' },
        ],
      });
      if (p.isCancel(model)) { p.cancel('Setup cancelled.'); process.exit(0); }

      config = {
        api: 'openai-completions',
        baseUrl: 'https://api.openai.com/v1',
        apiKey,
        model,
        promptCaching: false,
      };
      break;
    }

    case 'openrouter': {
      const apiKey = await p.password({
        message: 'OpenRouter API key:',
        validate: (value) => {
          if (!value) return 'API key is required';
        },
      });
      if (p.isCancel(apiKey)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const model = await p.text({
        message: 'Model name:',
        placeholder: 'anthropic/claude-sonnet-4-5',
        defaultValue: 'anthropic/claude-sonnet-4-5',
      });
      if (p.isCancel(model)) { p.cancel('Setup cancelled.'); process.exit(0); }

      config = {
        api: 'openai-completions',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey,
        model,
        promptCaching: false,
      };
      break;
    }

    case 'ollama': {
      const baseUrl = await p.text({
        message: 'Ollama base URL:',
        placeholder: 'http://127.0.0.1:11434/v1',
        defaultValue: 'http://127.0.0.1:11434/v1',
      });
      if (p.isCancel(baseUrl)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const model = await p.text({
        message: 'Model name:',
        placeholder: 'llama3.3:70b',
        defaultValue: 'llama3.3:70b',
      });
      if (p.isCancel(model)) { p.cancel('Setup cancelled.'); process.exit(0); }

      config = {
        api: 'openai-completions',
        baseUrl,
        apiKey: 'ollama',
        model,
        promptCaching: false,
      };
      break;
    }

    case 'custom': {
      const baseUrl = await p.text({
        message: 'Base URL:',
        placeholder: 'https://your-api.example.com/v1',
        validate: (value) => {
          if (!value) return 'Base URL is required';
        },
      });
      if (p.isCancel(baseUrl)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const apiKey = await p.password({
        message: 'API key (optional):',
      });
      if (p.isCancel(apiKey)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const model = await p.text({
        message: 'Model name:',
        validate: (value) => {
          if (!value) return 'Model name is required';
        },
      });
      if (p.isCancel(model)) { p.cancel('Setup cancelled.'); process.exit(0); }

      const apiFormat = await p.select({
        message: 'API format:',
        options: [
          { value: 'openai-completions', label: 'OpenAI-compatible' },
          { value: 'anthropic-messages', label: 'Anthropic-compatible' },
        ],
      });
      if (p.isCancel(apiFormat)) { p.cancel('Setup cancelled.'); process.exit(0); }

      config = {
        api: apiFormat,
        baseUrl,
        apiKey: apiKey || '',
        model,
        promptCaching: apiFormat === 'anthropic-messages',
      };
      break;
    }
  }

  // Test connection
  const spin = p.spinner();
  spin.start('Testing LLM connection...');

  try {
    await testLLMConnection(config);
    spin.stop(`Connected to ${config.model} successfully`);
  } catch (error) {
    spin.stop(`Connection failed: ${error.message}`);

    const retry = await p.confirm({
      message: 'Would you like to try again with different settings?',
      initialValue: true,
    });

    if (retry) {
      return phase4LLMSetup(args);
    } else {
      p.log.warn('Continuing without testing. You may need to fix the config later.');
    }
  }

  return config;
}

function getDefaultModel(provider) {
  const defaults = {
    anthropic: 'claude-sonnet-4-5-20250514',
    openai: 'gpt-4o',
    openrouter: 'anthropic/claude-sonnet-4-5',
    ollama: 'llama3.3:70b',
    custom: '',
  };
  return defaults[provider] || '';
}

function buildLLMConfig(provider, options) {
  const configs = {
    anthropic: {
      api: 'anthropic-messages',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: options.apiKey,
      model: options.model || 'claude-sonnet-4-5-20250514',
      promptCaching: true,
    },
    openai: {
      api: 'openai-completions',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: options.apiKey,
      model: options.model || 'gpt-4o',
      promptCaching: false,
    },
    openrouter: {
      api: 'openai-completions',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: options.apiKey,
      model: options.model || 'anthropic/claude-sonnet-4-5',
      promptCaching: false,
    },
    ollama: {
      api: 'openai-completions',
      baseUrl: options.baseUrl || 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
      model: options.model || 'llama3.3:70b',
      promptCaching: false,
    },
    custom: {
      api: 'openai-completions',
      baseUrl: options.baseUrl,
      apiKey: options.apiKey || '',
      model: options.model,
      promptCaching: false,
    },
  };
  return configs[provider];
}

async function testLLMConnection(config) {
  const isAnthropic = config.api === 'anthropic-messages';

  if (isAnthropic) {
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: "Respond with the word 'hello'" }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
  } else {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: "Respond with the word 'hello'" }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
  }
}

/**
 * Phase 5: Deployment
 */
async function phase5Deployment(args) {
  if (!args.interactive) {
    return {
      type: args.deploy || 'manual',
      installDaemon: args.installDaemon === 'true' || args.installDaemon === true,
    };
  }

  p.log.step('Where will the entity live?');

  const deployType = await p.select({
    message: 'Deployment type?',
    options: [
      { value: 'local', label: 'This machine (local)', hint: 'runs as a background daemon' },
      { value: 'docker', label: 'Docker container', hint: 'for VPS or isolated deployment' },
      { value: 'manual', label: 'Manual', hint: 'just give me the start command' },
    ],
  });
  if (p.isCancel(deployType)) { p.cancel('Setup cancelled.'); process.exit(0); }

  let installDaemon = false;

  if (deployType === 'local') {
    const os = platform();
    const osName = os === 'darwin' ? 'macOS' : os === 'linux' ? 'Linux' : os;

    installDaemon = await p.confirm({
      message: `Install as a background service on ${osName} that starts on boot?`,
      initialValue: true,
    });
    if (p.isCancel(installDaemon)) { p.cancel('Setup cancelled.'); process.exit(0); }
  }

  return {
    type: deployType,
    installDaemon,
  };
}

/**
 * Phase 6: Initialize Mind
 */
async function phase6InitMind(userProfile, entityProfile, llmConfig, deployConfig, interactive) {
  if (interactive) {
    p.log.step(`Creating ${entityProfile.name}'s mind...`);
  }

  // Check if mind already exists
  const mindPath = join(PROJECT_ROOT, 'mind');
  if (existsSync(mindPath)) {
    if (interactive) {
      const overwrite = await p.confirm({
        message: 'Mind directory already exists. Overwrite?',
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel('Setup cancelled. Delete the mind directory first if you want to start fresh.');
        process.exit(0);
      }
    }
    // Remove existing mind directory
    const { rmSync } = await import('fs');
    rmSync(mindPath, { recursive: true, force: true });
  }

  // Initialize personalized mind
  const spin = interactive ? p.spinner() : null;

  const groups = [
    'identity',
    'memory',
    'thoughts',
    'goals',
    'emotions',
    'world',
    'meta',
    'self',
    'actions',
    'security',
    'workspace',
    'git',
    'config',
  ];

  for (const group of groups) {
    if (spin) spin.start(`Creating ${group} files...`);

    await initMindPersonalized(
      PROJECT_ROOT,
      group,
      userProfile,
      entityProfile,
      llmConfig,
      deployConfig
    );

    if (spin) spin.stop(`Created ${group} files`);
  }

  if (interactive) {
    p.log.success(`${entityProfile.name}'s mind has been created!`);
  }
}

/**
 * Phase 7: First Boot
 */
async function phase7FirstBoot(entityProfile, deployConfig, interactive) {
  if (interactive) {
    p.log.step(`Waking up ${entityProfile.name}...`);
  }

  // Install daemon if requested
  if (deployConfig.type === 'local' && deployConfig.installDaemon) {
    const spin = interactive ? p.spinner() : null;
    if (spin) spin.start('Installing background service...');

    try {
      await installDaemon();
      if (spin) spin.stop('Background service installed');
    } catch (error) {
      if (spin) spin.stop(`Failed to install service: ${error.message}`);
      if (interactive) {
        p.log.warn("You can still start manually with 'npm start'");
      }
    }
  }

  // Generate Docker files if needed
  if (deployConfig.type === 'docker') {
    await generateDockerFiles();
    if (interactive) {
      p.log.info("Docker files generated. Run 'docker-compose up -d --build' to start.");
    }
  }

  // For manual or local without daemon, show start command
  if (deployConfig.type === 'manual' || (deployConfig.type === 'local' && !deployConfig.installDaemon)) {
    if (interactive) {
      p.note("Run 'npm start' or 'node src/index.js' to start the entity.", 'Start Command');
    }
  }

  // Final message
  if (interactive) {
    console.log('');
    console.log('═'.repeat(60));
    console.log(`  ${entityProfile.name} is ready!`);
    console.log('═'.repeat(60));
    console.log('');
    console.log('  Commands:');
    console.log('    entity start     Start the daemon');
    console.log('    entity stop      Stop the daemon');
    console.log('    entity chat      Interactive conversation');
    console.log('    entity status    Show current state');
    console.log('    entity logs      View thought stream');
    console.log('    entity doctor    Health check');
    console.log('');
    console.log(`  Or just run: npm start`);
    console.log('');

    p.outro(`${entityProfile.name} awaits. 🌟`);
  }
}

/**
 * Install daemon based on OS
 */
async function installDaemon() {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') {
    // macOS LaunchAgent
    const plistDir = join(home, 'Library', 'LaunchAgents');
    const plistPath = join(plistDir, 'com.entity.daemon.plist');
    const logsDir = join(home, '.entity', 'logs');

    mkdirSync(plistDir, { recursive: true });
    mkdirSync(logsDir, { recursive: true });

    const nodePath = process.execPath;
    const indexPath = join(PROJECT_ROOT, 'src', 'index.js');

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.entity.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${indexPath}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logsDir}/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${logsDir}/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>ENTITY_DAEMON</key>
        <string>1</string>
    </dict>
</dict>
</plist>`;

    writeFileSync(plistPath, plist);

    // Load the daemon
    await new Promise((resolve, reject) => {
      const proc = spawn('launchctl', ['load', plistPath], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`launchctl load failed with code ${code}`));
      });
    });

  } else if (os === 'linux') {
    // Linux systemd user service
    const serviceDir = join(home, '.config', 'systemd', 'user');
    const servicePath = join(serviceDir, 'entity.service');
    const logsDir = join(home, '.entity', 'logs');

    mkdirSync(serviceDir, { recursive: true });
    mkdirSync(logsDir, { recursive: true });

    const nodePath = process.execPath;
    const indexPath = join(PROJECT_ROOT, 'src', 'index.js');

    const service = `[Unit]
Description=Entity AI Daemon
After=network.target

[Service]
ExecStart=${nodePath} ${indexPath}
WorkingDirectory=${PROJECT_ROOT}
Restart=always
RestartSec=10
Environment=ENTITY_DAEMON=1
StandardOutput=append:${logsDir}/stdout.log
StandardError=append:${logsDir}/stderr.log

[Install]
WantedBy=default.target
`;

    writeFileSync(servicePath, service);

    // Reload and enable the service
    await new Promise((resolve, reject) => {
      const proc = spawn('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' });
      proc.on('close', () => resolve());
    });

    await new Promise((resolve, reject) => {
      const proc = spawn('systemctl', ['--user', 'enable', 'entity'], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`systemctl enable failed with code ${code}`));
      });
    });

    await new Promise((resolve, reject) => {
      const proc = spawn('systemctl', ['--user', 'start', 'entity'], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`systemctl start failed with code ${code}`));
      });
    });

  } else {
    throw new Error(`Unsupported OS for daemon: ${os}`);
  }
}

/**
 * Generate Docker files
 */
async function generateDockerFiles() {
  const dockerfile = `FROM node:20-slim

WORKDIR /app

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \\
    chromium \\
    --no-install-recommends \\
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source
COPY . .

# Set environment
ENV ENTITY_DAEMON=1

# Run
CMD ["node", "src/index.js"]
`;

  const dockerCompose = `version: '3.8'

services:
  entity:
    build: .
    volumes:
      - ./mind:/app/mind
      - ./entity-workspace:/app/entity-workspace
      - ./config:/app/config
    ports:
      - "3000:3000"
      - "3001:3001"
    restart: unless-stopped
    environment:
      - LLM_API_KEY=\${LLM_API_KEY}
      - ENTITY_DAEMON=1
`;

  writeFileSync(join(PROJECT_ROOT, 'Dockerfile'), dockerfile);
  writeFileSync(join(PROJECT_ROOT, 'docker-compose.yml'), dockerCompose);
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs();

  // Phase 1: Welcome
  await phase1Welcome(args.interactive);

  // Phase 2: Meet the user
  const userProfile = await phase2MeetUser(args);

  // Phase 3: Name the entity
  const entityProfile = await phase3NameEntity(args);

  // Phase 4: LLM Setup
  const llmConfig = await phase4LLMSetup(args);

  // Phase 5: Deployment
  const deployConfig = await phase5Deployment(args);

  // Phase 6: Initialize Mind
  await phase6InitMind(userProfile, entityProfile, llmConfig, deployConfig, args.interactive);

  // Phase 7: First Boot
  await phase7FirstBoot(entityProfile, deployConfig, args.interactive);
}

// Run
main().catch((err) => {
  console.error('Onboarding failed:', err);
  process.exit(1);
});
