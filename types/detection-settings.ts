export interface DetectionSettingsType {
  enableDrowsinessDetection: boolean
  confidenceThreshold: number // 10..95 (%)
  showDetectionBoxes: boolean
  enableAudioDetection: boolean

  // NEW — enhanced detection using face landmarks (EAR + yaw)
  enhancedFaceLandmarks?: boolean // default false
  drowsyEARThreshold?: number     // default 0.20
  minDrowsyMs?: number            // default 1500 ms
  minLookingAwayMs?: number       // default 5000 ms
  endHysteresisMs?: number        // default 800 ms (avoid flicker when closing spans)
}
