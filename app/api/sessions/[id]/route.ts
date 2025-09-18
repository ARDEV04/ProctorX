import { type NextRequest, NextResponse } from "next/server"
import { mongoLogger } from "@/lib/mongodb"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id
    const reportData = await mongoLogger.getSessionReport(sessionId)

    if (!reportData || !reportData.session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 })
    }

    const session = {
      id: reportData.session.sessionId,
      candidateName: reportData.session.candidateName,
      interviewerName: reportData.session.interviewerName,
      position: reportData.session.position,
      startTime: reportData.session.startTime.toISOString(),
      endTime: reportData.session.endTime?.toISOString() || null,
      status: reportData.session.status,
      events: reportData.logs.map((log) => ({
        id: log._id?.toString() || "",
        type: log.metadata?.eventType || "unknown",
        description: log.description,
        timestamp: log.timestamp.toISOString(),
        severity: log.severity,
        confidence: log.metadata?.confidence || 0,
      })),
      integrityScore: reportData.session.integrityScore,
      createdAt: reportData.session.startTime.toISOString(),
    }

    return NextResponse.json({ success: true, session })
  } catch (error) {
    console.error("[v0] Get session error:", error)
    return NextResponse.json({ success: false, error: "Failed to get session" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id
    const body = await request.json()

    const success = await mongoLogger.updateSession(sessionId, {
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      status: body.status,
      integrityScore: body.integrityScore,
    })

    if (success) {
      return NextResponse.json({ success: true, session: { id: sessionId, ...body } })
    } else {
      return NextResponse.json({ success: false, error: "Failed to update session" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] Update session error:", error)
    return NextResponse.json({ success: false, error: "Failed to update session" }, { status: 500 })
  }
}
