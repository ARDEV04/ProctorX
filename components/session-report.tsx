"use client"

import { useEffect, useState } from "react"
import { getSession, getReport, type SessionType } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type Props = {
  sessionId: string
  onBack: () => void
}

export function SessionReport({ sessionId, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionType | null>(null)
  const [report, setReport] = useState<Awaited<ReturnType<typeof getReport>> | null>(null)

  useEffect(() => {
    ;(async () => {
      const s = await getSession(sessionId)
      const r = await getReport(sessionId)
      setSession(s)
      setReport(r)
      setLoading(false)
    })()
  }, [sessionId])

  // ---------- Helpers (used by CSV & PDF) ----------
  function slugify(s: string) {
    return (s || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "report"
  }
  function eventsToCSV(
    events: Array<{
      id: string
      timestamp: string
      type: string
      severity: string
      description: string
      confidence?: number
      metadata?: Record<string, any>
    }>
  ) {
    const headers = ["timestamp", "type", "severity", "description", "confidence", "metadata_json"]
    const rows = events.map((e) => {
      const cells = [
        new Date(e.timestamp).toISOString(),
        e.type,
        e.severity,
        e.description,
        typeof e.confidence === "number" ? String(Math.round(e.confidence * 100) / 100) : "",
        e.metadata ? JSON.stringify(e.metadata) : "",
      ]
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    })
    return [headers.join(","), ...rows].join("\r\n")
  }
  const fmtLocal = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—")
  const fmtISO   = (d?: string | null) => (d ? new Date(d).toISOString() : "—")

  // ---- Print-ready PDF export (uses browser's Save as PDF) ----
  function handleExportPDF() {
    if (!report) return

    const title = "ProctorX Session Report"
    const candidate = session?.candidateName || "Candidate"
    const position = session?.position || "Position"

    const eventsRowsHtml = (report?.events || []).map((e) => {
      const span: any = e.metadata && (e.metadata as any).span
      const spanStr = span
        ? `from ${fmtLocal(span.start)} → ${fmtLocal(span.end)} (${(span.durationSec ?? 0)}s)`
        : (e.metadata ? escapeHTML(JSON.stringify(e.metadata)) : "")
      const conf = typeof e.confidence === "number" ? `${Math.round(e.confidence * 100)}%` : ""
      return (
        "<tr>" +
          `<td>${fmtLocal(e.timestamp)}</td>` +
          `<td>${escapeHTML(e.severity)}</td>` +
          `<td>${escapeHTML(e.description)}</td>` +
          `<td>${escapeHTML(e.type.replaceAll("_"," "))}</td>` +
          `<td>${conf}</td>` +
          `<td class="small">${spanStr}</td>` +
        "</tr>"
      )
    }).join("")

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    :root {
      --fg: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --bg: #ffffff;
      --accent: #3b82f6;
      --danger: #ef4444;
      --warn: #f59e0b;
      --ok: #10b981;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 32px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      color: var(--fg); background: var(--bg);
    }
    header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
    }
    .brand { font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
    .tag { font-size: 12px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); }
    h1 { margin: 8px 0 0; font-size: 24px; }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
    .card { border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; }
    .kv .k { font-size: 12px; color: var(--muted); }
    .kv .v { font-weight: 600; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge { font-size: 12px; padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border); }
    .badge.red { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }
    .badge.amber { background: #fef3c7; border-color: #fde68a; color: #92400e; }
    .badge.gray { background: #f1f5f9; border-color: #e2e8f0; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid var(--border); padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .small { font-size: 12px; }
    @media print {
      body { padding: 0.6in; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="tag">ProctorX</div>
      <h1>${title}</h1>
      <div class="muted small">${new Date().toLocaleString()}</div>
    </div>
    <div class="brand">${escapeHTML(candidate)} • ${escapeHTML(position)}</div>
  </header>

  <section class="card">
    <h2 style="margin:0 0 8px 0; font-size:16px;">Overview</h2>
    <div class="grid kv">
      <div><div class="k">Candidate</div><div class="v">${escapeHTML(session?.candidateName || "—")}</div></div>
      <div><div class="k">Interviewer</div><div class="v">${escapeHTML(session?.interviewerName || "—")}</div></div>
      <div><div class="k">Position</div><div class="v">${escapeHTML(session?.position || "—")}</div></div>
      <div><div class="k">Status</div><div class="v">${escapeHTML(session?.status || "—")}</div></div>
      <div><div class="k">Started</div><div class="v">${fmtLocal(session?.startedAt)}</div></div>
      <div><div class="k">Ended</div><div class="v">${fmtLocal(session?.endedAt)}</div></div>
      <div><div class="k">Duration</div><div class="v">${report?.durationSeconds ?? 0}s</div></div>
      <div><div class="k">Final Integrity</div><div class="v">${session?.finalIntegrityScore ?? "—"}%</div></div>
    </div>
  </section>

  <section class="card">
    <h2 style="margin:0 0 8px 0; font-size:16px;">Event Summary</h2>
    <div class="badges">
      <span class="badge gray">All: ${report?.totals.all ?? 0}</span>
      <span class="badge red">High: ${report?.totals.high ?? 0}</span>
      <span class="badge amber">Medium: ${report?.totals.medium ?? 0}</span>
      <span class="badge gray">Low: ${report?.totals.low ?? 0}</span>
    </div>
    <table>
      <thead><tr><th>Type</th><th>Count</th></tr></thead>
      <tbody>
        ${Object.entries(report?.totals.byType || {}).map(
          ([k, v]) => `<tr><td>${escapeHTML(k.replaceAll("_"," "))}</td><td>${v}</td></tr>`
        ).join("")}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2 style="margin:0 0 8px 0; font-size:16px;">Events (Latest First)</h2>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Severity</th>
          <th>Description</th>
          <th>Type</th>
          <th>Confidence</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${eventsRowsHtml}
      </tbody>
    </table>
    <div class="small muted" style="margin-top:8px">Generated at ${new Date().toLocaleString()}</div>
  </section>

  <div class="no-print" style="margin-top:24px; display:flex; gap:8px;">
    <button onclick="window.print()" style="padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:#f8fafc; cursor:pointer;">Print / Save as PDF</button>
  </div>

  <script>
    setTimeout(() => { try { window.print() } catch(e) {} }, 300)
  </script>
</body>
</html>
    `.trim()

    const win = window.open("", "_blank", "noopener,noreferrer")
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  // local helpers used while composing HTML
  function escapeHTML(s: string) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function handleDownloadCSV() {
    if (!report) return
    const filename =
      `${slugify(session?.candidateName || "candidate")}-` +
      `${slugify(session?.position || "role")}-events.csv`
    const csv = eventsToCSV(report.events)
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  // --------------------------------------

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading report…</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-red-500">Failed to load report.</p>
        <Button className="mt-4" onClick={onBack}>Back</Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Session Report</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button variant="outline" onClick={handleDownloadCSV}>Download CSV</Button>
          <Button onClick={handleExportPDF}>Export PDF</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Candidate</p>
            <p className="font-medium">{session?.candidateName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Interviewer</p>
            <p className="font-medium">{session?.interviewerName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Position</p>
            <p className="font-medium">{session?.position}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <Badge variant={session?.status === "ended" ? "secondary" : "default"}>
              {session?.status}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Started</p>
            <p className="font-medium">{fmtLocal(session?.startedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ended</p>
            <p className="font-medium">{fmtLocal(session?.endedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">{report.durationSeconds}s</p>
          </div>
          <div>
            <p className="text-muted-foreground">Final Integrity</p>
            <p className="font-medium">{session?.finalIntegrityScore ?? "—"}%</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex flex-wrap gap-3">
            <Badge>All: {report.totals.all}</Badge>
            <Badge variant="destructive">High: {report.totals.high}</Badge>
            <Badge>Medium: {report.totals.medium}</Badge>
            <Badge variant="secondary">Low: {report.totals.low}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(report.totals.byType).map(([k, v]) => (
              <div key={k} className="flex justify-between border rounded-md px-3 py-2">
                <span className="capitalize">{k.replaceAll("_", " ")}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events (Latest First)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {report.events.map((e) => {
              const span = (e.metadata && (e.metadata as any).span) || null
              return (
                <div key={e.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        e.severity === "high" ? "destructive" :
                        e.severity === "medium" ? "default" : "secondary"
                      }>
                        {e.severity}
                      </Badge>
                      <span className="font-medium">{e.description}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {e.type.replaceAll("_", " ")} {typeof e.confidence === "number" ? `• ${Math.round(e.confidence * 100)}%` : ""}
                  </p>
                  {span && (
                    <p className="text-xs text-muted-foreground">
                      span: {fmtLocal(span.start)} → {fmtLocal(span.end)} ({span.durationSec ?? 0}s)
                    </p>
                  )}
                </div>
              )
            })}
            {report.events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events recorded.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
