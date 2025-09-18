<!-- Banner / Title -->
<h1 align="center">ProctorX — Video Proctoring System</h1>

<p align="center">
  AI-assisted, browser-based proctoring for interviews and assessments.<br />
  Real-time camera preview, focus/object signals, alert feed, integrity scoring, and a post-session report with <b>PDF</b> and <b>CSV</b> export.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-blue" />
  <img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-4-38B2AC" />
  <img alt="MongoDB" src="https://img.shields.io/badge/Database-MongoDB-13aa52" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## ✨ Features

- 🎛️ **Modern UI** (Tailwind + shadcn/ui) with a guided start form
- 🎥 **Camera Preview** before starting the session (HTTPS only)
- 👀 **Live Proctoring** signals
  - “No face”, “Multiple faces”, “Looking away”
  - Simple **phone / book / device** object flags (confidence threshold)
  - Optional basic **drowsiness** (eyes-closed heuristic)
- 🔔 **Alerts Feed** and 📊 **Integrity Score**
- 🔒 **Session Lifecycle**
  - During session: only **End** (no report access)
  - On end: auto-opens **Report** screen
- ⬇️ **Exports:** Print-to-**PDF** & **CSV**
- 🗄️ **MongoDB persistence** for sessions and events (via `/lib/mongodb.ts` + API routes)

---

## 🧭 Table of Contents

- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Environment Variables](#-environment-variables)
- [Local Setup](#-local-setup)
- [Database Setup](#-database-setup)
- [Run & Build](#-run--build)
- [Deploy on Vercel](#-deploy-on-vercel)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🧱 Tech Stack

- **Next.js 14 (App Router) + TypeScript**
- **Tailwind CSS 4 + shadcn/ui + Lucide Icons**
- **MongoDB** (Atlas or local) through the official `mongodb` driver
- Optional detection libs included (`@tensorflow/*`, etc.) — the default hooks prefer built‑in browser APIs

---

## ✅ Prerequisites

- **Node.js 18+** (recommended LTS)
- **Git**
- A **MongoDB** instance:
  - Atlas (cloud) — recommended
  - or Local MongoDB Community Server

---

## 🔧 Environment Variables

Create a `.env` file in the project root. A starter is provided as `.env.example` (see below).

**Required:**
```bash
# Standard MongoDB URI (Atlas or local)
MONGODB_URI="mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/<DB>?retryWrites=true&w=majority&appName=<APP>"
```

**Optional (only if your code references it):**
```bash
# If you want to override the DB name used by the code
MONGODB_DB="<DB_NAME>"
```

> ⚠️ Never commit `.env` files. The repo should include `.env` in `.gitignore`.

---

## 💻 Local Setup

```bash
# 0) Fork the repo on GitHub (optional if you already cloned)
#    https://github.com/ARDEV04/ProctorX → click "Fork"

# 1) Clone your fork (or the original)
git clone https://github.com/<YOUR_USER>/ProctorX.git
# git clone git@github.com:<YOUR_USER>/ProctorX.git
cd ProctorX

# 2) Create .env from the example and fill values
cp .env.example .env
# then open .env and paste your MONGODB_URI (and optional MONGODB_DB)

# 3) Install dependencies
npm i

# 4) (Optional) Verify Mongo connectivity via the setup script
#    If you keep it as ESM, run it like this:
node --env-file=.env -e "import('./scripts/setup-mongodb.js')"
#    or rename scripts/setup-mongodb.js → setup-mongodb.mjs and:
# node --env-file=.env ./scripts/setup-mongodb.mjs

# 5) Start the dev server
npm run dev
# Open http://localhost:3000 and allow camera access
```

> The code will auto-connect using `MONGODB_URI` (defaults to `mongodb://localhost:27017/video-proctoring` if not set). Collections and indexes are created on demand in `/lib/mongodb.ts`.

---

## 🗄️ Database Setup

### Option A — MongoDB Atlas (cloud)
1. Create a free cluster: https://www.mongodb.com/atlas
2. Create a DB user and password.
3. Network Access → allow your IP (or `0.0.0.0/0` temporarily).
4. Get the **connection string** and place it in `.env` as `MONGODB_URI`:
   ```
   mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/<DB>?retryWrites=true&w=majority&appName=<APP>
   ```

### Option B — Local MongoDB
1. Install MongoDB Community Server.
2. Start the service.
3. Use a local URI in `.env`:
   ```
   MONGODB_URI="mongodb://127.0.0.1:27017/video-proctoring"
   ```

---

## ▶️ Run & Build

```bash
# Development
npm run dev

# Type-check (if you want)
npm run lint

# Production build
npm run build
npm start
```

- **HTTPS is required** for camera access in the browser (works on `localhost` and any HTTPS domain).
- The app surfaces API routes under `/app/api/*` which use the MongoDB layer for logs/sessions.

---

## ☁️ Deploy on Vercel

1. Push to GitHub (main branch).
2. In Vercel: **New Project → Import** your repo (framework auto-detected as Next.js).
3. **Build & Output** (keep defaults):
   - Build Command: `next build`
   - Output Directory: `.next`
   - Node.js: 18+
4. **Project → Settings → Environment Variables**:
   - Add `MONGODB_URI` (and `MONGODB_DB` if used).
5. **Deploy** and open the HTTPS URL. Allow camera permission when prompted.

**CLI alternative:**
```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

> To set envs via CLI: `vercel env add MONGODB_URI`

---

## 📁 Project Structure

```
app/
  api/
    events/route.ts           # In-memory event api (used by UI)
    logs/route.ts             # Mongo-backed logging API (uses /lib/mongodb.ts)
    reports/[id]/route.ts     # Report API
    sessions/route.ts         # Session create/list
    sessions/[id]/route.ts    # Session detail/end
  page.tsx                    # Main app (form → preview → session → report)
components/
  session-report.tsx          # Report screen, Export PDF/CSV
  detection-overlay.tsx       # Draws detection boxes
  detection-settings.tsx      # UI for toggles/thresholds
  alert-system.tsx            # Alert list/toasts
hooks/
  use-face-detection.ts       # Face heuristics (uses browser APIs by default)
  use-tensorflow-detection.ts # Object flags abstraction
lib/
  mongodb.ts                  # MongoDB client + collections + helpers
  api-client.ts               # Local store facade used by the app
scripts/
  setup-mongodb.js            # Optional: creates collections/indexes/sample log
```

---

## 🧪 Troubleshooting

- **Camera prompt missing / black video** — Use HTTPS (or `localhost`) and ensure no other app uses the camera.
- **Mongo connection fails** — Check `MONGODB_URI`, cluster IP allowlist (Atlas), and that the DB user has rights.
- **Build errors on Vercel** — Make sure env vars are set in Project Settings → Environment Variables. Run `npm run build` locally.
- **PDF export** — The app opens a print-styled page; use **Print → Save as PDF** in your browser.

---

## 🧾 License

**MIT** © 2025 — Your Name / Organization
