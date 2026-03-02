import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, Brain, Clock, Zap } from "lucide-react"

export function Dashboard({ status, thoughts, actions, emotions }) {
  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {status?.state || "Unknown"}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.currentPhase || "Idle"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cycles</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.cycleCount || 0}</div>
            <p className="text-xs text-muted-foreground">Total cycles run</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(status?.uptime)}
            </div>
            <p className="text-xs text-muted-foreground">Since last start</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emotion</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {emotions?.primary || "Neutral"}
            </div>
            <Progress
              value={emotions?.intensity ? emotions.intensity * 100 : 50}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Thoughts */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Thoughts</CardTitle>
            <CardDescription>Latest thinking from Entity</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {thoughts?.length > 0 ? (
                <div className="space-y-4">
                  {thoughts.slice(0, 10).map((thought, i) => (
                    <div key={i} className="border-l-2 border-primary pl-4">
                      <p className="text-sm">{thought.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(thought.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No thoughts yet. Entity will share its thinking here.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Actions */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Actions</CardTitle>
            <CardDescription>Latest actions taken</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {actions?.length > 0 ? (
                <div className="space-y-3">
                  {actions.slice(0, 10).map((action, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between border-b pb-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{action.tool}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {action.command || action.description}
                        </p>
                      </div>
                      <Badge
                        variant={
                          action.status === "completed"
                            ? "success"
                            : action.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {action.status || "pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No actions yet. Entity's actions will appear here.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatUptime(ms) {
  if (!ms) return "0s"
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatTime(timestamp) {
  if (!timestamp) return ""
  return new Date(timestamp).toLocaleTimeString()
}
