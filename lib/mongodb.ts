import { MongoClient, type Db, type Collection } from "mongodb"

interface LogEntry {
  _id?: string
  sessionId: string
  timestamp: Date
  type: "detection_event" | "system_log" | "user_action" | "error"
  severity: "low" | "medium" | "high" | "info"
  description: string
  metadata?: {
    candidateName?: string
    interviewerName?: string
    position?: string
    confidence?: number
    faceCount?: number
    objectsDetected?: string[]
    integrityScore?: number
    [key: string]: any
  }
}

interface SessionLog {
  _id?: string
  sessionId: string
  candidateName: string
  interviewerName: string
  position: string
  startTime: Date
  endTime?: Date
  status: "active" | "completed" | "terminated"
  integrityScore: number
  totalEvents: number
  highSeverityEvents: number
  mediumSeverityEvents: number
  lowSeverityEvents: number
}

class MongoDBLogger {
  private client: MongoClient | null = null
  private db: Db | null = null
  private logsCollection: Collection<LogEntry> | null = null
  private sessionsCollection: Collection<SessionLog> | null = null
  private isConnected = false

  constructor() {
    this.connect()
  }

  private async connect() {
    try {
      // Use environment variable or default to local MongoDB
      const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/video-proctoring"

      this.client = new MongoClient(mongoUrl)
      await this.client.connect()

      this.db = this.client.db("video-proctoring")
      this.logsCollection = this.db.collection<LogEntry>("logs")
      this.sessionsCollection = this.db.collection<SessionLog>("sessions")

      // Create indexes for better performance
      await this.logsCollection.createIndex({ sessionId: 1, timestamp: -1 })
      await this.logsCollection.createIndex({ type: 1, severity: 1 })
      await this.sessionsCollection.createIndex({ sessionId: 1 })
      await this.sessionsCollection.createIndex({ startTime: -1 })

      this.isConnected = true
      console.log("[v0] MongoDB connected successfully")
    } catch (error) {
      console.error("[v0] MongoDB connection failed:", error)
      this.isConnected = false
    }
  }

  async logEvent(entry: Omit<LogEntry, "_id" | "timestamp">) {
    if (!this.isConnected || !this.logsCollection) {
      console.warn("[v0] MongoDB not connected, skipping log entry")
      return false
    }

    try {
      const logEntry: LogEntry = {
        ...entry,
        timestamp: new Date(),
      }

      await this.logsCollection.insertOne(logEntry)
      console.log(`[v0] Logged event: ${entry.type} - ${entry.description}`)
      return true
    } catch (error) {
      console.error("[v0] Failed to log event:", error)
      return false
    }
  }

  async createSession(
    sessionData: Omit<
      SessionLog,
      "_id" | "totalEvents" | "highSeverityEvents" | "mediumSeverityEvents" | "lowSeverityEvents"
    >,
  ) {
    if (!this.isConnected || !this.sessionsCollection) {
      console.warn("[v0] MongoDB not connected, skipping session creation")
      return false
    }

    try {
      const session: SessionLog = {
        ...sessionData,
        totalEvents: 0,
        highSeverityEvents: 0,
        mediumSeverityEvents: 0,
        lowSeverityEvents: 0,
      }

      await this.sessionsCollection.insertOne(session)
      console.log(`[v0] Created session: ${sessionData.sessionId}`)
      return true
    } catch (error) {
      console.error("[v0] Failed to create session:", error)
      return false
    }
  }

  async updateSession(sessionId: string, updates: Partial<SessionLog>) {
    if (!this.isConnected || !this.sessionsCollection) {
      console.warn("[v0] MongoDB not connected, skipping session update")
      return false
    }

    try {
      await this.sessionsCollection.updateOne({ sessionId }, { $set: updates })
      console.log(`[v0] Updated session: ${sessionId}`)
      return true
    } catch (error) {
      console.error("[v0] Failed to update session:", error)
      return false
    }
  }

  async getSessionLogs(sessionId: string): Promise<LogEntry[]> {
    if (!this.isConnected || !this.logsCollection) {
      console.warn("[v0] MongoDB not connected, returning empty logs")
      return []
    }

    try {
      const logs = await this.logsCollection.find({ sessionId }).sort({ timestamp: -1 }).toArray()

      return logs
    } catch (error) {
      console.error("[v0] Failed to get session logs:", error)
      return []
    }
  }

  async getSessionReport(sessionId: string) {
    if (!this.isConnected || !this.logsCollection || !this.sessionsCollection) {
      console.warn("[v0] MongoDB not connected, returning null report")
      return null
    }

    try {
      const session = await this.sessionsCollection.findOne({ sessionId })
      const logs = await this.logsCollection.find({ sessionId }).sort({ timestamp: -1 }).toArray()

      if (!session) {
        return null
      }

      // Calculate event statistics
      const eventStats = logs.reduce(
        (acc, log) => {
          acc.total++
          if (log.severity === "high") acc.high++
          else if (log.severity === "medium") acc.medium++
          else if (log.severity === "low") acc.low++
          return acc
        },
        { total: 0, high: 0, medium: 0, low: 0 },
      )

      // Update session with latest stats
      await this.updateSession(sessionId, {
        totalEvents: eventStats.total,
        highSeverityEvents: eventStats.high,
        mediumSeverityEvents: eventStats.medium,
        lowSeverityEvents: eventStats.low,
      })

      return {
        session,
        logs,
        statistics: eventStats,
      }
    } catch (error) {
      console.error("[v0] Failed to get session report:", error)
      return null
    }
  }

  async getAllSessions(): Promise<SessionLog[]> {
    if (!this.isConnected || !this.sessionsCollection) {
      console.warn("[v0] MongoDB not connected, returning empty sessions")
      return []
    }

    try {
      const sessions = await this.sessionsCollection.find({}).sort({ startTime: -1 }).toArray()

      return sessions
    } catch (error) {
      console.error("[v0] Failed to get all sessions:", error)
      return []
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      this.isConnected = false
      console.log("[v0] MongoDB disconnected")
    }
  }
}

// Create singleton instance
export const mongoLogger = new MongoDBLogger()
export type { LogEntry, SessionLog }
