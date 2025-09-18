"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"

interface DetectionSettingsProps {
  settings: {
    showDetectionBoxes: boolean
    confidenceThreshold: number
    enableAudioDetection: boolean
    enableDrowsinessDetection: boolean
  }
  onSettingsChange: (settings: any) => void
}

export function DetectionSettings({ settings, onSettingsChange }: DetectionSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Detection Settings
          <Badge variant="secondary" className="text-xs">
            Advanced
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="detection-boxes" className="text-sm">
            Show Detection Boxes
          </Label>
          <Switch
            id="detection-boxes"
            checked={settings.showDetectionBoxes}
            onCheckedChange={(checked) => updateSetting("showDetectionBoxes", checked)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Confidence Threshold: {settings.confidenceThreshold}%</Label>
          <Slider
            value={[settings.confidenceThreshold]}
            onValueChange={([value]) => updateSetting("confidenceThreshold", value)}
            max={100}
            min={10}
            step={5}
            className="w-full"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="audio-detection" className="text-sm">
            Audio Detection
          </Label>
          <Switch
            id="audio-detection"
            checked={settings.enableAudioDetection}
            onCheckedChange={(checked) => updateSetting("enableAudioDetection", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="drowsiness-detection" className="text-sm">
            Drowsiness Detection
          </Label>
          <Switch
            id="drowsiness-detection"
            checked={settings.enableDrowsinessDetection}
            onCheckedChange={(checked) => updateSetting("enableDrowsinessDetection", checked)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
