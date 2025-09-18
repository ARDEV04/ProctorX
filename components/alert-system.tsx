"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, Bell, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"

interface Alert {
  id: string
  type: "warning" | "critical" | "info"
  title: string
  message: string
  timestamp: Date
  duration?: number
  persistent?: boolean
}

interface AlertSystemProps {
  alerts: Alert[]
  onDismissAlert: (id: string) => void
  onClearAll: () => void
}

interface AlertSettings {
  enableAudioAlerts: boolean
  enableVisualAlerts: boolean
  alertVolume: number
  criticalAlertsOnly: boolean
  autoHideAlerts: boolean
  alertDuration: number
}

export function AlertSystem({ alerts, onDismissAlert, onClearAll }: AlertSystemProps) {
  const [settings, setSettings] = useState<AlertSettings>({
    enableAudioAlerts: true,
    enableVisualAlerts: true,
    alertVolume: 70,
    criticalAlertsOnly: false,
    autoHideAlerts: true,
    alertDuration: 5000,
  })
  const [showSettings, setShowSettings] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Auto-hide alerts based on settings
  useEffect(() => {
    if (!settings.autoHideAlerts) return

    const timers = alerts
      .filter((alert) => !alert.persistent)
      .map((alert) =>
        setTimeout(() => {
          onDismissAlert(alert.id)
        }, alert.duration || settings.alertDuration),
      )

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [alerts, settings.autoHideAlerts, settings.alertDuration, onDismissAlert])

  // Play audio alerts using Web Audio API
  useEffect(() => {
    if (!settings.enableAudioAlerts || alerts.length === 0) return

    const latestAlert = alerts[0]
    if (settings.criticalAlertsOnly && latestAlert.type !== "critical") return

    // Create simple beep sound
    const playBeep = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      const frequency = latestAlert.type === "critical" ? 800 : 600
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
      oscillator.type = "sine"

      gainNode.gain.setValueAtTime(0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime((settings.alertVolume / 100) * 0.3, ctx.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.5)
    }

    playBeep()
  }, [alerts, settings.enableAudioAlerts, settings.alertVolume, settings.criticalAlertsOnly])

  const getAlertColor = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
      case "warning":
        return "border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100"
      case "info":
        return "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
      default:
        return "border-gray-500 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100"
    }
  }

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case "info":
        return <Bell className="w-5 h-5 text-blue-500" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  const filteredAlerts = settings.criticalAlertsOnly ? alerts.filter((a) => a.type === "critical") : alerts

  return (
    <div className="space-y-4">
      {/* Alert Settings Panel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Real-time Alerts</h3>
          <Badge variant="secondary">{filteredAlerts.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4" />
          </Button>
          {alerts.length > 0 && (
            <Button variant="outline" size="sm" onClick={onClearAll}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 space-y-4">
          <h4 className="font-medium">Alert Settings</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Audio Alerts</label>
              <Switch
                checked={settings.enableAudioAlerts}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableAudioAlerts: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Visual Alerts</label>
              <Switch
                checked={settings.enableVisualAlerts}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableVisualAlerts: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Critical Only</label>
              <Switch
                checked={settings.criticalAlertsOnly}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, criticalAlertsOnly: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Auto Hide</label>
              <Switch
                checked={settings.autoHideAlerts}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoHideAlerts: checked }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Alert Volume: {settings.alertVolume}%</label>
            <Slider
              value={[settings.alertVolume]}
              onValueChange={([value]) => setSettings((prev) => ({ ...prev, alertVolume: value }))}
              max={100}
              step={10}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Auto Hide Duration: {settings.alertDuration / 1000}s</label>
            <Slider
              value={[settings.alertDuration]}
              onValueChange={([value]) => setSettings((prev) => ({ ...prev, alertDuration: value }))}
              min={2000}
              max={10000}
              step={1000}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No alerts to display</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 border-l-4 rounded-r-lg ${getAlertColor(alert.type)} ${
                settings.enableVisualAlerts ? "animate-pulse" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm opacity-90">{alert.message}</p>
                    <p className="text-xs opacity-70 mt-1">{alert.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismissAlert(alert.id)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
