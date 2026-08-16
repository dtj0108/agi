import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { Save, RotateCcw } from "lucide-react"

interface LlmConfig {
  model?: string
  maxTokens?: number
  temperature?: number
  promptCaching?: boolean
  [key: string]: unknown
}

interface GoConfig {
  minDelayMs?: number
  maxConsecutiveErrors?: number
  [key: string]: unknown
}

interface AutonomyConfig {
  mode?: string
  level?: string
  go?: GoConfig
  blockedPatterns?: string[]
  [key: string]: unknown
}

interface ActionsConfig {
  autonomy?: string
  blockedPatterns?: string[]
  [key: string]: unknown
}

interface HeartbeatConfig {
  enabled?: boolean
  schedule?: string
  prompt?: string
  [key: string]: unknown
}

interface InterfaceConfig {
  httpPort?: number
  wsPort?: number
  [key: string]: unknown
}

interface EntityConfig {
  llm?: LlmConfig
  actions?: ActionsConfig
  autonomy?: AutonomyConfig
  heartbeat?: HeartbeatConfig
  interface?: InterfaceConfig
  [key: string]: unknown
}

type ConfigSection = "llm" | "actions" | "autonomy" | "heartbeat" | "interface"

type ConfigFieldValue = string | number | boolean | string[]

