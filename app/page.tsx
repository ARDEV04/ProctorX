"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Video,
  StopCircle,
  AlertTriangle,
  Eye,
  Users,
  Phone,
  BookOpen,
  Monitor,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Camera,
  CameraOff,
} from "lucide-react"
import { useFaceDetection } from "@/hooks/use-face-detection"
import { useTensorFlowDetection } from "@/hooks/use-tensorflow-detection"
import { DetectionOverlay } from "@/components/detection-overlay"
import { DetectionSettings } from "@/components/detection-settings"
import { AlertSystem } from "@/components/alert-system"
import apiClient, { type SessionType as Session } from "@/lib/api-client"
import type { DetectionSettingsType } from "@/types/detection-settings"

interface DetectionEvent {
  id: string
  type:
    | "focus_lost"
    | "no_face"
    | "multiple_faces"
    | "phone_detected"
    | "book_detected"
    | "device_detected"
    | "looking_away"
    | "eyes_closed"
    | "prohibited_object"
  timestamp: Date
  description: string
  severity: "low" | "medium" | "high"
  confidence?: number
  metadata?: Record<string, any>
}

interface Alert {
  id: string
  type: "warning" | "critical" | "info"
  title: string
  message: string
  timestamp: Date
  duration?: number
  persistent?: boolean
}

interface DetectionBox {
  class: string
  confidence: number
  bbox: [number, number, number, number]
}

