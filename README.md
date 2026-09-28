# Aura — PCOD Care

AI Cycle Intelligence + Habit Coaching + Indian Diet Personalization, as one
mobile app (iOS + Android from a single codebase) backed by a Node API.

```
backend/   Node/Express API + SQLite database (cycle engine, diet engine, auth)
mobile/    Expo (React Native) app — this is the app you run on your phone
frontend/  Original Next.js web scaffold — no longer the primary client,
           kept only in case you want a web version later. Not required.
```

## 1. Run the backend

You need Node.js 18+ installed.

```bash
cd backend
npm install
npm run dev
```

You should see `Server running on port 4000`. It creates `backend/data.sqlite`
automatically on first run — no separate database server needed.

**Important:** your phone and your laptop must be on the **same Wi-Fi
network** for the app to reach this server (there's no public URL — this is
running locally on your machine).

If you ever want to reset all data, stop the server and delete
`backend/data.sqlite*`.

## 2. Run the mobile app

You need the free **Expo Go** app installed on your iPhone or Android phone
(search "Expo Go" on the App Store / Play Store).

```bash
cd mobile
npm install
npx expo start
```

This prints a QR code in your terminal.

- **iPhone**: open the Camera app and point it at the QR code, then tap the
  notification that appears.
- **Android**: open the Expo Go app and use its built-in QR scanner.

The app will build and load on your phone directly — no App Store, no Xcode,
no Android Studio.

The app automatically detects your laptop's local IP address to talk to the
backend, as long as both are on the same Wi-Fi. If it can't connect, check:
- the backend is running (`npm run dev` in `backend/`)
- your phone and laptop are on the same Wi-Fi (not phone on mobile data) —
  a shared router can also block phone-to-laptop traffic outright if it has
  "AP/client isolation" enabled (common on ISP-provided routers); a personal
  hotspot from your phone sidesteps this entirely
- your laptop's firewall isn't blocking incoming connections on port 4000

### Why port 4000, not 5000

The backend deliberately avoids port 5000. On modern macOS, Apple's AirPlay
Receiver service (System Settings → General → AirDrop & Handoff) claims port
5000 by default and answers external requests with `403 Forbidden` before
they ever reach the Node server — with nothing showing in the backend's own
terminal, since Express never sees the request. It's a well-known gotcha for
local dev servers on Mac. If you ever see a mysterious `403` with no
matching log line in the backend terminal, that service (or something else
already bound to whatever port you're using) is almost always the cause —
either turn it off, or move the app to a different port like this project
did.

## What's implemented

**Auth** — real signup/login with hashed passwords and JWT sessions.

**Onboarding** — basics (age/height/weight), goal, food preference + regional
cuisine, and a short pattern-check quiz that seeds a starting `profile_type`
(insulin-resistant / adrenal / inflammatory / post-pill / unclassified). This
is a personalization heuristic, not a diagnosis, and is labeled as such in
the app.

**Cycle Intelligence** (`backend/src/services/cycle/cycleEngine.js`) — uses
median cycle length rather than a simple average, since PCOD cycles are
often irregular and a single very long or short cycle shouldn't skew the
prediction. Reports a confidence level, current phase, and a gentle flag
if your logged cycles look consistently irregular.

**Diet engine** (`backend/src/services/diet/`) — layered rules: regional
Indian base diet (North/South/East/West x veg/non-veg) -> goal adjustments ->
phenotype adjustments -> recent-symptom adjustments -> habit-based nudges.
Easy to extend with a real food database later without touching the API.

**Habits** — four default habits seeded per user, daily toggle, streak
tracking.

**Daily check-in** — mood, energy, symptoms, free-text note, feeds both the
diet engine and (eventually) symptom-to-cycle correlation.

## What's next (see the feature roadmap discussed earlier)

- Symptom-to-cycle-phase correlation view
- Lab-value input (LH/FSH, AMH, fasting insulin) to sharpen phenotype
- Expanded food database with glycemic-load tagging
- Push notification nudges tuned to cycle phase
- Weekly insight summaries
- Migrating from SQLite to a hosted Postgres + deploying the backend
  somewhere reachable (Render/Railway/Fly.io) once you're ready to test
  with other people, not just your own phone on your own Wi-Fi

## A note on scope

This is a working MVP, not a finished clinical product. Diet and phenotype
logic are rule-based heuristics for personalization, not medical advice.
Keep "this isn't a diagnosis" messaging front and center as you build this
out further.
