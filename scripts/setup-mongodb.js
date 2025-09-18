// MongoDB setup script to create indexes and initial collections
import { MongoClient } from "mongodb"

async function setupMongoDB() {
  const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/video-proctoring"

  console.log("[v0] Connecting to MongoDB...")
  const client = new MongoClient(mongoUrl)

  try {
    await client.connect()
    console.log("[v0] Connected to MongoDB successfully")

    const db = client.db("video-proctoring")

    // Create collections
    const logsCollection = db.collection("logs")
    const sessionsCollection = db.collection("sessions")

    // Create indexes for better performance
    console.log("[v0] Creating indexes...")

    await logsCollection.createIndex({ sessionId: 1, timestamp: -1 })
    await logsCollection.createIndex({ type: 1, severity: 1 })
    await logsCollection.createIndex({ timestamp: -1 })

    await sessionsCollection.createIndex({ sessionId: 1 }, { unique: true })
    await sessionsCollection.createIndex({ startTime: -1 })
    await sessionsCollection.createIndex({ candidateName: 1 })
    await sessionsCollection.createIndex({ status: 1 })

    console.log("[v0] MongoDB setup completed successfully!")
    console.log("[v0] Collections created: logs, sessions")
    console.log("[v0] Indexes created for optimal performance")

    // Insert a test log entry to verify everything works
    const testLog = {
      sessionId: "test_session_" + Date.now(),
      timestamp: new Date(),
      type: "system_log",
      severity: "info",
      description: "MongoDB setup completed - test entry",
      metadata: {
        setupTime: new Date().toISOString(),
        version: "1.0.0",
      },
    }

    await logsCollection.insertOne(testLog)
    console.log("[v0] Test log entry created successfully")
  } catch (error) {
    console.error("[v0] MongoDB setup failed:", error)
    throw error
  } finally {
    await client.close()
    console.log("[v0] MongoDB connection closed")
  }
}

// Run the setup
setupMongoDB().catch(console.error)
