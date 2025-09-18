import { type NextRequest, NextResponse } from "next/server"
import { mongoLogger } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, type, severity, description, metadata } = body

    if (!sessionId || !type || !severity || !description) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const success = await mongoLogger.logEvent({
      sessionId,
      type,
      severity,
      description,
      metadata,
    })

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: "Failed to log event" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] API error logging event:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Session ID required" }, { status: 400 })
    }

    const logs = await mongoLogger.getSessionLogs(sessionId)
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    console.error("[v0] API error getting logs:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
