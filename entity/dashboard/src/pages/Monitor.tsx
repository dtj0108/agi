import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, X, AlertTriangle, Clock, Terminal, Eye } from "lucide-react"
import type { Approval, EntityAction, EntityStatus, Thought } from "@/lib/types"

interface MonitorProps {
  actions: EntityAction[]
  approvals: Approval[]
  onApprove: (id: string) => void
  onDeny: (id: string) => void
  thoughts: Thought[]
  status: EntityStatus | null
}

export function Monitor({
  actions,
  approvals,
  onApprove,
  onDeny,
  thoughts,
  status,
}: MonitorProps) {
  const [selectedAction, setSelectedAction] = useState<EntityAction | null>(null)

  return (
    <div className="space-y-6">
      {/* Live Cycle Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Current Cycle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {phases.map((phase, i) => {
              const isActive = status?.currentPhase === phase.id
              const isPast =
                phases.findIndex((p) => p.id === status?.currentPhase) > i
              return (
                <div key={phase.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isPast
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      isActive ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {phase.label}
                  </span>
                  {i < phases.length - 1 && (
                    <div
                      className={`ml-4 w-8 h-0.5 ${
                        isPast ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Pending Approvals</CardTitle>
              {approvals?.length > 0 && (
                <Badge variant="warning">{approvals.length}</Badge>
              )}
            </div>
            <CardDescription>Actions requiring your approval</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {approvals?.length > 0 ? (
                <div className="space-y-3">
                  {approvals.map((approval) => (
                    <div
                      key={approval.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4" />
                            <span className="font-medium">{approval.tool}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 font-mono">
                            {approval.command}
                          </p>
                        </div>
                        <Badge variant="outline">Tier 3</Badge>
                      </div>
                      {approval.reason && (
                        <p className="text-sm text-muted-foreground">
                          {approval.reason}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onApprove(approval.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeny(approval.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Check className="h-8 w-8 mb-2" />
                  <p>No pending approvals</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Live Thoughts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live Thoughts</CardTitle>
            <CardDescription>Real-time thinking stream</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {thoughts?.length > 0 ? (
                <div className="space-y-3">
                  {thoughts.map((thought, i) => (
                    <div key={i} className="border-l-2 border-primary/50 pl-3">
                      <p className="text-sm">{thought.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {thought.phase && (
                          <Badge variant="outline" className="mr-2 text-xs">
                            {thought.phase}
                          </Badge>
                        )}
                        {formatTime(thought.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Thoughts will appear here during cycles
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Action History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Action History</CardTitle>
          <CardDescription>Recent actions taken by Entity</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="tier1">Tier 1</TabsTrigger>
              <TabsTrigger value="tier2">Tier 2</TabsTrigger>
              <TabsTrigger value="tier3">Tier 3</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ActionList
                actions={actions}
                onSelect={setSelectedAction}
              />
            </TabsContent>
            <TabsContent value="tier1">
              <ActionList
                actions={actions?.filter((a) => a.tier === 1)}
                onSelect={setSelectedAction}
              />
            </TabsContent>
            <TabsContent value="tier2">
              <ActionList
                actions={actions?.filter((a) => a.tier === 2)}
                onSelect={setSelectedAction}
              />
            </TabsContent>
            <TabsContent value="tier3">
              <ActionList
                actions={actions?.filter((a) => a.tier === 3)}
                onSelect={setSelectedAction}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action Details</DialogTitle>
            <DialogDescription>
              Full details of the selected action
            </DialogDescription>
          </DialogHeader>
          {selectedAction && (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium">Tool:</span>
                <span className="ml-2">{selectedAction.tool}</span>
              </div>
              <div>
                <span className="text-sm font-medium">Command:</span>
                <pre className="mt-1 p-2 bg-muted rounded text-sm font-mono overflow-auto">
                  {selectedAction.command}
                </pre>
              </div>
              {selectedAction.result ? (
                <div>
                  <span className="text-sm font-medium">Result:</span>
                  <pre className="mt-1 p-2 bg-muted rounded text-sm font-mono overflow-auto max-h-40">
                    {typeof selectedAction.result === "string"
                      ? selectedAction.result
                      : JSON.stringify(selectedAction.result, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ActionListProps {
  actions?: EntityAction[]
  onSelect: (action: EntityAction) => void
}

function ActionList({ actions, onSelect }: ActionListProps) {
  if (!actions?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">No actions to display</p>
    )
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {actions.map((action, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
            onClick={() => onSelect(action)}
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={action.status} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{action.tool}</span>
                  <Badge variant="outline" className="text-xs">
                    Tier {action.tier || 1}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-[300px] font-mono">
                  {action.command}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(action.timestamp)}
              </span>
              <Button variant="ghost" size="icon">
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case "completed":
      return <Check className="h-4 w-4 text-green-500" />
    case "failed":
      return <X className="h-4 w-4 text-destructive" />
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
  }
}

const phases = [
  { id: "orient", label: "Orient" },
  { id: "think", label: "Think" },
  { id: "plan", label: "Plan" },
  { id: "act", label: "Act" },
  { id: "sense", label: "Sense" },
  { id: "reflect", label: "Reflect" },
  { id: "update", label: "Update" },
]

function formatTime(timestamp?: number | string) {
  if (!timestamp) return ""
  return new Date(timestamp).toLocaleTimeString()
}
