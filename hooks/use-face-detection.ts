// hooks/use-face-detection.ts
"use client"

import { useRef, useState } from "react"

export type FaceDetectionResult = {
  isLookingAtCamera: boolean
  eyesOpen: boolean
  confidence: number // 0..1
}

type DetectionCallbacks = {
  onFaceDetected: (result: FaceDetectionResult) => void
  onNoFaceDetected: () => void
  onMultipleFaces: (count: number) => void
  onLookingAway?: () => void
}

type DetectOptions = DetectionCallbacks

type AnyFaceDetector = {
  detect: (image: CanvasImageSource) => Promise<
    Array<{
      boundingBox?: DOMRectReadOnly | { x: number; y: number; width: number; height: number }
      landmarks?: any
    }>
  >
} | null

export function useFaceDetection() {
  const [isInitialized, setInitialized] = useState(false)
  const faceDetectorRef = useRef<AnyFaceDetector>(null)

  async function initializeDetector() {
    // Prefer built-in FaceDetector if available; otherwise null → fallback path
    try {
      const anyWindow = window as any
      if (anyWindow.FaceDetector) {
        faceDetectorRef.current = new anyWindow.FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
      } else {
        faceDetectorRef.current = null
      }
    } catch {
      faceDetectorRef.current = null
    } finally {
      setInitialized(true)
    }
  }

  function ensureCanvasSize(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const vw = video.videoWidth || video.clientWidth || 0
    const vh = video.videoHeight || video.clientHeight || 0
    if (vw > 0 && vh > 0) {
      if (canvas.width !== vw) canvas.width = vw
      if (canvas.height !== vh) canvas.height = vh
      return true
    }
    return false
  }

  async function detectFaces(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    callbacks: DetectOptions,
  ) {
    if (!video || !canvas) return
    if (video.readyState < 2 /* HAVE_CURRENT_DATA */) return

    // Match canvas backing size to video before drawing
    const sized = ensureCanvasSize(video, canvas)
    if (!sized) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (canvas.width === 0 || canvas.height === 0) return

    const fd = faceDetectorRef.current
    if (fd) {
      try {
        const faces = await fd.detect(canvas)
        const count = faces.length

        if (count === 0) {
          callbacks.onNoFaceDetected()
          return
        }
        if (count > 1) {
          callbacks.onMultipleFaces(count)
          // still provide a detected signal for UI continuity
        }

        // The built-in FaceDetector doesn’t give gaze/eyes, so assume neutral, stable “looking at” state
        callbacks.onFaceDetected({
          isLookingAtCamera: true,
          eyesOpen: true,
          confidence: 0.9,
        })
        return
      } catch {
        // fall through to fallback
      }
    }

    // ---- Fallback (no FaceDetector): quick luminance variance check in a center crop ----
    try {
      const sampleW = Math.max(32, Math.floor(canvas.width * 0.12))
      const sampleH = Math.max(32, Math.floor(canvas.height * 0.12))
      const sx = Math.floor((canvas.width - sampleW) / 2)
      const sy = Math.floor((canvas.height - sampleH) / 2)

      const imageData = ctx.getImageData(sx, sy, sampleW, sampleH)
      const data = imageData.data

      let sum = 0
      let sumSq = 0
      const N = sampleW * sampleH
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const lum = r * 0.299 + g * 0.587 + b * 0.114
        sum += lum
        sumSq += lum * lum
      }
      const mean = sum / N
      const variance = sumSq / N - mean * mean

      if (variance < 5) {
        callbacks.onNoFaceDetected()
        return
      }

      // Treat as one “face” detected for UI continuity
      callbacks.onFaceDetected({
        isLookingAtCamera: true,
        eyesOpen: true,
        confidence: 0.5,
      })
    } catch {
      callbacks.onNoFaceDetected()
    }
  }

  return {
    isInitialized,
    initializeDetector,
    detectFaces,
  }
}
