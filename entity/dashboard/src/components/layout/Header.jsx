import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Pause, Play } from "lucide-react"

export function Header({ status, onRefresh, onTogglePause }) {
  const isRunning = status?.state === "running"
  const isPaused = status?.state === "paused"

  const getStatusVariant = () => {
    if (isRunning) return "success"
    if (isPaused) return "warning"
    return "secondary"
  }

  const getStatusText = () => {
    if (isRunning) return "Running"
    if (isPaused) return "Paused"
    return status?.state || "Unknown"
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">
          {status?.name || "Entity Dashboard"}
        </h1>
        <Badge variant={getStatusVariant()}>{getStatusText()}</Badge>
        {status?.cycleCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            Cycle #{status.cycleCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button
          variant={isPaused ? "default" : "outline"}
          size="sm"
          onClick={onTogglePause}
        >
          {isPaused ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </>
          )}
        </Button>
      </div>
    </header>
  )
}
