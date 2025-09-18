"use client"

import type React from "react"

import { useRef, useEffect } from "react"

interface DetectionBox {
  class: string
  confidence: number
  bbox: [number, number, number, number]
}

interface DetectionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  detections: DetectionBox[]
  isVisible: boolean
}

export function DetectionOverlay({ videoRef, detections, isVisible }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!isVisible || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.videoWidth === 0) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw detection boxes
    detections.forEach((detection) => {
      const [x, y, width, height] = detection.bbox
      const confidence = Math.round(detection.confidence * 100)

      // Set box style based on object type
      const isProhibited = ["cell phone", "book", "laptop", "tablet", "paper"].includes(detection.class)
      ctx.strokeStyle = isProhibited ? "#ef4444" : "#f59e0b"
      ctx.lineWidth = 3
      ctx.fillStyle = isProhibited ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)"

      // Draw bounding box
      ctx.fillRect(x, y, width, height)
      ctx.strokeRect(x, y, width, height)

      // Draw label background
      const label = `${detection.class} (${confidence}%)`
      ctx.font = "14px Arial"
      const textWidth = ctx.measureText(label).width

      ctx.fillStyle = isProhibited ? "#ef4444" : "#f59e0b"
      ctx.fillRect(x, y - 25, textWidth + 10, 20)

      // Draw label text
      ctx.fillStyle = "white"
      ctx.fillText(label, x + 5, y - 8)
    })
  }, [detections, isVisible, videoRef])

  if (!isVisible) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}
