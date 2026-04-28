# Mana Navigator · DESIGN v0.2

> **Goal:** make `/me` consume **real** data (HealthKit + Mana backend) instead of mock.
> **Status:** design-only, awaiting Simon's confirmation before build.
> **Last updated:** 2026-04-28

---

## TL;DR

v0.2 turns three currently-mocked surfaces into live data:

| Surface | v0.1 (mock) | v0.2 (live) |
|---|---|---|
| Body data (HRV / sleep / heart rate / weight / body fat) | hardcoded in `me-data.js` | Apple HealthKit → `mana-ios` → `mana-app-server` → web |
| Behavior data (food photos, macros, meals) | hardcoded recent meals | `food-print-analysis` outputs → `mana-app-server` → web |
| Training data (sessions, lifts, volume) | hardcoded in `me-data.js` | logged in `mana-ios` → `mana-app-server` → web |

The web demo doesn't talk to the backend directly. **Vercel serverless functions** sit between (server-to-server, holds API key), so the browser never sees credentials.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Phone (Simon)                                                   │
│                                                                 │
│ ┌─ Apple Health ─┐                                              │
│ │ aggregates:     │ ← Apple Watch / Whoop / Oura / 体重秤 /     │
│ │  HRV / sleep    │   any HealthKit-compatible device           │
│ │  HR / weight    │                                             │
│ │  bodyFat        │                                             │
│ └────────┬────────┘                                             │
│          │                                                       │
│          ▼ HealthKit read                                        │
│ ┌─ mana-ios ──────┐                                              │
│ │ (Swift)          │  + 餐食拍照 → food-print-analysis           │
│ │                  │  + 训练手动 log                              │
│ │ POST /events     │                                              │
│ └────────┬─────────┘                                             │
└──────────┼───────────────────────────────────────────────────────┘
           │
           ▼ HTTPS
