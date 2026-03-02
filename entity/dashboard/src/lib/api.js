const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")

function getApiKey() {
  if (typeof window === "undefined") return null

  const params = new URLSearchParams(window.location.search)
  const queryToken = params.get("api_key") || params.get("token")
  if (queryToken) {
    localStorage.setItem("entity-api-key", queryToken)
  }

  return localStorage.getItem("entity-api-key")
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const apiKey = getApiKey()
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }))
    const error = new Error(payload.error || `HTTP ${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return response.json()
}

export const api = {
  // Status
  getStatus: () => request("/status"),

  // Message
  sendMessage: (content) =>
    request("/message", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // Mind files
  getMindFile: (path) => request(`/mind/${encodeURIComponent(path)}`),
  getMindTree: () => request("/mind"),
  updateMindFile: (path, content) =>
    request(`/mind/${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // Configuration
  getConfig: () => request("/config"),
  updateConfig: (config) =>
    request("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  // Actions
  getHistory: (limit = 50) => request(`/history?limit=${limit}`),
  getPendingApprovals: () => request("/approvals"),
  approve: (id) =>
    request(`/approve/${id}`, {
      method: "POST",
    }),
  deny: (id) =>
    request(`/deny/${id}`, {
      method: "POST",
    }),

  // Control
  pause: () => request("/pause", { method: "POST" }),
  resume: () => request("/resume", { method: "POST" }),
  triggerCycle: () => request("/cycle", { method: "POST" }),

  // Skills
  getSkills: () => request("/skills"),
  getSkill: (name) => request(`/skills/${encodeURIComponent(name)}`),
  testSkill: (name, payload) =>
    request(`/skills/${encodeURIComponent(name)}/test`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}

export default api
