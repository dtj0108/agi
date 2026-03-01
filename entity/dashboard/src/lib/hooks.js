import { useState, useEffect, useCallback, useRef } from "react"
import api from "./api"
import createEntitySocket from "./websocket"

// Hook for Entity status
export function useEntityStatus() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getStatus()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { status, loading, error, refresh, setStatus }
}

// Hook for WebSocket connection
export function useEntitySocket(handlers = {}) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = createEntitySocket({
      onConnect: () => {
        setConnected(true)
        handlers.onConnect?.()
      },
      onDisconnect: () => {
        setConnected(false)
        handlers.onDisconnect?.()
      },
      ...handlers,
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, []) // handlers omitted to prevent reconnection on every render

  return { connected, socket: socketRef.current }
}

// Hook for real-time thoughts
export function useThoughts(maxItems = 100) {
  const [thoughts, setThoughts] = useState([])

  const addThought = useCallback(
    (thought) => {
      setThoughts((prev) => {
        const next = [{ ...thought, timestamp: Date.now() }, ...prev]
        return next.slice(0, maxItems)
      })
    },
    [maxItems]
  )

  const clear = useCallback(() => setThoughts([]), [])

  return { thoughts, addThought, clear }
}

// Hook for action history
export function useActionHistory(initialLimit = 50) {
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getHistory(initialLimit)
      setActions(data.actions || data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [initialLimit])

  const addAction = useCallback((action) => {
    setActions((prev) => [action, ...prev])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { actions, loading, error, refresh, addAction }
}

// Hook for pending approvals
export function usePendingApprovals() {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getPendingApprovals()
      setApprovals(data.pending || data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const approve = useCallback(async (id) => {
    await api.approve(id)
    setApprovals((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const deny = useCallback(async (id) => {
    await api.deny(id)
    setApprovals((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const addApproval = useCallback((approval) => {
    setApprovals((prev) => [approval, ...prev])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { approvals, loading, error, refresh, approve, deny, addApproval }
}

// Hook for theme
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("entity-theme")
    if (saved) return saved
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  })

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      localStorage.setItem("entity-theme", next)
      return next
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return { theme, toggle }
}
