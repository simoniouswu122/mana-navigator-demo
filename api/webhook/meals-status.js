// GET /api/webhook/meals-status?secret=<MEALS_WEBHOOK_SECRET>
// Debug endpoint — shows what meals are in KV, last sync info.

export default async function handler(req, res) {
  const expectedSecret = process.env.MEALS_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ error: 'MEALS_WEBHOOK_SECRET not configured' });
  }
  if (req.query.secret !== expectedSecret) {
    return res.status(401).json({ error: 'invalid secret' });
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  try {
    const meta = await kvGet('health:simon:meals:_meta', kvUrl, kvToken);
    const lastPayload = await kvGet('health:simon:meals:_lastPayload', kvUrl, kvToken);
    const today = new Date();
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const data = await kvGet(`health:simon:meals:${dateKey}`, kvUrl, kvToken);
      if (data?.meals?.length) {
        const totals = data.meals.reduce((acc, m) => {
          acc.calories += m.calories || 0;
          acc.protein += m.protein || 0;
          return acc;
        }, { calories: 0, protein: 0 });
        days.push({
          date: dateKey,
          mealCount: data.meals.length,
          totals: { calories: Math.round(totals.calories), protein: Math.round(totals.protein) },
          lastUpdated: data._lastUpdated,
          meals: data.meals.map(m => ({
            id: m.id, time: m.dateTime?.slice(11, 16), description: m.description,
            calories: m.calories, protein: m.protein, type: m.type
          }))
        });
      }
    }

    return res.status(200).json({
      ok: true,
      meta: meta || null,
      lastPayloadReceivedAt: lastPayload?.receivedAt || null,
      lastPayloadSnippet: lastPayload?.snippet?.slice(0, 800) || null,
      daysWithMeals: days.length,
      days,
      _generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
