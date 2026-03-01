import { useState, useEffect, useCallback } from "react"
import { Shell } from "@/components/layout/Shell"
import { Dashboard } from "@/pages/Dashboard"
import { Config } from "@/pages/Config"
import { Mind } from "@/pages/Mind"
import { Monitor } from "@/pages/Monitor"
import { Chat } from "@/pages/Chat"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  useEntityStatus,
  useEntitySocket,
  useThoughts,
  useActionHistory,
  usePendingApprovals,
  useTheme,
} from "@/lib/hooks"
import api from "@/lib/api"

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard")
  const { theme, toggle: toggleTheme } = useTheme()
  const { status, refresh: refreshStatus, setStatus } = useEntityStatus()
  const { thoughts, addThought } = useThoughts()
  const { actions, addAction, refresh: refreshActions } = useActionHistory()
  const { approvals, approve, deny, addApproval, refresh: refreshApprovals } = usePendingApprovals()
  const [emotions, setEmotions] = useState(null)

  // WebSocket connection
  const { connected } = useEntitySocket({
    onStatus: setStatus,
    onThought: addThought,
    onAction: addAction,
    onEmotion: setEmotions,
    onApprovalRequired: addApproval,
  })

  // Refresh all data
  const refresh = useCallback(() => {
    refreshStatus()
    refreshActions()
    refreshApprovals()
  }, [refreshStatus, refreshActions, refreshApprovals])

  // Pause/Resume handlers
  const handleTogglePause = useCallback(async () => {
    if (status?.state === "paused") {
      await api.resume()
    } else {
      await api.pause()
    }
    refreshStatus()
  }, [status, refreshStatus])

  // Render current page
  function renderPage() {
    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            status={status}
            thoughts={thoughts}
            actions={actions}
            emotions={emotions}
          />
        )
      case "config":
        return <Config />
      case "mind":
        return <Mind />
      case "monitor":
        return (
          <Monitor
            status={status}
            thoughts={thoughts}
            actions={actions}
            approvals={approvals}
            onApprove={approve}
            onDeny={deny}
          />
        )
      case "chat":
        return <Chat />
      default:
        return <Dashboard status={status} />
    }
  }

  return (
    <TooltipProvider>
      <Shell
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        theme={theme}
        onToggleTheme={toggleTheme}
        status={{ ...status, connected }}
        onRefresh={refresh}
        onTogglePause={handleTogglePause}
      >
        {renderPage()}
      </Shell>
    </TooltipProvider>
  )
}

export default App
