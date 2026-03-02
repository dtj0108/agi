import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  Settings,
  Brain,
  Activity,
  MessageSquare,
  Puzzle,
  Moon,
  Sun,
} from "lucide-react"

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "config", label: "Configuration", icon: Settings },
  { id: "skills", label: "Skills", icon: Puzzle },
  { id: "mind", label: "Mind", icon: Brain },
  { id: "monitor", label: "Monitor", icon: Activity },
  { id: "chat", label: "Chat", icon: MessageSquare },
]

export function Sidebar({ currentPage, onNavigate, theme, onToggleTheme }) {
  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Logo/Title */}
      <div className="flex h-16 items-center border-b px-6">
        <Brain className="h-6 w-6 mr-2 text-primary" />
        <span className="text-lg font-semibold">Entity</span>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary"
                )}
                onClick={() => onNavigate(item.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <>
              <Sun className="mr-2 h-4 w-4" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              Dark Mode
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
