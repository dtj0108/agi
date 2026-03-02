import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import api, { ApiError } from "@/lib/api"
import {
  Puzzle,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react"

type ParamSchema = {
  type?: string
  required?: boolean
  default?: unknown
  description?: string
  [key: string]: unknown
}

type SkillAction = {
  name: string
  description?: string
  tier?: number
  params?: Record<string, ParamSchema>
}

type SkillDefinition = {
  name: string
  description?: string
  version?: string
  actions?: SkillAction[]
}

type SkillTestResult = {
  success?: boolean
  approvalRequired?: boolean
  tier?: number | string
  error?: string
  duration_ms?: number
  [key: string]: any
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return "Unknown error"
}

export function Skills() {
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null)
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    void loadSkills()
  }, [])

  async function loadSkills() {
    try {
      setLoading(true)
      const data = await api.getSkills()
      setSkills(data.skills || [])
    } catch (err) {
      console.error("Failed to load skills:", err)
    } finally {
      setLoading(false)
    }
  }

  async function testSkill(
    skillName: string,
    action: string,
    params: Record<string, unknown> = {}
  ) {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await api.testSkill(skillName, { action, ...params })
      setTestResult(result)
    } catch (err) {
      const payload =
        err instanceof ApiError ? err.payload : (err as { payload?: any })?.payload
      if (payload?.approvalRequired) {
        setTestResult({
          success: false,
          approvalRequired: true,
          tier: payload.tier,
          error: payload.error || getErrorMessage(err),
        })
      } else {
        setTestResult({ success: false, error: getErrorMessage(err) })
      }
    } finally {
      setTesting(false)
    }
  }

  function getTierBadge(tier?: number) {
    switch (tier) {
      case 1:
        return <Badge variant="success">Tier 1</Badge>
      case 2:
        return <Badge variant="secondary">Tier 2</Badge>
      case 3:
        return <Badge variant="destructive">Tier 3</Badge>
      default:
        return <Badge variant="outline">Tier {tier}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Skills</h2>
          <p className="text-muted-foreground">
            Modular capabilities that Entity can use
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadSkills()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {skills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No skills installed</p>
            <p className="text-sm text-muted-foreground">
              Skills provide additional capabilities to Entity
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <Card
              key={skill.name}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedSkill(skill)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{skill.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {skill.description}
                    </CardDescription>
                  </div>
                  <Puzzle className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {skill.actions?.length || 0} action
                    {skill.actions?.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    v{skill.version || "1.0.0"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedSkill} onOpenChange={() => setSelectedSkill(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              {selectedSkill?.name}
            </DialogTitle>
            <DialogDescription>{selectedSkill?.description}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="actions">
            <TabsList>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="test">Test</TabsTrigger>
            </TabsList>

            <TabsContent value="actions">
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {selectedSkill?.actions?.map((action) => (
                    <Card key={action.name}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{action.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {action.description}
                            </p>
                          </div>
                          {getTierBadge(action.tier)}
                        </div>

                        {action.params && Object.keys(action.params).length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-medium mb-2">Parameters:</p>
                            <div className="space-y-1">
                              {Object.entries(action.params).map(([name, schema]) => {
                                const field = schema as ParamSchema
                                return (
                                  <div
                                    key={name}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="font-mono">
                                      {name}
                                      {field.required && (
                                        <span className="text-destructive">*</span>
                                      )}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {field.type || "any"}
                                      {field.default !== undefined &&
                                        ` (default: ${String(field.default)})`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="test">
              <SkillTester
                skill={selectedSkill}
                onTest={testSkill}
                result={testResult}
                testing={testing}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSkill(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SkillTester({
  skill,
  onTest,
  result,
  testing,
}: {
  skill: SkillDefinition | null
  onTest: (skillName: string, action: string, params: Record<string, unknown>) => Promise<void>
  result: SkillTestResult | null
  testing: boolean
}) {
  const [selectedAction, setSelectedAction] = useState(skill?.actions?.[0]?.name || "")
  const [params, setParams] = useState<Record<string, string>>({})
  const [inputError, setInputError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedAction(skill?.actions?.[0]?.name || "")
    setParams({})
    setInputError(null)
  }, [skill])

  const action = skill?.actions?.find((a) => a.name === selectedAction)

  function handleTest() {
    if (!skill) return

    try {
      const typedParams = coerceParamsBySchema(action?.params || {}, params)
      setInputError(null)
      void onTest(skill.name, selectedAction, typedParams)
    } catch (err) {
      setInputError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Action</Label>
        <select
          className="w-full p-2 border rounded-md bg-background"
          value={selectedAction}
          onChange={(e) => {
            setSelectedAction(e.target.value)
            setParams({})
          }}
        >
          {skill?.actions?.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {action?.params && Object.keys(action.params).length > 0 && (
        <div className="space-y-3">
          <Label>Parameters</Label>
          {Object.entries(action.params).map(([name, schema]) => {
            const field = schema as ParamSchema
            return (
              <div key={name} className="space-y-1">
                <Label className="text-xs">
                  {name}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  placeholder={`${field.description || name}${field.type ? ` (${field.type})` : ""}`}
                  value={params[name] || ""}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                />
              </div>
            )
          })}
        </div>
      )}

      {inputError && (
        <div className="text-sm text-destructive">{inputError}</div>
      )}

      <Button onClick={handleTest} disabled={testing} className="w-full">
        {testing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Test Skill
          </>
        )}
      </Button>

      {result && (
        <Card
          className={
            result.approvalRequired
              ? "border-amber-500"
              : result.success
                ? "border-green-500"
                : "border-destructive"
          }
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              {result.approvalRequired ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : result.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">
                {result.approvalRequired
                  ? "Approval Required"
                  : result.success
                    ? "Success"
                    : "Failed"}
              </span>
              {result.duration_ms && (
                <span className="text-xs text-muted-foreground">
                  ({result.duration_ms}ms)
                </span>
              )}
            </div>
            {result.approvalRequired && (
              <p className="text-xs text-muted-foreground mb-2">
                Tier {result.tier || "3+"} actions cannot be executed from the test endpoint.
              </p>
            )}
            <ScrollArea className="h-[150px]">
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function coerceParamsBySchema(
  schemaMap: Record<string, ParamSchema>,
  rawParams: Record<string, unknown>
) {
  const coerced: Record<string, unknown> = {}

  for (const [name, schema] of Object.entries(schemaMap)) {
    const rawValue = rawParams[name]
    const hasValue = rawValue !== undefined && String(rawValue).trim().length > 0

    if (!hasValue) {
      if (schema.required) {
        throw new Error(`Missing required param: ${name}`)
      }
      continue
    }

    coerced[name] = coerceValue(rawValue, schema, name)
  }

  return coerced
}

function coerceValue(value: unknown, schema: ParamSchema | undefined, name: string) {
  const type = schema?.type || "string"

  if (type === "number") {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Param ${name} must be a valid number`)
    }
    return parsed
  }

  if (type === "boolean") {
    const normalized = String(value).trim().toLowerCase()
    if (["true", "1", "yes", "y"].includes(normalized)) return true
    if (["false", "0", "no", "n"].includes(normalized)) return false
    throw new Error(`Param ${name} must be true or false`)
  }

  if (type === "object" || type === "array") {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(value))
    } catch {
      throw new Error(`Param ${name} must be valid JSON`)
    }
    if (type === "array" && !Array.isArray(parsed)) {
      throw new Error(`Param ${name} must be a JSON array`)
    }
    if (
      type === "object" &&
      (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
    ) {
      throw new Error(`Param ${name} must be a JSON object`)
    }
    return parsed
  }

  return String(value)
}
