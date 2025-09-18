import { type NextRequest, NextResponse } from "next/server"
import { mongoLogger } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candidateName, interviewerName, position } = body

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const sessionData = {
      sessionId,
      candidateName,
      interviewerName,
      position,
      startTime: new Date(),
      status: "active" as const,
      integrityScore: 100,
    }

    const success = await mongoLogger.createSession(sessionData)

    if (success) {
      const session = {
        id: sessionId,
        candidateName,
        interviewerName,
        position,
        startTime: new Date().toISOString(),
        endTime: null,
        status: "active",
        events: [],
        integrityScore: 100,
        createdAt: new Date().toISOString(),
      }

      return NextResponse.json({ success: true, session })
    } else {
      return NextResponse.json({ success: false, error: "Failed to create session in database" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] Session creation error:", error)
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const sessions = await mongoLogger.getAllSessions()

    // Transform MongoDB sessions to API format
    const formattedSessions = sessions.map((session) => ({
      id: session.sessionId,
      candidateName: session.candidateName,
      interviewerName: session.interviewerName,
      position: session.position,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString() || null,
      status: session.status,
      events: [],
      integrityScore: session.integrityScore,
      createdAt: session.startTime.toISOString(),
    }))

    return NextResponse.json({ success: true, sessions: formattedSessions })
  } catch (error) {
    console.error("[v0] Get sessions error:", error)
    return NextResponse.json({ success: false, error: "Failed to get sessions" }, { status: 500 })
  }
}
