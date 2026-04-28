# Mana Navigator · Web Demo

The interactive demo of the multi-agent personalized health navigator. **Pick a goal → watch 3 AI specialists + 1 navigator generate a real day-by-day plan with rationales for every choice.**

This is the artifact that turns the EP05/06/07 build-in-public videos into something the audience can actually try.

## Quick start (zero install)

```bash
open /Users/manamannengjiankang/Desktop/Projects/mana-navigator-demo/index.html
```

That's it. The whole demo runs in the browser — Tailwind via CDN, vanilla JS, no build step.

## What the demo does

**3 preset profiles** (instant click → agent animation → full daily plan):
1. **想瘦 5 斤的上班族** — sedentary, limited training time, ~1500 cal
2. **马拉松前 2 周 peak 训练** — high-volume, ~3000 cal, 9hr sleep target
3. **30 岁增肌 + 减脂 (recomp)** — protein-prioritized, ~2300 cal + 200g protein

**For each plan:**
- 8-9 timestamps from wake to sleep
- Specific food (with portions) at each meal
- Specific training (with structure) at each window
- **Click any item → "为什么这样安排" modal explains the agent's reasoning**
- 3 principles + a navigator tradeoff line at top
- Stats: total cal / protein / training / sleep

**Custom profile form** (toggle below preset cards):
- Inputs: gender, age, height, weight, goal, activity level
- Currently maps to nearest preset (works without API key)
- Path to wire up real Claude API: see `Future` section below

## File structure

```
mana-navigator-demo/
├── index.html       # Full UI — header, hero, profile picker, agent stream, plan output
├── data.js          # 3 preset profiles with timeline + rationale per item
├── app.js           # Profile selection → agent animation → plan reveal logic
└── README.md        # This file
```

## How to film with this

**For EP05/06/07 videos:**

1. Open `index.html` in browser (full screen)
2. Record screen
3. Click a profile card matching the episode (上班族 for EP05, 马拉松 for EP06, 增肌减脂 for EP07)
4. Let the 4 agents "think" sequentially (~4 sec total) — **this is the visual hook for "multi-agent" claim**
5. Plan reveals with all timestamps
6. Click 1-2 timeline items to show the "why" modal — **this is the differentiator from generic LLM**
7. Cut to your口播 over the screen recording

**The agent thinking animation is the MOST important shot.** Most AI demos just show input → output. Showing 4 specialists working sequentially before the answer arrives is what makes the multi-agent nature visible.

## Visual notes for filming

- Header is sticky — looks polished even when scrolling
- Tradeoff card (black box) is the navigator's signature — keep it on screen for at least 3 seconds
- Each plan item highlights with a "关键节点" tag for the most important moments
- The "why" modal is intentionally clean — single rationale, agent attribution at bottom
- 3 principles section anchors the "AI team is making structured decisions" narrative

## Switching `/me` to live data (v0.2)

`/me` fetches `/api/snapshot` on load. By default it falls back to mock data when env vars aren't set.

**To enable live data:**

1. Stand up your Mana backend with these endpoints (see `DESIGN-v0.2.md` for contracts):
   - `GET /me/v1/today/snapshot`
   - `GET /me/v1/health/recent`
   - `GET /me/v1/meals/recent`
   - `GET /me/v1/training/recent`
   All authenticated via bearer token.

2. Add Vercel env vars (Project → Settings → Environment Variables):
   ```
   MANA_API_BASE=https://your-mana-api.example.com/me/v1
   MANA_API_KEY=<your-bearer-token>
   ```

3. Redeploy. The header badge flips from amber "Demo" → green "Live".

4. If backend is unreachable, error banner appears + badge goes red "Demo · 离线".

**HealthKit sync (no iOS code needed):**

Use [Health Auto Export](https://www.healthyapps.dev/) iOS app:
- Schedule auto-export of HealthKit metrics (HRV, sleep, body comp, heart rate, activity)
- Point its webhook at your `mana-app-server` `/webhooks/health-auto-export`
- Server normalizes and stores in `health_data` table
- Backend reads from there for `/me/v1/health/recent` endpoint

This avoids any iOS engineering for v0.2.

## Future (when you have time)

- [ ] **Wire real Claude API** (custom profile form → POST to API route → real generation)
- [ ] **Memory across days** — show the agents remembering yesterday's plan
- [ ] **Real-time agent dialogue** — show the messages between agents (Sleep → Exercise: "降强度" etc.)
- [ ] **Deploy to Vercel** — public URL audience can try
- [ ] **EN version** — toggle for bilingual viewers
- [ ] **Export plan as PDF / share image** — viral mechanic
- [ ] **Real agent prompts** — show the system prompt that runs each agent (transparency)

## Wiring Claude API (future)

When ready to make custom profiles real, the pattern is:

```js
// In app.js — replace generateCustom() with:
async function generateCustom() {
  const profile = collectFormInputs();
  showAgentStream(); // start animation

  // Call your API route (server-side, with API key)
  const plan = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  }).then(r => r.json());

  // Render the result
  revealPlan(plan);
}
```

The server-side route would call Claude API with 4 prompts (Diet, Exercise, Sleep, Navigator) and return structured JSON matching the `PROFILES.{key}` shape in `data.js`.

## Why this exists

The EP05/06/07 video scripts were originally going to be filmed against static SVG cards — but static visuals make the "AI team" claim feel like marketing. **A working demo audiences can click is the actual proof.**

Build-in-public principle: ship the artifact, not the announcement.

— Simon (and the AI team that helped build it)
