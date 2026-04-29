// GET /api/health?days=14
//
// Reads from Vercel KV (populated by Health Auto Export webhook).
// Falls back to upstream MANA_API_BASE if configured (v0.2.4+).
// Returns 503 (not-configured) if neither — frontend uses local mock.

export default async function handler(req, res) {
  const days = parseInt(req.query.days || '14', 10);
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Path 1: full upstream backend (v0.2.4+)
  if (apiBase && apiKey) {
    try {
      const upstream = await fetch(`${apiBase}/health/recent?days=${days}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
      });
      if (upstream.ok) {
        const data = await upstream.json();
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json({ ...data, _source: 'live', _generatedAt: new Date().toISOString() });
      }
      // upstream failed — fall through to KV / mock
    } catch (err) { /* fall through */ }
  }

  // Path 2: Vercel KV (v0.2.2)
  if (kvUrl && kvToken) {
    try {
      const today = new Date();
      const dayData = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        const dateKey = d.toISOString().slice(0, 10);
        const data = await kvGet(`health:simon:daily:${dateKey}`, kvUrl, kvToken);
        if (data) dayData.push({ date: dateKey, ...data });
      }

      if (dayData.length > 0) {
        const latest = dayData[0];
        const out = {
          lastNight: latest.sleep ? {
            duration: latest.sleep.duration,
            target: 8,
            bedTime: latest.sleep.bedTime,
            wakeTime: latest.sleep.wakeTime,
            stages: { deep: latest.sleep.deep, rem: latest.sleep.rem, light: latest.sleep.light },
            hrv: latest.hrv,
            restingHR: latest.restingHR,
            quality: latest.sleep.duration ? Math.round(Math.min(100, latest.sleep.duration / 8 * 90 + (latest.hrv ? 10 : 0))) : null
          } : null,
          weekSleep: dayData.slice(0, 7).map(d => ({
            day: d.date,
            duration: d.sleep?.duration,
            quality: d.sleep?.duration ? Math.round(Math.min(100, d.sleep.duration / 8 * 90)) : null
          })),
          hrvBaseline: avgRecent(dayData.slice(0, 14).map(d => d.hrv)),
          hrvHistory: dayData.map(d => ({ date: d.date, hrv: d.hrv })).reverse(),
          bodyComp: latest.weight ? {
            weight: latest.weight,
            bodyFat: latest.bodyFat,
            leanMass: latest.leanMass
          } : null,
          _source: 'live-kv',
          _generatedAt: new Date().toISOString(),
          _daysAvailable: dayData.length
        };
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json(out);
      }
    } catch (err) { /* fall through to 503 */ }
  }

  // Path 3: nothing configured
  return res.status(503).json({
    error: 'Backend not configured',
    hint: 'Set up Vercel KV + Health Auto Export webhook (see DESIGN-v0.2.md)',
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

function avgRecent(values) {
  const valid = values.filter(v => typeof v === 'number');
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}
