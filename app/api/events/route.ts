import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, type, description, timestamp, severity, confidence } = body

    if (!global.sessions) global.sessions = []
    const sessionIndex = global.sessions.findIndex((s) => s.id === sessionId)

    if (sessionIndex === -1) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 })
    }

    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: timestamp || new Date().toISOString(),
      severity: severity || "medium",
      confidence: confidence || 0.8,
    }

    global.sessions[sessionIndex].events.push(event)

    // Update integrity score based on event severity
    const scoreDeduction = severity === "high" ? 10 : severity === "medium" ? 5 : 2
    global.sessions[sessionIndex].integrityScore = Math.max(
      0,
      global.sessions[sessionIndex].integrityScore - scoreDeduction,
    )

    return NextResponse.json({ success: true, event })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to log event" }, { status: 500 })
  }
}
