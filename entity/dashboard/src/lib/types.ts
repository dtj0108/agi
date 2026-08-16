export interface AuthStatus {
  source?: string
}

export interface AutonomyStatus {
  mode?: string
}

export interface EntityStatus {
  state?: string
  currentPhase?: string
  cycleCount?: number
  uptime?: number
  name?: string
  connected?: boolean
  autonomy?: AutonomyStatus
  auth?: AuthStatus | null
}

export interface Thought {
  content?: string
  phase?: string
  timestamp?: number | string
}

export interface EntityAction {
  tool?: string
  command?: string
  description?: string
  status?: string
  tier?: number
  result?: unknown
  timestamp?: number | string
}

export interface Approval {
  id: string
  tool?: string
  command?: string
  reason?: string
}

export interface EmotionState {
  primary?: string
  intensity?: number
}
