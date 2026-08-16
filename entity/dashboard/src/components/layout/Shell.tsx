import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import type { EntityStatus } from "@/lib/types"

interface ShellProps {
  children: ReactNode
  currentPage: string
  onNavigate: (page: string) => void
  theme: "dark" | "light"
  onToggleTheme: () => void
  status: EntityStatus | null
  onRefresh: () => void
  onTogglePause: () => void
  onToggleGo: () => void
}

export function Shell({
  children,
  currentPage,
  onNavigate,
  theme,
  onToggleTheme,
  status,
  onRefresh,
  onTogglePause,
  onToggleGo,
}: ShellProps) {
  return (
    <div className={`flex h-screen ${theme === "dark" ? "dark" : ""}`}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          status={status}
          onRefresh={onRefresh}
          onTogglePause={onTogglePause}
          onToggleGo={onToggleGo}
        />
        <main className="flex-1 overflow-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
