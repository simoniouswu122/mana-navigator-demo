// GET /api/webhook/status?secret=<HEALTH_WEBHOOK_SECRET>
// Debug endpoint — shows what's in KV right now, when it was last synced.

export default async function handler(req, res) {
  const expectedSecret = process.env.HEALTH_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ error: 'HEALTH_WEBHOOK_SECRET not configured' });
  }
  if (req.query.secret !== expectedSecret) {
    return res.status(401).json({ error: 'invalid secret' });
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({
      error: 'KV/Redis not configured',
      hint: 'In Vercel dashboard: Storage → Marketplace → Upstash → Connect project',
      detected_env_keys: Object.keys(process.env).filter(k => k.startsWith('KV_') || k.startsWith('UPSTASH_'))
    });
  }

  try {
    // Read meta + last raw payload + last 14 days
    const meta = await kvGet('health:simon:_meta');
    const lastPayload = await kvGet('health:simon:_lastPayload');
    const today = new Date();
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const data = await kvGet(`health:simon:daily:${dateKey}`);
      if (data) {
        days.push({
          date: dateKey,
          fields: Object.keys(data).filter(k => !k.startsWith('_')),
          summary: {
            hrv: data.hrv,
            sleep_h: data.sleep?.duration,
            weight: data.weight,
            bodyFat: data.bodyFat,
            steps: data.steps
          },
          lastUpdated: data._lastUpdated
        });
      }
    }

    return res.status(200).json({
      ok: true,
      meta: meta || null,
      lastPayloadReceivedAt: lastPayload?.receivedAt || null,
      lastPayloadSnippet: lastPayload?.snippet ? lastPayload.snippet.slice(0, 800) : null,
      daysWithData: days.length,
      days,
      _generatedAt: new Date().toISOString(),
      _kvSource: process.env.KV_REST_API_URL ? 'KV_*' : 'UPSTASH_*'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.result) return null;
  try { return typeof data.result === 'string' ? JSON.parse(data.result) : data.result; }
  catch { return null; }
}
