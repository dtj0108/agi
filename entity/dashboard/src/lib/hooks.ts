import { useState, useEffect, useCallback, useRef } from "react"
import api from "./api"
import createEntitySocket from "./websocket"
import type { EntitySocketClient, EntitySocketHandlers } from "./websocket"

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return "Unknown error"
}

export function useEntityStatus() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getStatus()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { status, loading, error, refresh, setStatus }
}

export function useEntitySocket(handlers: EntitySocketHandlers = {}) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<EntitySocketClient | null>(null)

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
  }, [])

  return { connected, socket: socketRef.current }
}

export function useThoughts(maxItems = 100) {
  const [thoughts, setThoughts] = useState<any[]>([])

  const addThought = useCallback(
    (thought: any) => {
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

export function useActionHistory(initialLimit = 50) {
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getHistory(initialLimit)
      setActions(data.actions || data || [])
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [initialLimit])

  const addAction = useCallback((action: any) => {
    setActions((prev) => [action, ...prev])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { actions, loading, error, refresh, addAction }
}

export function usePendingApprovals() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getPendingApprovals()
      setApprovals(data.pending || data || [])
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const approve = useCallback(async (id: string) => {
    await api.approve(id)
    setApprovals((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const deny = useCallback(async (id: string) => {
    await api.deny(id)
    setApprovals((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const addApproval = useCallback((approval: any) => {
    setApprovals((prev) => [approval, ...prev])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { approvals, loading, error, refresh, approve, deny, addApproval }
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("entity-theme")
    if (saved === "dark" || saved === "light") return saved
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
