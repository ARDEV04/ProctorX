import type { DetectionEvent as ApiDetectionEvent } from "@/lib/api-client"

type DetectionEventType =
  | "focus_lost"
  | "no_face"
  | "multiple_faces"
  | "phone_detected"
  | "book_detected"
  | "device_detected"
  | "looking_away"
  | "eyes_closed"
  | "prohibited_object"

export const mapEventTypeToApi = (type: DetectionEventType): ApiDetectionEvent["type"] => {
  switch (type) {
    case "focus_lost":
    case "looking_away":
      return "looking_away"
    case "no_face":
      return "no_face"
    case "multiple_faces":
      return "multiple_faces"
    case "phone_detected":
    case "book_detected":
    case "device_detected":
    case "prohibited_object":
      return "prohibited_object"
    case "eyes_closed":
      return "looking_away" // Map eyes closed to looking away for API compatibility
    default:
      return "looking_away"
  }
}
