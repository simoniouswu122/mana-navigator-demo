// GET /api/meals?limit=10 — Mana food data
// Recent meals (photos + macros) from food-print-analysis pipeline
// Same proxy pattern as /api/snapshot

export default async function handler(req, res) {
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;
  const limit = req.query.limit || '10';

  if (!apiBase || !apiKey) {
    res.status(503).json({
      error: 'Backend not configured',
      _source: 'not-configured'
    });
    return;
  }

  try {
    const upstream = await fetch(`${apiBase}/meals/recent?limit=${encodeURIComponent(limit)}`, {
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
