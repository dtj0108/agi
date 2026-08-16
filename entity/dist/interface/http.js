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
import { getAuthManager } from '../auth/index.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
export class HttpServer extends EventEmitter {
    actionGateway;
    app;
    authManager;
    autonomy;
    cognitiveEngine;
    config;
    mindServer;
    paused;
    server;
    constructor(config, cognitiveEngine, actionGateway, mindServer, autonomy = null, authManager = null) {
        super();
        this.config = config;
        this.cognitiveEngine = cognitiveEngine;
        this.actionGateway = actionGateway;
        this.mindServer = mindServer;
        this.autonomy = autonomy;
        this.authManager = authManager || getAuthManager(config);
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
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/message' });
                res.status(500).json({ error: err.message });
            }
        });
        // Get entity status
        this.app.get('/status', async (req, res) => {
            try {
                const status = await this.cognitiveEngine.getStatus();
                const health = telemetry.snapshotHealth();
                const autonomy = this.autonomy?.getStatus?.() || this.getAutonomyStatusFallback();
                const auth = await this.authManager.getAuthStatus();
                res.json({
                    ...status,
                    state: this.paused ? 'paused' : 'running',
                    paused: this.paused,
                    uptime: process.uptime(),
                    health,
                    autonomy,
                    auth,
                });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/status' });
                res.status(500).json({ error: err.message });
            }
        });
        // Get local auth status (no secret material returned)
        this.app.get('/auth/status', async (req, res) => {
            try {
                const auth = await this.authManager.getAuthStatus();
                res.json(auth);
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/auth/status' });
                res.status(500).json({ error: err.message });
            }
        });
        // Diagnostics: recent errors
        this.app.get('/diagnostics/errors', async (req, res) => {
            try {
                const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
                const errors = telemetry.getRecentErrors(limit);
                res.json({ errors, count: errors.length });
            }
            catch (err) {
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
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/diagnostics/metrics' });
                res.status(500).json({ error: err.message });
            }
        });
        // Read a mind file
        this.app.get(/^\/mind\/(.+)/, async (req, res) => {
            try {
                const relativePath = decodeURIComponent(req.params[0]);
                const content = await this.mindServer.readFile(relativePath);
                res.json({ path: relativePath, content });
            }
            catch (err) {
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
        // Switch autonomy mode to go
        this.app.post('/go', (req, res) => {
            try {
                if (!this.autonomy) {
                    return res.status(503).json({ error: 'Autonomy controller unavailable' });
                }
                const status = this.autonomy.setMode('go', { source: 'http' });
                res.json({ success: true, autonomy: status });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/go' });
                res.status(500).json({ error: err.message });
            }
        });
        // Switch autonomy mode to manual
        this.app.post('/stop', (req, res) => {
            try {
                if (!this.autonomy) {
                    return res.status(503).json({ error: 'Autonomy controller unavailable' });
                }
                const status = this.autonomy.setMode('manual', { source: 'http' });
                res.json({ success: true, autonomy: status });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/stop' });
                res.status(500).json({ error: err.message });
            }
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
            }
            catch (err) {
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
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/history' });
                res.status(500).json({ error: err.message });
            }
        });
        // Get pending approvals
        this.app.get('/approvals', async (req, res) => {
            try {
                const pending = this.actionGateway.getPendingApprovals?.() || [];
                res.json({ pending });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/approvals' });
                res.status(500).json({ error: err.message });
            }
        });
        // Get configuration
        this.app.get('/config', (req, res) => {
            const autonomyLevel = this.actionGateway.getAutonomyLevel?.() || this.getAutonomyLevelFallback();
            const blockedPatterns = Array.isArray(this.config.actions?.blockedPatterns)
                ? [...this.config.actions.blockedPatterns]
                : [];
            const autonomyMode = this.validateAutonomyMode(this.config.autonomy?.mode) || 'go';
            const goConfig = this.getAutonomyGoConfig(this.config.autonomy?.go);
            // Return a sanitized version of config (without API keys)
            const safeConfig = {
                llm: {
                    model: this.config.llm?.model,
                    maxTokens: this.config.llm?.maxTokens,
                    temperature: this.config.llm?.temperature,
                    promptCaching: this.config.llm?.promptCaching,
                    credentialSource: this.config.llm?.credentialSource,
                },
                actions: {
                    autonomy: autonomyLevel,
                    blockedPatterns,
                },
                // Compatibility alias for older clients.
                autonomy: {
                    mode: autonomyMode,
                    go: goConfig,
                    level: autonomyLevel,
                    blockedPatterns,
                },
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
                const updates = req.body || {};
                // Only allow updating safe config options
                if (updates.llm) {
                    this.config.llm = { ...this.config.llm, ...updates.llm };
                }
                if (updates.heartbeat) {
                    this.config.heartbeat = { ...this.config.heartbeat, ...updates.heartbeat };
                }
                if (updates.autonomy?.mode !== undefined) {
                    const mode = this.validateAutonomyMode(updates.autonomy.mode);
                    if (!mode) {
                        return res.status(400).json({
                            success: false,
                            error: 'Invalid autonomy mode',
                            allowed: ['manual', 'heartbeat', 'go'],
                        });
                    }
                    this.config.autonomy = this.config.autonomy || {};
                    this.config.autonomy.mode = mode;
                    this.autonomy?.setMode?.(mode, { source: 'http_config' });
                }
                if (updates.autonomy?.go !== undefined) {
                    const go = updates.autonomy.go;
                    if (typeof go !== 'object' || go === null) {
                        return res.status(400).json({
                            success: false,
                            error: 'autonomy.go must be an object',
                        });
                    }
                    const nextGo = { ...this.getAutonomyGoConfig(this.config.autonomy?.go) };
                    if (go.minDelayMs !== undefined) {
                        const parsedMinDelay = this.parseNonNegativeInt(go.minDelayMs);
                        if (parsedMinDelay === null) {
                            return res.status(400).json({
                                success: false,
                                error: 'autonomy.go.minDelayMs must be a non-negative integer',
                            });
                        }
                        nextGo.minDelayMs = parsedMinDelay;
                    }
                    if (go.maxConsecutiveErrors !== undefined) {
                        const parsedMaxErrors = this.parsePositiveInt(go.maxConsecutiveErrors);
                        if (parsedMaxErrors === null) {
                            return res.status(400).json({
                                success: false,
                                error: 'autonomy.go.maxConsecutiveErrors must be a positive integer',
                            });
                        }
                        nextGo.maxConsecutiveErrors = parsedMaxErrors;
                    }
                    this.config.autonomy = this.config.autonomy || {};
                    this.config.autonomy.go = nextGo;
                    this.autonomy?.updateGoConfig?.(nextGo, { source: 'http_config' });
                }
                const autonomyCandidate = updates.actions?.autonomy ?? updates.autonomy?.level;
                if (autonomyCandidate !== undefined) {
                    const autonomy = this.validateAutonomyLevel(autonomyCandidate);
                    if (!autonomy) {
                        return res.status(400).json({
                            success: false,
                            error: 'Invalid autonomy level',
                            allowed: ['conservative', 'balanced', 'full_trust'],
                        });
                    }
                    this.config.actions = this.config.actions || {};
                    this.config.actions.autonomy = autonomy;
                }
                const blockedPatternsCandidate = updates.actions?.blockedPatterns ?? updates.autonomy?.blockedPatterns;
                if (blockedPatternsCandidate !== undefined) {
                    if (!Array.isArray(blockedPatternsCandidate) || blockedPatternsCandidate.some((p) => typeof p !== 'string')) {
                        return res.status(400).json({
                            success: false,
                            error: 'blockedPatterns must be an array of strings',
                        });
                    }
                    this.config.actions = this.config.actions || {};
                    this.config.actions.blockedPatterns = blockedPatternsCandidate;
                    this.actionGateway.blockedPatterns = blockedPatternsCandidate;
                }
                this.emit('configUpdated', this.config);
                res.json({ success: true });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/config' });
                res.status(500).json({ error: err.message });
            }
        });
        // Get mind tree structure
        this.app.get('/mind', async (req, res) => {
            try {
                const tree = (await this.mindServer.getTree?.()) || {};
                res.json(tree);
            }
            catch (err) {
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
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/cycle' });
                res.status(500).json({ error: err.message });
            }
        });
        // Skills API endpoints
        this.setupSkillsRoutes(telemetry);
        // Serve dashboard static files
        this.setupDashboard();
    }
    /**
     * Set up skills API routes
     */
    setupSkillsRoutes(telemetry) {
        // Get all skills
        this.app.get('/skills', (req, res) => {
            try {
                const skillsExecutor = this.actionGateway.engines?.skills;
                if (!skillsExecutor) {
                    return res.json({ skills: [], message: 'Skills not initialized' });
                }
                const skills = skillsExecutor
                    .listSkills()
                    .map((skill) => this.withSkillMetadata(skill, skill?._authored === true));
                res.json({ skills });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/skills' });
                res.status(500).json({ error: err.message });
            }
        });
        // Get a specific skill
        this.app.get('/skills/:name', (req, res) => {
            try {
                const { name } = req.params;
                const skillsExecutor = this.actionGateway.engines?.skills;
                if (!skillsExecutor) {
                    return res.status(404).json({ error: 'Skills not initialized' });
                }
                const skill = skillsExecutor.registry?.get(name);
                if (!skill) {
                    return res.status(404).json({ error: `Skill not found: ${name}` });
                }
                const isAuthored = skillsExecutor.isAuthored(name);
                res.json(this.withSkillMetadata(skill.getMetadata(), isAuthored));
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/skills/:name' });
                res.status(500).json({ error: err.message });
            }
        });
        // Test a skill action
        this.app.post('/skills/:name/test', async (req, res) => {
            try {
                const { name } = req.params;
                const { action, ...params } = req.body;
                const skillsExecutor = this.actionGateway.engines?.skills;
                if (!skillsExecutor) {
                    return res.status(404).json({ error: 'Skills not initialized' });
                }
                if (!action || typeof action !== 'string') {
                    return res.status(400).json({ error: 'action is required and must be a string' });
                }
                const tier = skillsExecutor.getTier(name, action);
                if (tier >= 3) {
                    return res.status(403).json({
                        success: false,
                        approvalRequired: true,
                        tier,
                        error: 'Skill test requires approval; execute via standard action flow',
                    });
                }
                telemetry.recordEvent('skills_test_requested', {
                    route: '/skills/:name/test',
                    source: 'dashboard_test',
                    skill: name,
                    action,
                    tier,
                });
                const result = await this.actionGateway.executeAction({
                    tool: 'skill',
                    tier,
                    intent: 'Dashboard skill test',
                    source: 'dashboard_test',
                    params: {
                        skill: name,
                        action,
                        ...params,
                    },
                });
                telemetry.recordEvent('skills_test_completed', {
                    route: '/skills/:name/test',
                    source: 'dashboard_test',
                    skill: name,
                    action,
                    tier,
                    success: result.success !== false,
                });
                res.json({ ...result, tier });
            }
            catch (err) {
                telemetry.recordError('http', err, { route: '/skills/:name/test' });
                res.status(500).json({ error: err.message });
            }
        });
    }
    /**
     * Add public metadata used by dashboard clients.
     */
    withSkillMetadata(skill, authored = false) {
        const actions = Array.isArray(skill?.actions) ? skill.actions : [];
        const tiers = actions
            .map((action) => Number(action?.tier))
            .filter((tier) => Number.isFinite(tier));
        const minTier = tiers.length > 0 ? Math.min(...tiers) : null;
        const maxTier = tiers.length > 0 ? Math.max(...tiers) : null;
        return {
            ...skill,
            _authored: authored || skill?._authored === true,
            tierSummary: {
                actionCount: actions.length,
                minTier,
                maxTier,
                requiresApproval: tiers.some((tier) => tier >= 3),
            },
        };
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
        }
        else {
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
     * Validate autonomy level values from runtime update payloads.
     */
    validateAutonomyLevel(value) {
        return value === 'conservative' || value === 'balanced' || value === 'full_trust'
            ? value
            : null;
    }
    /**
     * Validate autonomy mode values from runtime update payloads.
     */
    validateAutonomyMode(value) {
        return value === 'manual' || value === 'heartbeat' || value === 'go'
            ? value
            : null;
    }
    /**
     * Parse positive integers.
     */
    parsePositiveInt(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return null;
        const normalized = Math.trunc(parsed);
        return normalized >= 1 ? normalized : null;
    }
    /**
     * Parse non-negative integers.
     */
    parseNonNegativeInt(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return null;
        const normalized = Math.trunc(parsed);
        return normalized >= 0 ? normalized : null;
    }
    /**
     * Normalize autonomy go config.
     */
    getAutonomyGoConfig(go) {
        return {
            minDelayMs: this.parseNonNegativeInt(go?.minDelayMs) ?? 2000,
            maxConsecutiveErrors: this.parsePositiveInt(go?.maxConsecutiveErrors) ?? 3,
        };
    }
    /**
     * Safe fallback when ActionGateway helper is unavailable.
     */
    getAutonomyLevelFallback() {
        return this.validateAutonomyLevel(this.config.actions?.autonomy) || 'balanced';
    }
    /**
     * Safe fallback when autonomy controller is unavailable.
     */
    getAutonomyStatusFallback() {
        return {
            mode: this.validateAutonomyMode(this.config.autonomy?.mode) || 'go',
            paused: this.paused,
            go: {
                running: false,
                ...this.getAutonomyGoConfig(this.config.autonomy?.go),
                consecutiveErrors: 0,
            },
            heartbeat: {
                enabled: this.config.heartbeat?.enabled !== false,
                schedule: this.config.heartbeat?.schedule || '*/30 * * * *',
                prompt: this.config.heartbeat?.prompt || '',
                running: false,
            },
        };
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
//# sourceMappingURL=http.js.map