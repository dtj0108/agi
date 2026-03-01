const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000"

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(error.error || `HTTP ${response.status}`)
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
}

export default api
