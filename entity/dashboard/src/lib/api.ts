const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")

type ApiRequestOptions = RequestInit & {
  headers?: HeadersInit
}

export class ApiError extends Error {
  status: number
  payload: any

  constructor(message: string, status: number, payload: any) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

function getApiKey() {
  if (typeof window === "undefined") return null

  const params = new URLSearchParams(window.location.search)
  const queryToken = params.get("api_key") || params.get("token")
  if (queryToken) {
    localStorage.setItem("entity-api-key", queryToken)
  }

  return localStorage.getItem("entity-api-key")
}

async function request<T = any>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${API_BASE}${path}`
  const apiKey = getApiKey()
  const headers = new Headers(options.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }))
    throw new ApiError(payload.error || `HTTP ${response.status}`, response.status, payload)
  }

  const text = await response.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

export const api = {
  getStatus: () => request("/status"),
  getAuthStatus: () => request("/auth/status"),

  sendMessage: (content: string) =>
    request("/message", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  getMindFile: (path: string) => request(`/mind/${encodeURIComponent(path)}`),
  getMindTree: () => request("/mind"),
  updateMindFile: (path: string, content: string) =>
    request(`/mind/${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  getConfig: () => request("/config"),
  updateConfig: (config: any) =>
    request("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  getHistory: (limit = 50) => request(`/history?limit=${limit}`),
  getPendingApprovals: () => request("/approvals"),
  approve: (id: string) =>
    request(`/approve/${id}`, {
      method: "POST",
    }),
  deny: (id: string) =>
    request(`/deny/${id}`, {
      method: "POST",
    }),

  pause: () => request("/pause", { method: "POST" }),
  resume: () => request("/resume", { method: "POST" }),
  go: () => request("/go", { method: "POST" }),
  stopGo: () => request("/stop", { method: "POST" }),
  triggerCycle: () => request("/cycle", { method: "POST" }),

  getSkills: () => request("/skills"),
  getSkill: (name: string) => request(`/skills/${encodeURIComponent(name)}`),
  testSkill: (name: string, payload: any) =>
    request(`/skills/${encodeURIComponent(name)}/test`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}

export default api
