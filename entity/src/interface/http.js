/**
 * HTTP Server
 *
 * Express REST API for external interaction with the entity.
 */

import express from 'express';
import { EventEmitter } from 'events';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { getTelemetry } from '../observability/telemetry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class HttpServer extends EventEmitter {
  constructor(config, cognitiveEngine, actionGateway, mindServer) {
    super();
    this.config = config;
    this.cognitiveEngine = cognitiveEngine;
    this.actionGateway = actionGateway;
    this.mindServer = mindServer;
    this.app = express();
    this.server = null;
    this.paused = false;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Set up Express middleware
   */
  setupMiddleware() {
    const telemetry = getTelemetry();
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const durationMs = Date.now() - start;
        telemetry.observeDuration('http.request.duration_ms', durationMs, {
          method: req.method,
          path: req.path,
          statusCode: String(res.statusCode),
        });
        telemetry.incrementCounter('http.request.total', 1, {
          method: req.method,
          path: req.path,
          statusCode: String(res.statusCode),
        });
        console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`);
      });
      next();
    });

    // CORS
    this.app.use((req, res, next) => {
      const allowedOrigins = this.config.interface?.corsOrigins || [
        'http://localhost:3000',
        'http://localhost:5173', // Vite dev server
      ];
      const origin = req.headers.origin;

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      next();
    });

    // API key authentication (if configured)
    if (this.config.interface?.apiKey) {
      this.app.use((req, res, next) => {
        // Skip auth for health check
        if (req.path === '/health') {
          return next();
        }

        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${this.config.interface.apiKey}`) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });
    }
  }

  /**
   * Set up routes
   */
  setupRoutes() {
    const telemetry = getTelemetry();
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Send a message to the entity
    this.app.post('/message', async (req, res) => {
      if (this.paused) {
        return res.status(503).json({ error: 'Entity is paused' });
      }

      try {
        const { content, metadata = {} } = req.body;

        if (!content || typeof content !== 'string') {
          return res.status(400).json({ error: 'content is required and must be a string' });
        }

        const result = await this.cognitiveEngine.runCycle({
          type: 'user_message',
          content,
          metadata,
        });

        res.json({
          response: result.userResponse,
          emotions: result.emotionalState,
          thoughts: result.thoughts,
          cycleId: result.cycleId,
        });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/message' });
        res.status(500).json({ error: err.message });
      }
    });

    // Get entity status
    this.app.get('/status', async (req, res) => {
      try {
        const status = await this.cognitiveEngine.getStatus();
        const health = telemetry.snapshotHealth();
        res.json({
          ...status,
          paused: this.paused,
          uptime: process.uptime(),
          health,
        });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/status' });
        res.status(500).json({ error: err.message });
      }
    });

    // Diagnostics: recent errors
    this.app.get('/diagnostics/errors', async (req, res) => {
      try {
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
        const errors = telemetry.getRecentErrors(limit);
        res.json({ errors, count: errors.length });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/diagnostics/errors' });
        res.status(500).json({ error: err.message });
      }
    });

    // Diagnostics: recent metrics window
    this.app.get('/diagnostics/metrics', async (req, res) => {
      try {
        const windowMinutes = Math.max(1, Math.min(1440, parseInt(req.query.window, 10) || 60));
        const metrics = telemetry.getRecentMetrics(windowMinutes);
        res.json({ windowMinutes, metrics, count: metrics.length });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/diagnostics/metrics' });
        res.status(500).json({ error: err.message });
      }
    });

    // Read a mind file
    this.app.get('/mind/*', async (req, res) => {
      try {
        const relativePath = req.params[0];
        const content = await this.mindServer.readFile(relativePath);
        res.json({ path: relativePath, content });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/mind/*' });
        const mapped = this.mapMindReadError(err);
        res.status(mapped.status).json({ error: mapped.error });
      }
    });

    // Approve a pending action
    this.app.post('/approve/:actionId', (req, res) => {
      const { actionId } = req.params;
      const success = this.actionGateway.approve(actionId) ||
                      this.cognitiveEngine.approve(actionId);
      res.json({ success });
    });

    // Deny a pending action
    this.app.post('/deny/:actionId', (req, res) => {
      const { actionId } = req.params;
      const success = this.actionGateway.deny(actionId) ||
                      this.cognitiveEngine.deny(actionId);
      res.json({ success });
    });

    // Hard kill
    this.app.post('/kill', (req, res) => {
      res.json({ message: 'Shutting down...' });
      this.emit('kill');
    });

    // Soft pause
    this.app.post('/pause', (req, res) => {
      this.paused = true;
      this.cognitiveEngine.pause();
      this.emit('pause');
      res.json({ paused: true });
    });

    // Resume
    this.app.post('/resume', (req, res) => {
      this.paused = false;
      this.cognitiveEngine.resume();
      this.emit('resume');
      res.json({ paused: false });
    });

    // Rollback mind to a commit
    this.app.post('/rollback', async (req, res) => {
      try {
        const { commitHash } = req.body;

        if (!commitHash) {
          return res.status(400).json({ error: 'commitHash is required' });
        }

        await this.mindServer.rollback(commitHash);
        res.json({ success: true, rolledBackTo: commitHash });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/rollback' });
        res.status(500).json({ error: err.message });
      }
    });

    // Get action history
    this.app.get('/history', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const history = await this.actionGateway.getHistory(limit);
        res.json({ history });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/history' });
        res.status(500).json({ error: err.message });
      }
    });

    // Get pending approvals
    this.app.get('/approvals', async (req, res) => {
      try {
        const pending = this.actionGateway.getPendingApprovals?.() || [];
        res.json({ pending });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/approvals' });
        res.status(500).json({ error: err.message });
      }
    });

    // Get configuration
    this.app.get('/config', (req, res) => {
      // Return a sanitized version of config (without API keys)
      const safeConfig = {
        llm: {
          model: this.config.llm?.model,
          maxTokens: this.config.llm?.maxTokens,
          temperature: this.config.llm?.temperature,
          promptCaching: this.config.llm?.promptCaching,
        },
        autonomy: this.config.autonomy,
        heartbeat: this.config.heartbeat,
        interface: {
          httpPort: this.config.interface?.httpPort,
          wsPort: this.config.interface?.wsPort,
        },
      };
      res.json(safeConfig);
    });

    // Update configuration
    this.app.put('/config', (req, res) => {
      try {
        const updates = req.body;
        // Only allow updating safe config options
        if (updates.llm) {
          this.config.llm = { ...this.config.llm, ...updates.llm };
        }
        if (updates.autonomy) {
          this.config.autonomy = { ...this.config.autonomy, ...updates.autonomy };
        }
        if (updates.heartbeat) {
          this.config.heartbeat = { ...this.config.heartbeat, ...updates.heartbeat };
        }
        this.emit('configUpdated', this.config);
        res.json({ success: true });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/config' });
        res.status(500).json({ error: err.message });
      }
    });

    // Get mind tree structure
    this.app.get('/mind', async (req, res) => {
      try {
        const tree = await this.mindServer.getTree?.() || {};
        res.json(tree);
      } catch (err) {
        telemetry.recordError('http', err, { route: '/mind' });
        res.status(500).json({ error: err.message });
      }
    });

    // Trigger a cycle manually
    this.app.post('/cycle', async (req, res) => {
      if (this.paused) {
        return res.status(503).json({ error: 'Entity is paused' });
      }
      try {
        const result = await this.cognitiveEngine.runCycle({
          type: 'manual_trigger',
          content: 'Dashboard triggered cycle',
        });
        res.json({ success: true, cycleId: result.cycleId });
      } catch (err) {
        telemetry.recordError('http', err, { route: '/cycle' });
        res.status(500).json({ error: err.message });
      }
    });

    // Serve dashboard static files
    this.setupDashboard();
  }

  /**
   * Set up dashboard serving
   */
  setupDashboard() {
    const dashboardPath = join(__dirname, '../../dashboard/dist');

    if (existsSync(dashboardPath)) {
      // Serve static files
      this.app.use('/dashboard', express.static(dashboardPath));

      // SPA fallback - serve index.html for any /dashboard/* route
      this.app.get('/dashboard/*', (req, res) => {
        res.sendFile(join(dashboardPath, 'index.html'));
      });

      console.log('[HTTP] Dashboard available at /dashboard');
    } else {
      // Fallback message if dashboard isn't built
      this.app.get('/dashboard', (req, res) => {
        res.send(`
          <html>
            <body style="font-family: system-ui; padding: 2rem;">
              <h1>Dashboard Not Built</h1>
              <p>Run the following to build the dashboard:</p>
              <pre style="background: #f0f0f0; padding: 1rem; border-radius: 4px;">
cd dashboard
npm install
npm run build</pre>
            </body>
          </html>
        `);
      });
    }
  }

  /**
   * Start the HTTP server
   */
  start() {
    const port = this.config.interface?.httpPort ?? 3000;
    const host = this.config.interface?.host || '127.0.0.1';

    this.server = this.app.listen(port, host, () => {
      console.log(`[HTTP] Server listening on http://${host}:${port}`);
    });
  }

  /**
   * Stop the HTTP server
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Map mind read errors to API status codes
   */
  mapMindReadError(err) {
    if (err.code === 'INVALID_PATH') {
      return { status: 400, error: 'Invalid path' };
    }
    if (err.code === 'ENOENT') {
      return { status: 404, error: 'File not found' };
    }
    return { status: 500, error: err.message };
  }
}
