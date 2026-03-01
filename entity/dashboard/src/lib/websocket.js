const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001"

export function createEntitySocket(handlers = {}) {
  let ws = null
  let reconnectTimer = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 10
  const reconnectDelay = 2000

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return

    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log("[WS] Connected to Entity")
      reconnectAttempts = 0
      handlers.onConnect?.()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
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

    ws.onerror = (err) => {
      console.error("[WS] Error:", err)
      handlers.onError?.(err)
    }
  }

  function handleMessage(data) {
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

  function send(type, payload) {
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
    reconnectAttempts = maxReconnectAttempts // Prevent reconnect
    ws?.close()
    ws = null
  }

  // Start connection
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