┌──────────────────────────────────────────────────────────────────┐
│ Mana 后端 (Simon's existing infra)                                │
│                                                                  │
│  mana-api-gateway (Go)                                           │
│   ├─→ mana-app-server (Java/Spring Boot, Postgres) — 数据存储     │
│   └─→ food-print-analysis (Python/FastAPI) — 餐食识别            │
│                                                                  │
│  Exposes (new): GET /me/v1/health/recent                         │
│                  GET /me/v1/meals/recent                         │
│                  GET /me/v1/training/recent                      │
│                  GET /me/v1/today/snapshot                       │
└────────────────────────┬─────────────────────────────────────────┘
                         │ Bearer ${MANA_API_KEY}
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Vercel Functions (this repo)                                     │
│  /api/health       → proxies /me/v1/health/recent                 │
│  /api/meals        → proxies /me/v1/meals/recent                  │
│  /api/training     → proxies /me/v1/training/recent               │
│  /api/snapshot     → proxies /me/v1/today/snapshot                │
│                                                                  │
│  Adds: caching (60s) · mock fallback if env vars unset · CORS    │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ /me web demo (browser)                                           │
│  Renders top status / Today / Diet / Exercise / Sleep / Progress │
│  with **real** data from Vercel functions                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## API contracts (the 4 endpoints web consumes)

### 1. `GET /me/v1/today/snapshot`

The single call `/me` makes on load. Returns everything needed for Today screen.

```json
{
  "user": { "name": "Simon", "goal": "recomp", "weeklyFocus": "Week 3/12" },
  "now": "2026-04-28T16:42:00+08:00",
  "compliance": { "overall": 78, "protein": 80, "training": 50, "sleep": 90 },
  "outcome": {
    "weight": { "start": 75.0, "current": 73.2, "target": 71.5, "history": [...], "projection": [...] },
    "bodyFat": { ... },
    "leanMass": { ... }
  },
  "todayContext": {
    "lastNightSleep": 7.2,
    "lastNightHRV": 58,
    "hrvBaseline": 62,
    "todayTrainingType": "Pull"
  },
  "tradeoff": "午餐 +250 卡 — 晚餐已削减 50g 米饭",
  "schedule": [
    {
      "id": "lunch",
      "time": "12:30",
      "status": "drift",
      "what": "...",
      "actual": { "time": "13:10", "calories": 850, "drift": { "calories": +250 } },
      "agent": "饮食 Agent",
      "why": "..."
    },
    ...
  ],
  "drifts": [
    { "scheduleItemId": "lunch", "type": "calories_over", "magnitude": 250 }
  ]
}
```

### 2. `GET /me/v1/health/recent?days=14`

```json
{
  "lastNight": {
    "duration": 7.2, "target": 8, "bedTime": "23:42", "wakeTime": "06:54",
    "quality": 78, "stages": { "deep": 1.4, "rem": 1.8, "light": 4.0 },
    "hrv": 58, "restingHR": 54
  },
  "weekSleep": [
    { "date": "2026-04-22", "duration": 7.5, "quality": 82, "hrv": 60 },
    ...
  ],
  "hrvBaseline": 62,
  "hrvHistory": [
    { "date": "2026-04-15", "hrv": 60 },
    ...
  ]
}
```

### 3. `GET /me/v1/meals/recent?limit=10`

```json
{
  "today": { "calories": 2210, "protein": 184, "carbs": 215, "fat": 72 },
  "targets": { "calories": 2300, "protein": 200, "carbs": 230, "fat": 75 },
  "weekSummary": [
    { "date": "2026-04-22", "calories": 2280, "protein": 195, "carbs": 225, "fat": 73 },
    ...
  ],
  "recentMeals": [
    {
      "id": "meal_abc123",
      "datetime": "2026-04-28T13:10:00+08:00",
      "name": "午餐 · 牛肉面",
      "photoUrl": "https://...",
      "calories": 850, "protein": 38, "carbs": 105, "fat": 30,
      "items": [
        { "food": "牛肉面", "portion_g": 350 },
        { "food": "炸鸡", "portion_g": 80 }
      ],
      "drift": true
    },
    ...
  ]
}
```

### 4. `GET /me/v1/training/recent?days=14`

```json
{
  "today": {
    "type": "Pull",
    "duration": 60,
    "lifts": [
      { "name": "硬拉", "sets": "4 × 6", "weight": "120kg", "trend": "+2.5kg vs last week" }
    ]
  },
  "weekVolume": [
    { "date": "2026-04-22", "type": "Push", "volume": 12500 },
    ...
  ],
  "strengthProgression": {
    "squat": [{ "week": 1, "max": 85 }, ...],
    "bench": [...],
    "deadlift": [...]
  }
}
```

---

## What Simon needs to do (backend side)

### Task A · Add 4 endpoints to `mana-api-gateway`

Wire to existing `mana-app-server` queries. Roughly:
- `GET /me/v1/today/snapshot` — composite query, joins user + meals + training + sleep + body comp
- `GET /me/v1/health/recent` — read from HealthKit-synced table (see Task C)
- `GET /me/v1/meals/recent` — read from existing food data (food-print-analysis already populates this)
- `GET /me/v1/training/recent` — read from training_session table

Auth: simple bearer token (`MANA_API_KEY`), validated by gateway. For v0.2 this is Simon-only — no multi-user yet.

### Task B · Run gateway publicly

- Deploy gateway with TLS at e.g. `https://api.mana.dev/me/v1/...`
- Configure CORS: only allow `https://mana-navigator-demo.vercel.app` (or none — Vercel functions proxy server-to-server, no browser-side CORS needed)
- Bearer token auth
- Rate limit: optional for now (Simon-only)

### Task C · HealthKit sync from `mana-ios`

Add a HealthKit reader to the iOS app:
1. Request permission for: HRV, sleep analysis, heart rate, body mass, body fat percentage, lean mass, active energy, steps
2. Background sync: every X minutes (or on app open) read last 24h and POST to `mana-app-server` `/events/health`
3. Server stores in `health_data` table: `(user_id, metric, value, unit, timestamp, source)`

**Easier first-pass** (avoids iOS engineering tonight):
- Use [Health Auto Export](https://www.healthyapps.dev/) iOS app — it can auto-export HealthKit data to a webhook
- Point the webhook at `mana-app-server` `/webhooks/health-auto-export`
- Server stores same as Task C

This decouples the data sync from `mana-ios` development.

### Task D · Tell Simon what env vars to set on Vercel

Once endpoints are live:
```
MANA_API_BASE=https://api.mana.dev/me/v1
MANA_API_KEY=<the bearer token>
MANA_USER_ID=simon
```

Vercel functions read these and proxy.

---

## What I'll do (web side scaffolding)

### Step 1 · Create 4 Vercel functions

`api/health.js`, `api/meals.js`, `api/training.js`, `api/snapshot.js`. Each:
1. Reads `process.env.MANA_API_BASE` + `MANA_API_KEY`
2. If unset → returns mock data (current `me-data.js` content, transformed to API contract shape)
3. If set → fetches `${MANA_API_BASE}/${endpoint}` with bearer token, caches 60s
4. Returns to client

### Step 2 · Update `me-app.js` to fetch instead of using `SIMON` directly

Replace `SIMON` global with `await loadProfile()` that:
1. Calls `/api/snapshot` on page load
2. Falls back to mock if 503
3. Stores in same `SIMON` shape so existing render code works
4. Shows "Live data" badge in header when real / "Demo data" when mock

### Step 3 · Add live-data badge in header

Top right of header, next to settings cog:
- 🟢 Live (when real data loaded)
- 🟡 Demo (when mock fallback)
- 🔴 Error (when fetch failed)

Click → modal showing "Connected to: [API base]" or "Mock fallback active. Add `MANA_API_BASE` to enable live."

### Step 4 · Update README with Vercel env var setup

Clear instructions: how to flip from mock to live.

---

## Phasing within v0.2

### v0.2.1 — Web-side scaffold only (1 commit, ship today)
- 4 Vercel functions with mock fallback
- Frontend fetches from them
- Live/Demo badge
- Documentation
- **Result:** identical UX to v0.1 today, but ready for live data

### v0.2.2 — First real endpoint (Simon's task: 1-2 days)
- Stand up `mana-api-gateway` `/me/v1/health/recent`
- Set Vercel env vars
- HealthKit sync via Health Auto Export OR mana-ios HealthKit reader
- Web automatically picks up live HRV / sleep
- **Result:** sleep + HRV are real

### v0.2.3 — Meals real (Simon's task: 1 day)
- `/me/v1/meals/recent` endpoint exposed
- food-print-analysis already produces the data
- Just needs the gateway route + DB query
- **Result:** Simon's actual photos + macros show in /me

### v0.2.4 — Training + snapshot (Simon's task: 1-2 days)
- `/me/v1/training/recent` endpoint
- `/me/v1/today/snapshot` composite endpoint
- **Result:** entire /me is real data

---

## Open questions (待 Simon 决定)

1. **Backend domain?** `api.mana.dev`? `api.simoniouswu.com`? Something existing?
2. **First sync mechanism for HealthKit?** Health Auto Export (zero iOS work) or build into mana-ios (proper)?
3. **Auth model?** Single bearer token for v0.2 (Simon-only) — confirmed?
4. **Photo storage?** Where do meal photos live? (S3 / Cloudflare R2 / your own)
5. **CORS or proxy-only?** I lean proxy-only (Vercel function calls backend, browser only talks to Vercel). Cleaner. Confirm?
6. **Error states UI?** When fetch fails, fall through to mock silently OR show explicit "live data unavailable" message?
7. **Should chat (`/api/chat`) also receive real data context?** Currently it gets a snapshot from frontend; v0.2 could pull live data server-side instead. Cleaner.
8. **Refresh cadence?** Real-time via WebSocket / SSE? Polling every X seconds? Refresh-on-focus? I lean refresh-on-focus + manual refresh button.

---

## Definition of done v0.2

`/me` consumes live data when env vars set, falls back to mock otherwise:

- [ ] 4 Vercel functions exist with API contracts above
- [ ] Each function has both real (proxied) + mock paths
- [ ] Frontend fetches via `/api/snapshot` on load, populates `SIMON` shape
- [ ] Live/Demo badge in header reflects current source
- [ ] README has clear setup instructions
- [ ] No regression: when env vars unset, demo behaves identically to v0.1
- [ ] When env vars set + backend reachable, real data renders

Not in scope (v0.3+): multi-user sign-up, HealthKit write-back, real-time WebSocket updates.

---

## Recommendation for next move

1. Simon answers at minimum questions 2 (sync mechanism), 5 (proxy vs CORS), 6 (error UI)
2. I ship v0.2.1 (web scaffold + 4 mock functions + badge) — visible no-op for users but unlocks all subsequent work
3. Simon does Task A/B/C/D on his own time → flips a switch on Vercel → live
4. We write DESIGN-v0.3.md (Supabase + multi-user) when v0.2 has flowed end-to-end

I will NOT build until you confirm the architecture + answer at least the 3 above.
