import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { Send, User, Brain, Loader2 } from "lucide-react"

export function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage(e) {
    e?.preventDefault()
    if (!input.trim() || sending) return

    const userMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSending(true)

    try {
      const response = await api.sendMessage(userMessage.content)

      const entityMessage = {
        role: "entity",
        content: response.response || response.message || "No response",
        timestamp: Date.now(),
        thoughts: response.thoughts,
        emotion: response.emotion,
      }

      setMessages((prev) => [...prev, entityMessage])
    } catch (err) {
      const errorMessage = {
        role: "system",
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
        error: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg">Chat with Entity</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Brain className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg">Start a conversation with Entity</p>
                <p className="text-sm">
                  Your messages will trigger a cognitive cycle
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Entity is thinking...</span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Textarea
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[60px] max-h-[200px]"
                disabled={sending}
              />
              <Button
                type="submit"
                size="icon"
                className="h-[60px] w-[60px]"
                disabled={!input.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === "user"
  const isEntity = message.role === "entity"
  const isError = message.error

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isError
            ? "bg-destructive/10 text-destructive"
            : "bg-muted"
        } rounded-lg p-3`}
      >
        <div className="flex items-center gap-2 mb-1">
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">
            {isUser ? "You" : isError ? "System" : "Entity"}
          </span>
          {message.emotion && (
            <Badge variant="outline" className="text-xs">
              {message.emotion}
            </Badge>
          )}
        </div>

        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Show thoughts if available */}
        {message.thoughts?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-medium mb-1 opacity-70">Thoughts:</p>
            <ul className="text-xs opacity-70 space-y-1">
              {message.thoughts.slice(0, 3).map((thought, i) => (
                <li key={i}>• {thought}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs opacity-50 mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
