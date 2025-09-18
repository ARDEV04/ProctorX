// lib/api-client.ts
// Local, SSR-safe store for sessions & events.
// Exposes both named functions and a default `apiClient` object.

export type Severity = "low" | "medium" | "high"
export type DetectionType =
  | "focus_lost"
  | "no_face"
  | "multiple_faces"
  | "phone_detected"
  | "book_detected"
  | "device_detected"
  | "looking_away"
  | "eyes_closed"
  | "prohibited_object"

export interface Session {
  id: string
  candidateName: string
  interviewerName: string
  position: string
  startedAt: string
  endedAt?: string | null
  status: "active" | "ended"
  finalIntegrityScore?: number | null
}

export interface LoggedEvent {
  id: string
  sessionId: string
  type: DetectionType
  description: string
  severity: Severity
  confidence?: number
  timestamp: string
  metadata?: Record<string, any>
}

type StoreShape = {
  sessionsById: Record<string, Session>
  eventsBySession: Record<string, LoggedEvent[]>
}

const KEY = "proctorx-store-v1"
const isBrowser = typeof window !== "undefined"

let memStore: StoreShape = { sessionsById: {}, eventsBySession: {} }

function readStore(): StoreShape {
  if (!isBrowser) return memStore
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { sessionsById: {}, eventsBySession: {} }
    const parsed = JSON.parse(raw) as StoreShape
    return {
      sessionsById: parsed.sessionsById || {},
      eventsBySession: parsed.eventsBySession || {},
    }
  } catch {
    return { sessionsById: {}, eventsBySession: {} }
  }
}

function writeStore(store: StoreShape) {
  if (!isBrowser) {
    memStore = store
    return
  }
  window.localStorage.setItem(KEY, JSON.stringify(store))
}

function uid(prefix = "sess_") {
  return prefix + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
}

// ---------- Named functions (recommended imports) ----------
export async function createSession(input: {
  candidateName: string
  interviewerName: string
  position: string
}): Promise<{ success: true; session: Session }> {
  const store = readStore()
  const session: Session = {
    id: uid("sess_"),
    candidateName: input.candidateName,
    interviewerName: input.interviewerName,
    position: input.position,
    startedAt: new Date().toISOString(),
    status: "active",
    finalIntegrityScore: null,
    endedAt: null,
  }
  store.sessionsById[session.id] = session
  if (!store.eventsBySession[session.id]) store.eventsBySession[session.id] = []
  writeStore(store)
  return { success: true, session }
}

export async function logEvent(input: {
  sessionId: string
  type: DetectionType
  description: string
  severity: Severity
  confidence?: number
  metadata?: Record<string, any>
}): Promise<{ success: true; event: LoggedEvent }> {
  const store = readStore()
  const evt: LoggedEvent = {
    id: uid("evt_"),
    sessionId: input.sessionId,
    type: input.type,
    description: input.description,
    severity: input.severity,
    confidence: input.confidence,
    metadata: input.metadata,
    timestamp: new Date().toISOString(),
  }
  if (!store.eventsBySession[input.sessionId]) {
    store.eventsBySession[input.sessionId] = []
  }
  store.eventsBySession[input.sessionId].unshift(evt) // latest first
  writeStore(store)
  return { success: true, event: evt }
}

export async function endSession(
  sessionId: string,
  finalIntegrityScore?: number
): Promise<{ success: true; session?: Session }> {
  const store = readStore()
  const s = store.sessionsById[sessionId]
  if (s) {
    s.status = "ended"
    s.endedAt = new Date().toISOString()
    if (typeof finalIntegrityScore === "number") {
      s.finalIntegrityScore = finalIntegrityScore
    }
    store.sessionsById[sessionId] = s
    writeStore(store)
    return { success: true, session: s }
  }
  return { success: true }
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const store = readStore()
  return store.sessionsById[sessionId] ?? null
}

export async function getReport(sessionId: string): Promise<{
  session: Session | null
  totals: {
    all: number
    high: number
    medium: number
    low: number
    byType: Record<DetectionType, number>
  }
  durationSeconds: number
  events: LoggedEvent[]
}> {
  const store = readStore()
  const s = store.sessionsById[sessionId] ?? null
  const events = store.eventsBySession[sessionId] ?? []

  const totals = {
    all: events.length,
    high: events.filter((e) => e.severity === "high").length,
    medium: events.filter((e) => e.severity === "medium").length,
    low: events.filter((e) => e.severity === "low").length,
    byType: {
      focus_lost: 0,
      no_face: 0,
      multiple_faces: 0,
      phone_detected: 0,
      book_detected: 0,
      device_detected: 0,
      looking_away: 0,
      eyes_closed: 0,
      prohibited_object: 0,
    } as Record<DetectionType, number>,
  }

  events.forEach((e) => {
    totals.byType[e.type] = (totals.byType[e.type] || 0) + 1
  })

  const start = s?.startedAt ? new Date(s.startedAt).getTime() : Date.now()
  const end = s?.endedAt ? new Date(s.endedAt).getTime() : Date.now()
  const durationSeconds = Math.max(0, Math.floor((end - start) / 1000))

  return { session: s, totals, durationSeconds, events }
}

// ---------- Back-compat: default object export with same methods ----------
export const apiClient = {
  createSession,
  logEvent,
  endSession,
  getSession,
  getReport,
}

export type { Session as SessionType }
export default apiClient
