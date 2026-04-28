// GET /api/health?days=14 — wearable / HealthKit data subset
// Sleep, HRV, heart rate, recovery
// Same proxy pattern as /api/snapshot

export default async function handler(req, res) {
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;
  const days = req.query.days || '14';

  if (!apiBase || !apiKey) {
    res.status(503).json({
      error: 'Backend not configured',
      _source: 'not-configured'
    });
    return;
  }

  try {
    const upstream = await fetch(`${apiBase}/health/recent?days=${encodeURIComponent(days)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
    });

    if (!upstream.ok) {
      res.status(502).json({
        error: `Upstream returned ${upstream.status}`,
        _source: 'upstream-error'
      });
      return;
    }

    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json({ ...data, _source: 'live', _generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: err.message, _source: 'upstream-fetch-failed' });
  }
}
