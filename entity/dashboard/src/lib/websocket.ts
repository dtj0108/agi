const DEFAULT_WS_URL = (() => {
  if (typeof window === "undefined") return "ws://localhost:3001"
  const protocol = window.location.protocol === "https:" ? "wss" : "ws"
  const host = window.location.hostname
  const envPort = import.meta.env.VITE_WS_PORT
  const port = envPort || "3001"
  return `${protocol}://${host}:${port}`
})()

const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL

export interface EntitySocketHandlers {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  onStatus?: (payload: any) => void
  onThought?: (payload: any) => void
  onAction?: (payload: any) => void
  onEmotion?: (payload: any) => void
  onCycleStart?: (payload: any) => void
  onCycleEnd?: (payload: any) => void
  onApprovalRequired?: (payload: any) => void
  onMessage?: (payload: any) => void
  onUnknown?: (payload: any) => void
}

export interface EntitySocketClient {
  send: (type: string, payload: any) => boolean
  disconnect: () => void
  reconnect: () => void
  readonly connected: boolean
}

function getApiKey() {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const queryToken = params.get("api_key") || params.get("token")
  if (queryToken) {
    localStorage.setItem("entity-api-key", queryToken)
  }
  return localStorage.getItem("entity-api-key")
}

export function createEntitySocket(
  handlers: EntitySocketHandlers = {}
): EntitySocketClient {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 10
  const reconnectDelay = 2000

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return

    const apiKey = getApiKey()
    const url = apiKey
      ? `${WS_URL}${WS_URL.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`
      : WS_URL
    ws = new WebSocket(url)

    ws.onopen = () => {
      console.log("[WS] Connected to Entity")
      reconnectAttempts = 0
      handlers.onConnect?.()
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data))
        handleMessage(data)
      } catch (err) {
        console.error("[WS] Failed to parse message:", err)
      }
    }

    ws.onclose = () => {
      console.log("[WS] Disconnected")
      handlers.onDisconnect?.()
      scheduleReconnect()
    }

    ws.onerror = (err: Event) => {
      console.error("[WS] Error:", err)
      handlers.onError?.(err)
    }
  }

  function handleMessage(data: any) {
    const { type, payload } = data

    switch (type) {
      case "status":
        handlers.onStatus?.(payload)
        break
      case "thought":
        handlers.onThought?.(payload)
        break
      case "action":
        handlers.onAction?.(payload)
        break
      case "emotion":
        handlers.onEmotion?.(payload)
        break
      case "cycle_start":
        handlers.onCycleStart?.(payload)
        break
      case "cycle_end":
        handlers.onCycleEnd?.(payload)
        break
      case "approval_required":
        handlers.onApprovalRequired?.(payload)
        break
      case "message":
        handlers.onMessage?.(payload)
        break
      default:
        handlers.onUnknown?.(data)
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log("[WS] Max reconnect attempts reached")
      return
    }

    reconnectTimer = setTimeout(() => {
      reconnectAttempts++
      console.log(`[WS] Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`)
      connect()
    }, reconnectDelay)
  }

  function send(type: string, payload: any) {
    if (ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send - not connected")
      return false
    }

    ws.send(JSON.stringify({ type, payload }))
    return true
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectAttempts = maxReconnectAttempts
    ws?.close()
    ws = null
  }

  connect()

  return {
    send,
    disconnect,
    reconnect: connect,
    get connected() {
      return ws?.readyState === WebSocket.OPEN
    },
  }
}

export default createEntitySocket
