// GET /api/snapshot — composite endpoint, primary on-load fetch
// Proxies to ${MANA_API_BASE}/today/snapshot with bearer token.
// When env vars unset, returns 503 (frontend falls back to local mock silently).
// When upstream fails, returns 502 (frontend falls back + shows visible error banner).

export default async function handler(req, res) {
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;

  if (!apiBase || !apiKey) {
    res.status(503).json({
      error: 'Backend not configured',
      hint: 'Set MANA_API_BASE and MANA_API_KEY in Vercel env vars to enable live data',
      _source: 'not-configured'
    });
    return;
  }

  try {
    const upstream = await fetch(`${apiBase}/today/snapshot`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '(no body)');
      res.status(502).json({
        error: `Upstream returned ${upstream.status}`,
        upstreamBody: errBody.slice(0, 300),
        _source: 'upstream-error'
      });
      return;
    }

    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json({
      ...data,
      _source: 'live',
      _generatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({
      error: err.message,
      _source: 'upstream-fetch-failed'
    });
  }
}
