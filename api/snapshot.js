// GET /api/snapshot
//
// Composite endpoint. Tries 3 sources in order:
//   1. Full upstream backend (MANA_API_BASE) — v0.2.4+
//   2. Vercel KV with Health Auto Export data — v0.2.2
//   3. 503 (frontend uses local mock) — v0.2.1 default

export default async function handler(req, res) {
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Path 1: full upstream
  if (apiBase && apiKey) {
    try {
      const upstream = await fetch(`${apiBase}/today/snapshot`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
      });
      if (upstream.ok) {
        const data = await upstream.json();
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json({ ...data, _source: 'live', _generatedAt: new Date().toISOString() });
      }
    } catch (err) { /* fall through */ }
  }

  // Path 2: KV partial — health-only
  if (kvUrl && kvToken) {
    try {
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const todayData = await kvGet(`health:simon:daily:${todayKey}`, kvUrl, kvToken);
      const yesterdayKey = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      const yesterdayData = await kvGet(`health:simon:daily:${yesterdayKey}`, kvUrl, kvToken);

      const sleepSource = yesterdayData?.sleep || todayData?.sleep;
      const hrvSource = todayData?.hrv ?? yesterdayData?.hrv;
      // Latest weight = scan today first, then walk back up to 14 days
      let weightPoint = null;
      let weightDate = null;
      const weightCandidates = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        const dk = d.toISOString().slice(0, 10);
        const dat = i === 0 ? todayData : (i === 1 ? yesterdayData : await kvGet(`health:simon:daily:${dk}`, kvUrl, kvToken));
        if (dat?.weight != null) {
          weightCandidates.push({ date: dk, value: dat.weight });
          if (!weightPoint) { weightPoint = dat.weight; weightDate = dk; }
        }
      }
      const bodyFatPoint = todayData?.bodyFat ?? yesterdayData?.bodyFat;
      const leanMassPoint = todayData?.leanMass ?? yesterdayData?.leanMass;
      const stepsToday = todayData?.steps;
      const activeEnergyToday = todayData?.activeEnergy;
      const workoutsToday = todayData?.workouts || [];

      const hasAnyData = sleepSource || hrvSource || weightPoint || stepsToday != null || workoutsToday.length;
      if (hasAnyData) {
        const liveFields = [];
        const partial = {
          _source: 'live-kv',
          _generatedAt: new Date().toISOString(),
        };

        if (sleepSource || hrvSource) {
          liveFields.push('todayContext', 'sleep');
          partial.todayContext = {
            lastNightSleep: sleepSource?.duration,
            lastNightHRV: hrvSource,
            hrvBaseline: 62
          };
          partial.sleep = sleepSource ? {
            lastNight: {
              duration: sleepSource.duration,
              target: 8,
              bedTime: sleepSource.bedTime,
              wakeTime: sleepSource.wakeTime,
              quality: sleepSource.duration ? Math.round(Math.min(100, sleepSource.duration / 8 * 90)) : null,
              stages: { deep: sleepSource.deep, rem: sleepSource.rem, light: sleepSource.light },
              hrv: hrvSource,
              restingHR: yesterdayData?.restingHR ?? todayData?.restingHR
            }
          } : null;
        }

        if (weightPoint != null || bodyFatPoint != null || leanMassPoint != null) {
          liveFields.push('body');
          partial.body = {
            weight: weightPoint != null ? { current: weightPoint, unit: 'kg', measuredOn: weightDate, history: weightCandidates.slice(0, 8).reverse().map(c => c.value) } : null,
            bodyFat: bodyFatPoint != null ? { current: bodyFatPoint, unit: '%' } : null,
            leanMass: leanMassPoint != null ? { current: leanMassPoint, unit: 'kg' } : null
          };
        }

        if (workoutsToday.length || stepsToday != null || activeEnergyToday != null) {
          liveFields.push('activity');
          partial.activity = {
            workouts: workoutsToday,
            steps: stepsToday,
            activeEnergy: activeEnergyToday
          };
        }

        partial._liveFields = liveFields;
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json(partial);
      }
    } catch (err) { /* fall through */ }
  }

  // Path 3: nothing
  return res.status(503).json({
    error: 'Backend not configured',
    hint: 'Set up Vercel KV + Health Auto Export webhook, or set MANA_API_BASE + MANA_API_KEY',
    _source: 'not-configured'
  });
}

async function kvGet(key, url, token) {
  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.result) return null;
  try { return typeof data.result === 'string' ? JSON.parse(data.result) : data.result; }
  catch { return null; }
}