export function Config() {
  const [config, setConfig] = useState<EntityConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      const data = await api.getConfig()
      const autonomyLevel = data.actions?.autonomy || data.autonomy?.level || "balanced"
      const blockedPatterns = data.actions?.blockedPatterns || data.autonomy?.blockedPatterns || []
      const autonomyMode = data.autonomy?.mode || "go"
      const goConfig = {
        minDelayMs: data.autonomy?.go?.minDelayMs ?? 2000,
        maxConsecutiveErrors: data.autonomy?.go?.maxConsecutiveErrors ?? 3,
      }

      setConfig({
        ...data,
        actions: {
          ...(data.actions || {}),
          autonomy: autonomyLevel,
          blockedPatterns,
        },
        autonomy: {
          ...(data.autonomy || {}),
          mode: autonomyMode,
          go: goConfig,
          level: autonomyLevel,
          blockedPatterns,
        },
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    if (!config) return
    try {
      setSaving(true)
      await api.updateConfig(buildSavePayload(config))
      setDirty(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  function updateField(section: ConfigSection, field: string, value: ConfigFieldValue) {
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }
    })
    setDirty(true)
  }

  function updateAutonomyGoField(field: string, value: number) {
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        autonomy: {
          ...prev.autonomy,
          go: {
            ...prev.autonomy?.go,
            [field]: value,
          },
        },
      }
    })
    setDirty(true)
  }

  function buildSavePayload(currentConfig: EntityConfig) {
    return {
      llm: currentConfig.llm,
      heartbeat: currentConfig.heartbeat,
      autonomy: {
        mode: currentConfig.autonomy?.mode || "go",
        go: {
          minDelayMs: currentConfig.autonomy?.go?.minDelayMs ?? 2000,
          maxConsecutiveErrors: currentConfig.autonomy?.go?.maxConsecutiveErrors ?? 3,
        },
      },
      actions: {
        autonomy:
          currentConfig.actions?.autonomy || currentConfig.autonomy?.level || "balanced",
        blockedPatterns:
          currentConfig.actions?.blockedPatterns ||
          currentConfig.autonomy?.blockedPatterns ||
          [],
      },
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading configuration...</div>
  }

  if (!config) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load configuration: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuration</h2>
          <p className="text-muted-foreground">
            Manage Entity's settings and behavior
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && <Badge variant="warning">Unsaved changes</Badge>}
          <Button variant="outline" onClick={loadConfig} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={saveConfig} disabled={saving || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md">
          {error}
        </div>
      )}

      <Tabs defaultValue="llm">
        <TabsList>
          <TabsTrigger value="llm">LLM</TabsTrigger>
          <TabsTrigger value="autonomy">Autonomy</TabsTrigger>
          <TabsTrigger value="heartbeat">Heartbeat</TabsTrigger>
          <TabsTrigger value="interface">Interface</TabsTrigger>
        </TabsList>

        {/* LLM Configuration */}
        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle>LLM Settings</CardTitle>
              <CardDescription>
                Configure the language model used by Entity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={config.llm?.model || "claude-sonnet-4-20250514"}
                    onValueChange={(v) => updateField("llm", "model", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet-4-20250514">
                        Claude Sonnet 4
                      </SelectItem>
                      <SelectItem value="claude-opus-4-20250514">
                        Claude Opus 4
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={config.llm?.maxTokens || 4096}
                    onChange={(e) =>
                      updateField("llm", "maxTokens", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Temperature: {config.llm?.temperature || 0.7}</Label>
                <Slider
                  value={[config.llm?.temperature || 0.7]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([v]) => updateField("llm", "temperature", v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Prompt Caching</Label>
                  <p className="text-sm text-muted-foreground">
                    Cache prompts to reduce costs
                  </p>
                </div>
                <Switch
                  checked={config.llm?.promptCaching !== false}
                  onCheckedChange={(v) =>
                    updateField("llm", "promptCaching", v)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Autonomy Configuration */}
        <TabsContent value="autonomy">
          <Card>
            <CardHeader>
              <CardTitle>Autonomy Settings</CardTitle>
              <CardDescription>
                Control Entity's level of independent action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Autonomy Level</Label>
                <Select
                  value={config.actions?.autonomy || config.autonomy?.level || "balanced"}
                  onValueChange={(v) => updateField("actions", "autonomy", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">
                      Conservative - Ask before most actions
                    </SelectItem>
                    <SelectItem value="balanced">
                      Balanced - Independent safe actions
                    </SelectItem>
                    <SelectItem value="full_trust">
                      Full Trust - Minimal restrictions
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Blocked Patterns</Label>
                <Textarea
                  placeholder="Enter blocked command patterns (one per line)"
                  value={
                    config.actions?.blockedPatterns?.join("\n") ||
                    config.autonomy?.blockedPatterns?.join("\n") ||
                    ""
                  }
                  onChange={(e) =>
                    updateField(
                      "actions",
                      "blockedPatterns",
                      e.target.value.split("\n").filter(Boolean)
                    )
                  }
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Commands matching these patterns will always require approval
                </p>
              </div>

              <div className="space-y-2">
                <Label>Runtime Autonomy Mode</Label>
                <Select
                  value={config.autonomy?.mode || "go"}
                  onValueChange={(v) => updateField("autonomy", "mode", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual - No automatic cycles</SelectItem>
                    <SelectItem value="heartbeat">Heartbeat - Scheduled cron cycles</SelectItem>
                    <SelectItem value="go">Go - Continuous autonomous cycles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Go Min Delay (ms)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.autonomy?.go?.minDelayMs ?? 2000}
                    onChange={(e) =>
                      updateAutonomyGoField(
                        "minDelayMs",
                        parseInt(e.target.value || "0", 10)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Go Max Consecutive Errors</Label>
                  <Input
                    type="number"
                    min={1}
                    value={config.autonomy?.go?.maxConsecutiveErrors ?? 3}
                    onChange={(e) =>
                      updateAutonomyGoField(
                        "maxConsecutiveErrors",
                        parseInt(e.target.value || "1", 10)
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Heartbeat Configuration */}
        <TabsContent value="heartbeat">
          <Card>
            <CardHeader>
              <CardTitle>Heartbeat Settings</CardTitle>
              <CardDescription>
                Configure automatic background processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Heartbeat</Label>
                  <p className="text-sm text-muted-foreground">
                    Run cycles automatically on a schedule
                  </p>
                </div>
                <Switch
                  checked={config.heartbeat?.enabled || false}
                  onCheckedChange={(v) =>
                    updateField("heartbeat", "enabled", v)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Cron Schedule</Label>
                <Input
                  value={config.heartbeat?.schedule || "*/30 * * * *"}
                  onChange={(e) =>
                    updateField("heartbeat", "schedule", e.target.value)
                  }
                  placeholder="*/30 * * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Default: Every 30 minutes (*/30 * * * *)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Custom Prompt</Label>
                <Textarea
                  value={config.heartbeat?.prompt || ""}
                  onChange={(e) =>
                    updateField("heartbeat", "prompt", e.target.value)
                  }
                  placeholder="Optional custom prompt for heartbeat cycles"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interface Configuration */}
        <TabsContent value="interface">
          <Card>
            <CardHeader>
              <CardTitle>Interface Settings</CardTitle>
              <CardDescription>
                Configure HTTP and WebSocket interfaces
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>HTTP Port</Label>
                  <Input
                    type="number"
                    value={config.interface?.httpPort || 3000}
                    onChange={(e) =>
                      updateField(
                        "interface",
                        "httpPort",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>WebSocket Port</Label>
                  <Input
                    type="number"
                    value={config.interface?.wsPort || 3001}
                    onChange={(e) =>
                      updateField(
                        "interface",
                        "wsPort",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