export default function VideoProctoring() {
  const [isRecording, setIsRecording] = useState(false)
  const [candidateName, setCandidateName] = useState("")
  const [candidateEmail, setCandidateEmail] = useState("")
  const [interviewerName, setInterviewerName] = useState("")
  const [position, setPosition] = useState("")
  const [sessionMode, setSessionMode] = useState<"live" | "mock">("live")
  const [consent, setConsent] = useState(false)
  const [formStep, setFormStep] = useState(0)

  const [sessionStarted, setSessionStarted] = useState(false)
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([])
  const [currentStatus, setCurrentStatus] = useState<string>("Ready to start")
  const [integrityScore, setIntegrityScore] = useState(100)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [currentDetections, setCurrentDetections] = useState<DetectionBox[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [showReport, setShowReport] = useState(false) // Only shown AFTER session ends
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettingsType>({
    enableDrowsinessDetection: true,
    confidenceThreshold: 50,
    showDetectionBoxes: true,
    enableAudioDetection: false,
  })

  // -------- Preview-specific state --------
  const [previewActive, setPreviewActive] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(null)

  // -------- Refs --------
  const videoRef = useRef<HTMLVideoElement>(null) // in-session video
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const previewVideoRef = useRef<HTMLVideoElement>(null) // preview video
  const previewStreamRef = useRef<MediaStream | null>(null)

  const sessionStartTimeRef = useRef<number>(0)

  // Detection related refs/state
  const [noFaceStartTime, setNoFaceStartTime] = useState<number | null>(null)
  const [lookingAwayStartTime, setLookingAwayStartTime] = useState<number | null>(null)
  const [currentFaceCount, setCurrentFaceCount] = useState(0)
  const [isLookingAtCamera, setIsLookingAtCamera] = useState(true)

  const { initializeDetector, detectFaces } = useFaceDetection()
  const { loadModel, detectObjects } = useTensorFlowDetection()

  // ---------- Session timer ----------
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (sessionStarted && isRecording) {
      sessionStartTimeRef.current = Date.now()
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
        setSessionDuration(elapsed)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [sessionStarted, isRecording])

  // ---------- Clean up preview on unmount ----------
  useEffect(() => {
    return () => {
      stopPreview()
    }
  }, [])

  // ---------- Boot models after user interaction ----------
  useEffect(() => {
    if (!sessionStarted) return
    ;(async () => {
      // Ensure preview stream is stopped so we don't hold two camera tracks
      stopPreview()

      await initializeVideoStream()
      await initializeDetector()
      await loadModel()
      startDetectionLoop()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted])

  // =========================
  // Preview controls
  // =========================
  const startPreview = async () => {
    try {
      setPreviewError(null)
      if (previewStreamRef.current) {
        setPreviewActive(true)
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      previewStreamRef.current = stream
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream
        await new Promise<void>((resolve) => {
          const v = previewVideoRef.current!
          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) resolve()
          else {
            const onReady = () => {
              v.removeEventListener("loadedmetadata", onReady)
              v.removeEventListener("loadeddata", onReady)
              resolve()
            }
            v.addEventListener("loadedmetadata", onReady, { once: true })
            v.addEventListener("loadeddata", onReady, { once: true })
          }
        })
        setPreviewDims({ w: previewVideoRef.current.videoWidth, h: previewVideoRef.current.videoHeight })
        await previewVideoRef.current.play().catch(() => {})
      }
      setPreviewActive(true)
    } catch (e: any) {
      setPreviewError(e?.message || "Failed to access camera.")
      setPreviewActive(false)
      stopPreview()
    }
  }

  const stopPreview = () => {
    try {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {}
    previewStreamRef.current = null
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null
    setPreviewActive(false)
    setPreviewDims(null)
  }

  // =========================
  // In-session video
  // =========================
  const initializeVideoStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Wait for the video to have dimensions before detection starts
        await new Promise<void>((resolve) => {
          const v = videoRef.current!
          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
            resolve()
          } else {
            const onReady = () => {
              v.removeEventListener("loadedmetadata", onReady)
              v.removeEventListener("loadeddata", onReady)
              resolve()
            }
            v.addEventListener("loadedmetadata", onReady, { once: true })
            v.addEventListener("loadeddata", onReady, { once: true })
          }
        })
        await videoRef.current.play().catch(() => {})
      }

      // Recording setup
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })
      mediaRecorderRef.current = mediaRecorder
      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        console.log("Recorded blob size:", blob.size)
        // TODO: Upload to storage if needed
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Could not access camera:", error)
      setCurrentStatus("Camera access denied or unavailable")
    }
  }

  const startDetectionLoop = async () => {
    const detectFrame = async () => {
      if (!videoRef.current || !canvasRef.current) {
        requestAnimationFrame(detectFrame)
        return
      }

      await detectFaces(videoRef.current, canvasRef.current, {
        onFaceDetected: (result) => {
          setCurrentFaceCount(1)
          setIsLookingAtCamera(result.isLookingAtCamera)

          if (noFaceStartTime) setNoFaceStartTime(null)

          if (!result.isLookingAtCamera) {
            if (!lookingAwayStartTime) {
              setLookingAwayStartTime(Date.now())
            } else if (Date.now() - lookingAwayStartTime > 5000) {
              addDetectionEvent(
                "looking_away",
                "Candidate looking away from screen for >5 seconds",
                "medium",
                result.confidence,
              )
              setLookingAwayStartTime(Date.now())
            }
          } else {
            setLookingAwayStartTime(null)
          }

          if (!result.eyesOpen && detectionSettings.enableDrowsinessDetection) {
            addDetectionEvent("eyes_closed", "Eyes closed detected — possible drowsiness", "low", result.confidence)
          }

          setCurrentStatus("Monitoring — Face detected")
        },
        onNoFaceDetected: () => {
          setCurrentFaceCount(0)
          if (!noFaceStartTime) {
            setNoFaceStartTime(Date.now())
          } else if (Date.now() - noFaceStartTime > 10000) {
            addDetectionEvent("no_face", "No face in frame for >10 seconds", "high")
            setNoFaceStartTime(Date.now())
          }
          setCurrentStatus("Monitoring — No face")
        },
        onMultipleFaces: (count) => {
          setCurrentFaceCount(count)
          addDetectionEvent("multiple_faces", `Multiple faces detected (${count})`, "high")
          setCurrentStatus("Monitoring — Multiple faces")
        },
        onLookingAway: () => {
          setIsLookingAtCamera(false)
        },
      })

      await detectObjects(videoRef.current, {
        onObjectsDetected: (detections) => {
          setCurrentDetections(detections)
          const threshold = detectionSettings.confidenceThreshold / 100

          detections.forEach((det) => {
            if (det.confidence < threshold) return

            const cls = det.class.toLowerCase()
            if (cls.includes("phone") || cls.includes("cell")) {
              addDetectionEvent("phone_detected", "Phone-like object detected", "medium", det.confidence)
            } else if (cls.includes("book") || cls.includes("paper")) {
              addDetectionEvent("book_detected", "Book/notes-like object detected", "low", det.confidence)
            } else if (cls.includes("laptop") || cls.includes("tablet") || cls.includes("monitor")) {
              addDetectionEvent("device_detected", "Extra electronic device detected", "medium", det.confidence)
            }
          })
        },
      })

      requestAnimationFrame(detectFrame)
    }

    requestAnimationFrame(detectFrame)
  }

  const addDetectionEvent = async (
    type: DetectionEvent["type"],
    description: string,
    severity: DetectionEvent["severity"],
    confidence?: number,
  ) => {
    const event: DetectionEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      timestamp: new Date(),
      description,
      severity,
      confidence,
    }

    setDetectionEvents((prev) => [event, ...prev].slice(0, 50))

    const deduction = severity === "high" ? 10 : severity === "medium" ? 5 : 2
    setIntegrityScore((prev) => Math.max(0, prev - deduction))

    const alertType = severity === "high" ? "critical" : severity === "medium" ? "warning" : "info"
    const alert: Alert = {
      id: event.id,
      type: alertType,
      title: description,
      message: `${type.replaceAll("_", " ")}${typeof confidence === "number" ? ` • ${Math.round(confidence * 100)}%` : ""}`,
      timestamp: new Date(),
      duration: 5000,
    }
    setAlerts((prev) => [alert, ...prev])

    if (currentSession?.id) {
      await apiClient.logEvent({
        sessionId: currentSession.id,
        type,
        description,
        severity,
        confidence,
        metadata: {
          faceCount: currentFaceCount,
          objectsDetected: currentDetections.map((d) => d.class),
          integrityScore,
        },
      })
    }
  }

  // ======= Session controls (modified per your requirements) =======
  const stopSession = async () => {
    try {
      mediaRecorderRef.current?.stop()
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setIsRecording(false)
    setSessionStarted(false)

    if (currentSession?.id) {
      const resp = await apiClient.endSession(currentSession.id, integrityScore)
      // update local session with 'ended' status for a clean guard
      if (resp?.session) setCurrentSession(resp.session)
    }

    // Immediately open the Report view after ending
    setShowReport(true)
  }

  const startSession = async () => {
    // Basic validation
    const valid = candidateName.trim() && interviewerName.trim() && position.trim() && candidateEmail.trim() && consent
    if (!valid) {
      setFormStep(0)
      return
    }

    try {
      const response = await apiClient.createSession({
        candidateName: candidateName.trim(),
        interviewerName: interviewerName.trim(),
        position: position.trim(),
      })

      if (response.success && response.session) {
        // Ensure preview is off before starting
        stopPreview()

        setCurrentSession(response.session)
        setSessionStarted(true)
        setIsRecording(true)
        setDetectionEvents([])
        setIntegrityScore(100)
        setSessionDuration(0)
        setCurrentDetections([])
        setShowReport(false) // Report locked until session ends

        await apiClient.logEvent({
          sessionId: response.session.id,
          type: "looking_away",
          description: "Interview session started",
          severity: "low",
          metadata: {
            candidateName: candidateName.trim(),
            interviewerName: interviewerName.trim(),
            position: position.trim(),
            sessionMode,
            eventType: "session_started",
          },
        })
      }
    } catch (error) {
      console.error("Failed to start session:", error)
    }
  }

  const dismissAlert = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id))
  const clearAllAlerts = () => setAlerts([])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "focus_lost":
      case "looking_away":
        return <Eye className="w-4 h-4" />
      case "multiple_faces":
        return <Users className="w-4 h-4" />
      case "phone_detected":
        return <Phone className="w-4 h-4" />
      case "book_detected":
        return <BookOpen className="w-4 h-4" />
      case "device_detected":
      case "prohibited_object":
        return <Monitor className="w-4 h-4" />
      case "no_face":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  // --- Report view (only after session ended) ---
  if (showReport && currentSession && currentSession.status === "ended") {
    const SessionReport = require("@/components/session-report").SessionReport
    return <SessionReport sessionId={currentSession.id} onBack={() => setShowReport(false)} />
  }

  // --- Landing / Form + In-session UI ---
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 text-primary text-xs font-medium">
            <ShieldCheck className="w-4 h-4" /> AI-assisted Interview Integrity
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">ProctorX Interview Proctoring</h1>
          <p className="text-muted-foreground mt-2">
            Real-time focus & prohibited-object detection with a clean, modern UI.
          </p>
        </div>

        {!sessionStarted ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="order-2 lg:order-1">
              <CardHeader>
                <CardTitle>Start a New Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Stepper */}
                <div className="flex items-center justify-between">
                  {[
                    { title: "Details" },
                    { title: "Consent" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${formStep >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {i + 1}
                      </div>
                      <span className={`text-sm ${formStep === i ? 'font-semibold' : 'text-muted-foreground'}`}>{s.title}</span>
                      {i < 1 && <div className="w-10 h-[2px] bg-border mx-2" />}
                    </div>
                  ))}
                </div>

                {formStep === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="candidateName">Candidate Name *</Label>
                      <Input
                        id="candidateName"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="Enter candidate's full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="candidateEmail">Candidate Email *</Label>
                      <Input
                        id="candidateEmail"
                        type="email"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="interviewerName">Interviewer *</Label>
                      <Input
                        id="interviewerName"
                        value={interviewerName}
                        onChange={(e) => setInterviewerName(e.target.value)}
                        placeholder="Enter interviewer's name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="position">Position / Role *</Label>
                      <Input
                        id="position"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="e.g., Frontend Engineer"
                      />
                    </div>
                  </div>
                )}

                {formStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        By starting, you confirm the candidate has consented to video recording and automated analysis
                        for the purpose of interview integrity.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      I have the candidate's consent.
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" disabled={formStep === 0} onClick={() => setFormStep((s) => Math.max(0, s - 1))}>
                    Back
                  </Button>
                  {formStep < 1 ? (
                    <Button onClick={() => setFormStep((s) => Math.min(1, s + 1))}>Next</Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={startPreview}
                        disabled={previewActive}
                        title="Enable camera preview"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        {previewActive ? "Preview On" : "Enable Preview"}
                      </Button>
                      {previewActive && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={stopPreview}
                          title="Disable camera preview"
                        >
                          <CameraOff className="w-4 h-4 mr-2" />
                          Disable Preview
                        </Button>
                      )}
                      <Button
                        className="w-40"
                        onClick={startSession}
                        disabled={!candidateName || !interviewerName || !position || !candidateEmail || !consent}
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Start Session
                      </Button>
                    </div>
                  )}
                </div>

                {/* Preview notices */}
                {previewError && (
                  <p className="text-xs text-red-500">{previewError}</p>
                )}
                {previewActive && previewDims && (
                  <p className="text-xs text-muted-foreground">
                    Preview resolution: {previewDims.w}×{previewDims.h}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Right: live preview area */}
            <Card className="order-1 lg:order-2">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video w-full bg-black/80 rounded-lg overflow-hidden grid place-items-center text-muted-foreground">
                  {previewActive ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Video className="w-10 h-10" />
                      <p className="text-xs">Click “Enable Preview” to test your camera before starting.</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Mode</p>
                    <p className="font-medium capitalize">{sessionMode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Confidence</p>
                    <p className="font-medium">{detectionSettings.confidenceThreshold}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="truncate">
                    Candidate: {candidateName} <span className="text-muted-foreground font-normal">• {position}</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setShowSettings(!showSettings)} variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                    {/* Report button REMOVED during session. Only "End" remains per your requirement. */}
                    <Badge variant={isRecording ? "destructive" : "secondary"}>
                      {isRecording ? "Recording" : "Stopped"}
                    </Badge>
                    <Button onClick={stopSession} variant="outline" size="sm">
                      <StopCircle className="w-4 h-4 mr-2" />
                      End
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video ref={videoRef} autoPlay muted className="w-full h-auto max-h-[520px] object-cover" />
                    <canvas ref={canvasRef} className="hidden" />

                    <DetectionOverlay
                      videoRef={videoRef}
                      detections={currentDetections}
                      isVisible={detectionSettings.showDetectionBoxes}
                    />

                    <div className="absolute left-3 top-3 flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{currentStatus}</Badge>
                      <Badge variant={currentFaceCount === 1 ? "secondary" : "destructive"}>
                        {currentFaceCount === 0 ? "No Face" : currentFaceCount === 1 ? "1 Face" : `${currentFaceCount} Faces`}
                      </Badge>
                      <Badge variant={isLookingAtCamera ? "secondary" : "destructive"}>{isLookingAtCamera ? "Looking" : "Away"}</Badge>
                    </div>
                  </div>

                  {showSettings && (
                    <div className="mt-4">
                      <DetectionSettings settings={detectionSettings} onSettingsChange={setDetectionSettings} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <AlertSystem alerts={alerts} onDismissAlert={dismissAlert} onClearAll={clearAllAlerts} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Integrity Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${integrityScore >= 80 ? "text-green-500" : integrityScore >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                      {integrityScore}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {integrityScore >= 80 ? "Excellent" : integrityScore >= 60 ? "Good" : "Needs Review"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Elapsed: {formatDuration(sessionDuration)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detection Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {detectionEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <div className="mt-0.5">{getEventIcon(event.type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={event.severity === "high" ? "destructive" : event.severity === "medium" ? "default" : "secondary"}>
                              {event.severity}
                            </Badge>
                            <p className="font-medium">{event.description}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {event.timestamp.toLocaleTimeString()} {event.confidence && `• ${Math.round(event.confidence * 100)}%`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {detectionEvents.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
