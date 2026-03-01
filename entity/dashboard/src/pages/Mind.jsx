import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import api from "@/lib/api"
import {
  Folder,
  File,
  FileText,
  ChevronRight,
  ChevronDown,
  Heart,
  Target,
  User,
  Brain,
  RefreshCw,
} from "lucide-react"

export function Mind() {
  const [tree, setTree] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState(new Set(["/"]))

  useEffect(() => {
    loadTree()
  }, [])

  async function loadTree() {
    try {
      setLoading(true)
      const data = await api.getMindTree()
      setTree(data)
    } catch (err) {
      console.error("Failed to load mind tree:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadFile(path) {
    try {
      setSelectedFile(path)
      const data = await api.getMindFile(path)
      setFileContent(data)
    } catch (err) {
      console.error("Failed to load file:", err)
      setFileContent({ error: err.message })
    }
  }

  function toggleFolder(path) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  function getFileIcon(name) {
    if (name.includes("emotion")) return Heart
    if (name.includes("goal")) return Target
    if (name.includes("identity")) return User
    if (name.includes("thought")) return Brain
    return FileText
  }

  function renderTree(items, basePath = "") {
    if (!items) return null

    return (
      <div className="space-y-1">
        {Object.entries(items).map(([name, value]) => {
          const path = basePath ? `${basePath}/${name}` : name
          const isFolder = typeof value === "object" && !value.content

          if (isFolder) {
            const isExpanded = expandedFolders.has(path)
            return (
              <div key={path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => toggleFolder(path)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-1" />
                  )}
                  <Folder className="h-4 w-4 mr-2 text-blue-500" />
                  {name}
                </Button>
                {isExpanded && (
                  <div className="ml-4">{renderTree(value, path)}</div>
                )}
              </div>
            )
          }

          const Icon = getFileIcon(name)
          return (
            <Button
              key={path}
              variant={selectedFile === path ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => loadFile(path)}
            >
              <File className="h-4 w-4 mr-1 opacity-0" />
              <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
              {name}
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-3 h-[calc(100vh-12rem)]">
      {/* File Tree */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mind Files</CardTitle>
            <Button variant="ghost" size="icon" onClick={loadTree}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-18rem)]">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : tree ? (
              renderTree(tree)
            ) : (
              <p className="text-sm text-muted-foreground">
                No mind files found
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* File Viewer */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {selectedFile || "Select a file"}
          </CardTitle>
          {selectedFile && (
            <CardDescription>
              View and understand Entity's mind state
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-18rem)]">
            {fileContent ? (
              <FileContentViewer content={fileContent} path={selectedFile} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a file from the tree to view its contents
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function FileContentViewer({ content, path }) {
  if (content.error) {
    return (
      <div className="text-destructive">Error loading file: {content.error}</div>
    )
  }

  // Handle emotion files specially
  if (path?.includes("emotion") && content.primary) {
    return <EmotionViewer emotion={content} />
  }

  // Handle goals
  if (path?.includes("goal") && Array.isArray(content)) {
    return <GoalsViewer goals={content} />
  }

  // Default: render as formatted content
  if (typeof content === "string") {
    return <pre className="text-sm whitespace-pre-wrap">{content}</pre>
  }

  return (
    <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
      {JSON.stringify(content, null, 2)}
    </pre>
  )
}

function EmotionViewer({ emotion }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-2">Primary Emotion</h4>
        <div className="flex items-center gap-4">
          <Badge variant="default" className="text-lg px-4 py-1">
            {emotion.primary}
          </Badge>
          <div className="flex-1">
            <Progress value={emotion.intensity * 100} className="h-3" />
          </div>
          <span className="text-sm text-muted-foreground">
            {Math.round(emotion.intensity * 100)}%
          </span>
        </div>
      </div>

      {emotion.secondary && (
        <div>
          <h4 className="text-sm font-medium mb-2">Secondary Emotion</h4>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="px-4 py-1">
              {emotion.secondary}
            </Badge>
            <div className="flex-1">
              <Progress
                value={(emotion.secondaryIntensity || 0.5) * 100}
                className="h-2"
              />
            </div>
          </div>
        </div>
      )}

      <Separator />

      <div>
        <h4 className="text-sm font-medium mb-2">Recent Triggers</h4>
        {emotion.triggers?.length > 0 ? (
          <ul className="space-y-2">
            {emotion.triggers.map((trigger, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                • {trigger}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No recent triggers</p>
        )}
      </div>
    </div>
  )
}

function GoalsViewer({ goals }) {
  return (
    <div className="space-y-4">
      {goals.map((goal, i) => (
        <Card key={i}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium">{goal.title || goal.description}</h4>
              <Badge
                variant={
                  goal.status === "completed"
                    ? "success"
                    : goal.status === "active"
                    ? "default"
                    : "secondary"
                }
              >
                {goal.status || "pending"}
              </Badge>
            </div>
            {goal.description && goal.title && (
              <p className="text-sm text-muted-foreground mb-2">
                {goal.description}
              </p>
            )}
            {goal.progress !== undefined && (
              <Progress value={goal.progress * 100} className="h-2" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
