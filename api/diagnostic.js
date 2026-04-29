// GET /api/diagnostic
// Public endpoint that reports which env var KEYS are set (not values).
// Safe to expose — only shows existence of credentials, not the credentials.

export default async function handler(req, res) {
  const interesting = Object.keys(process.env)
    .filter(k =>
      k.startsWith('KV_') ||
      k.startsWith('UPSTASH_') ||
      k.startsWith('REDIS_') ||
      k.startsWith('STORAGE_') ||
      k.startsWith('HEALTH_') ||
      k.startsWith('MANA_') ||
      k.startsWith('ANTHROPIC_')
    )
    .sort();

  // Try a small KV ping to confirm connectivity
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  let kvPing = 'no-kv-creds';
  if (kvUrl && kvToken) {
    try {
      const r = await fetch(`${kvUrl}/ping`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      kvPing = r.ok ? 'ok' : `http-${r.status}`;
    } catch (err) {
      kvPing = 'error: ' + err.message.slice(0, 100);
    }
  }

  res.status(200).json({
    deploymentTime: new Date().toISOString(),
    envKeysDetected: interesting,
    counts: {
      KV_: interesting.filter(k => k.startsWith('KV_')).length,
      UPSTASH_: interesting.filter(k => k.startsWith('UPSTASH_')).length,
      REDIS_: interesting.filter(k => k.startsWith('REDIS_')).length,
      HEALTH_: interesting.filter(k => k.startsWith('HEALTH_')).length,
      MANA_: interesting.filter(k => k.startsWith('MANA_')).length
    },
    kvCredsResolved: !!(kvUrl && kvToken),
    kvPing,
    nodeVersion: process.version
  });
}
