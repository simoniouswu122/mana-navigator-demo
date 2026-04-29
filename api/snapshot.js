// GET /api/snapshot
//
// Composite endpoint. Tries 3 sources in order:
//   1. Full upstream backend (MANA_API_BASE) — v0.2.4+
//   2. Vercel KV with Health Auto Export data — v0.2.2
//   3. 503 (frontend uses local mock) — v0.2.1 default

export default async function handler(req, res) {
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

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

      if (sleepSource || hrvSource) {
        const partial = {
          _source: 'live-kv',
          _generatedAt: new Date().toISOString(),
          _liveFields: ['todayContext', 'sleep'],
          // Override the slices we have data for; frontend merges with local mock for the rest
          todayContext: {
            lastNightSleep: sleepSource?.duration,
            lastNightHRV: hrvSource,
            hrvBaseline: 62 // TODO: compute from KV history
          },
          sleep: sleepSource ? {
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
          } : null
        };
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
