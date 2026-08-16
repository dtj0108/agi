/**
 * WebSocket Interface
 *
 * Real-time bidirectional communication with clients.
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { getTelemetry } from '../observability/telemetry.js';

export class WebSocketInterface extends EventEmitter {
  actionGateway: any;
  clients: any;
  cognitiveEngine: any;
  config: any;
  wss: any;
  constructor(config: any, cognitiveEngine: any, actionGateway: any) {
    super();
    this.config = config;
    this.cognitiveEngine = cognitiveEngine;
    this.actionGateway = actionGateway;
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Start the WebSocket server
   */
  start() {
    const telemetry = getTelemetry();
    const { port, host } = this.getServerOptions();

    this.wss = new WebSocketServer({ port, host });

    this.wss.on('connection', (ws: any, request: any) => {
      if (!this.isAuthorized(request)) {
        telemetry.incrementCounter('ws.auth.rejected', 1);
        ws.close(1008, 'Unauthorized');
        return;
      }

      this.clients.add(ws);
      telemetry.incrementCounter('ws.connected', 1);
      console.log(`[WS] Client connected. Total: ${this.clients.size}`);

      // Send current state on connect
      this.sendToClient(ws, {
        type: 'connected',
        state: this.cognitiveEngine.getState(),
      });

      ws.on('message', async (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          telemetry.incrementCounter('ws.message.received', 1, { type: message.type || 'unknown' });
          await this.handleMessage(ws, message);
        } catch (err: any) {
          telemetry.recordError('ws', err, { stage: 'message_parse_or_handle' });
          this.sendToClient(ws, {
            type: 'error',
            error: err.message,
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        telemetry.incrementCounter('ws.disconnected', 1);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on('error', (err: any) => {
        telemetry.recordError('ws', err, { stage: 'client_error' });
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });

    // Subscribe to cognitive engine events
    this.cognitiveEngine.on('thought', (data: any) => {
      this.broadcast({
        type: 'thought',
        content: data.content,
        phase: data.phase,
        cycleId: data.cycleId,
        timestamp: new Date().toISOString(),
      });
    });

    this.cognitiveEngine.on('emotion', (state: any) => {
      this.broadcast({
        type: 'emotion',
        state,
      });
    });

    this.cognitiveEngine.on('cycle:start', (data: any) => {
      this.broadcast({
        type: 'cycle_start',
        cycleId: data.cycleId,
        stimulus: data.stimulus.type,
      });
    });

    this.cognitiveEngine.on('cycle:complete', (data: any) => {
      this.broadcast({
        type: 'cycle_complete',
        cycleId: data.cycleId,
        duration: data.result.totalDuration,
      });
    });

    // Subscribe to action gateway events
    this.actionGateway.on('approval_required', (data: any) => {
      this.broadcastApprovalNeeded({
        approvalType: 'action',
        approvalId: data.actionId,
        actionId: data.actionId,
        action: data.action,
        message: data.message,
        details: data.details,
      });
    });

    this.actionGateway.on('notification', (data: any) => {
      this.broadcast({
        type: 'notification',
        ...data,
      });
    });

    telemetry.recordEvent('ws_started', { host, port });
    console.log(`[WS] Server listening on ws://${host}:${port}`);
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ws: any, message: any) {
    switch (message.type) {
      case 'message': {
        const result = await this.cognitiveEngine.runCycle({
          type: 'user_message',
          content: message.content,
          metadata: message.metadata || {},
        });

        this.sendToClient(ws, {
          type: 'response',
          content: result.userResponse,
          cycleId: result.cycleId,
        });
        break;
      }

      case 'approve': {
        const approvalId = message.approvalId || message.actionId || message.planId;
        const approved = this.actionGateway.approve(approvalId) ||
                        this.cognitiveEngine.approve(approvalId);
        this.sendToClient(ws, {
          type: 'approval_result',
          approvalId,
          actionId: approvalId,
          approved,
          success: approved,
        });
        break;
      }

      case 'deny': {
        const approvalId = message.approvalId || message.actionId || message.planId;
        const denied = this.actionGateway.deny(approvalId) ||
                      this.cognitiveEngine.deny(approvalId);
        this.sendToClient(ws, {
          type: 'approval_result',
          approvalId,
          actionId: approvalId,
          approved: false,
          success: denied,
        });
        break;
      }

      case 'subscribe': {
        ws.subscriptions = message.events || ['all'];
        break;
      }

      case 'ping': {
        this.sendToClient(ws, { type: 'pong' });
        break;
      }

      default: {
        this.sendToClient(ws, {
          type: 'error',
          error: `Unknown message type: ${message.type}`,
        });
      }
    }
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(ws: any, message: any) {
    const telemetry = getTelemetry();
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
      telemetry.incrementCounter('ws.message.sent', 1, { type: message.type || 'unknown' });
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: any) {
    const telemetry = getTelemetry();
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        // Check subscriptions
        if (!client.subscriptions ||
            client.subscriptions.includes('all') ||
            client.subscriptions.includes(message.type)) {
          client.send(data);
          telemetry.incrementCounter('ws.message.broadcast', 1, { type: message.type || 'unknown' });
        }
      }
    }
  }

  /**
   * Broadcast a normalized approval-needed event
   */
  broadcastApprovalNeeded(payload: any) {
    this.broadcast({
      type: 'approval_needed',
      approvalType: payload.approvalType,
      approvalId: payload.approvalId,
      ...payload,
    });
  }

  /**
   * Forward plan-level approval requests from the cognitive engine
   */
  emitPlanApprovalNeeded(data: any) {
    this.broadcastApprovalNeeded({
      approvalType: 'plan',
      approvalId: data.planId,
      planId: data.planId,
      plan: data.plan,
      message: data.message,
      details: data.plan,
    });
  }

  /**
   * Validate connection auth when API key is configured
   */
  isAuthorized(request: any) {
    const requiredApiKey = this.config.interface?.apiKey;
    if (!requiredApiKey) return true;

    const header = request?.headers?.authorization;
    const authHeader = Array.isArray(header) ? header[0] : header;
    const bearerPrefix = 'Bearer ';
    const bearerToken = authHeader?.startsWith(bearerPrefix)
      ? authHeader.slice(bearerPrefix.length)
      : null;

    let queryToken = null;
    try {
      const host = request?.headers?.host || 'localhost';
      const url = new URL(request?.url || '/', `ws://${host}`);
      queryToken = url.searchParams.get('api_key');
    } catch {
      queryToken = null;
    }

    return bearerToken === requiredApiKey || queryToken === requiredApiKey;
  }

  /**
   * Resolve WebSocket server bind options
   */
  getServerOptions() {
    return {
      port: this.config.interface?.wsPort ?? 3001,
      host: this.config.interface?.host || '127.0.0.1',
    };
  }

  /**
   * Stop the WebSocket server
   */
  stop() {
    const telemetry = getTelemetry();
    if (this.wss) {
      for (const client of this.clients) {
        client.close();
      }
      this.wss.close();
      this.wss = null;
      telemetry.recordEvent('ws_stopped');
    }
  }
}
