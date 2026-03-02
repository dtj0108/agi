/**
 * WebSocket Interface
 *
 * Real-time bidirectional communication with clients.
 */
import { EventEmitter } from 'events';
export declare class WebSocketInterface extends EventEmitter {
    actionGateway: any;
    clients: any;
    cognitiveEngine: any;
    config: any;
    wss: any;
    constructor(config: any, cognitiveEngine: any, actionGateway: any);
    /**
     * Start the WebSocket server
     */
    start(): void;
    /**
     * Handle incoming message
     */
    handleMessage(ws: any, message: any): Promise<void>;
    /**
     * Send a message to a specific client
     */
    sendToClient(ws: any, message: any): void;
    /**
     * Broadcast a message to all connected clients
     */
    broadcast(message: any): void;
    /**
     * Broadcast a normalized approval-needed event
     */
    broadcastApprovalNeeded(payload: any): void;
    /**
     * Forward plan-level approval requests from the cognitive engine
     */
    emitPlanApprovalNeeded(data: any): void;
    /**
     * Validate connection auth when API key is configured
     */
    isAuthorized(request: any): boolean;
    /**
     * Resolve WebSocket server bind options
     */
    getServerOptions(): {
        port: any;
        host: any;
    };
    /**
     * Stop the WebSocket server
     */
    stop(): void;
}
//# sourceMappingURL=websocket.d.ts.map