import { type NextRequest, NextResponse } from "next/server"
import { mongoLogger } from "@/lib/mongodb"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id

    const reportData = await mongoLogger.getSessionReport(sessionId)

    if (!reportData || !reportData.session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 })
    }

    const { session, logs, statistics } = reportData

    // Transform logs to events format
    const events = logs.map((log) => ({
      id: log._id?.toString() || "",
      type: log.metadata?.eventType || "unknown",
      description: log.description,
      timestamp: log.timestamp.toISOString(),
      severity: log.severity,
      confidence: log.metadata?.confidence || 0,
    }))

    const eventsByType = logs.reduce((acc: any, log) => {
      const eventType = log.metadata?.eventType || "unknown"
      acc[eventType] = (acc[eventType] || 0) + 1
      return acc
    }, {})

    const duration = session.endTime
      ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
      : Date.now() - new Date(session.startTime).getTime()

    const report = {
      sessionInfo: {
        id: session.sessionId,
        candidateName: session.candidateName,
        interviewerName: session.interviewerName,
        position: session.position,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString(),
        duration: Math.round(duration / 1000 / 60), // minutes
        status: session.status,
      },
      integrityScore: session.integrityScore,
      summary: {
        totalEvents: statistics.total,
        highSeverityEvents: statistics.high,
        mediumSeverityEvents: statistics.medium,
        lowSeverityEvents: statistics.low,
        eventsByType,
      },
      detailedEvents: events.sort(
        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      recommendations: generateRecommendations(session.integrityScore, eventsByType, statistics.high),
    }

    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error("[v0] Generate report error:", error)
    return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 })
  }
}

function generateRecommendations(integrityScore: number, eventsByType: any, highSeverityEvents: number) {
  const recommendations = []

  if (integrityScore < 50) {
    recommendations.push("High risk candidate - Multiple integrity violations detected")
  } else if (integrityScore < 70) {
    recommendations.push("Medium risk candidate - Some concerning behaviors observed")
  } else if (integrityScore < 90) {
    recommendations.push("Low risk candidate - Minor issues detected")
  } else {
    recommendations.push("Excellent integrity score - No significant issues detected")
  }

  if (eventsByType["looking_away"] > 5) {
    recommendations.push("Candidate frequently looked away from screen")
  }

  if (eventsByType["multiple_faces"] > 0) {
    recommendations.push("Multiple people detected during interview")
  }

  if (
    eventsByType["prohibited_object"] > 0 ||
    eventsByType["phone_detected"] > 0 ||
    eventsByType["book_detected"] > 0
  ) {
    recommendations.push("Prohibited objects detected (phone, books, notes)")
  }

  if (highSeverityEvents > 3) {
    recommendations.push("Multiple high-severity violations - Consider interview validity")
  }

  return recommendations
}
