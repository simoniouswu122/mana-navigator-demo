// POST /api/webhook/health-auto-export?secret=<HEALTH_WEBHOOK_SECRET>
//
// Receiver for Health Auto Export iOS app (Premium feature: REST API export).
// Stores extracted metrics in Vercel KV by date.
//
// Required env vars:
//   HEALTH_WEBHOOK_SECRET    — random string, must match `?secret=` query param
//   KV_REST_API_URL          — auto-set when you create Vercel KV + connect project
//   KV_REST_API_TOKEN        — auto-set when you create Vercel KV + connect project

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  // Verify secret
  const expectedSecret = process.env.HEALTH_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ error: 'HEALTH_WEBHOOK_SECRET not configured' });
  }
  if (req.query.secret !== expectedSecret) {
    return res.status(401).json({ error: 'invalid secret' });
  }

  // Verify KV/Redis configured (accept either Vercel KV or Upstash naming)
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    return res.status(503).json({ error: 'KV/Redis not configured (set up Upstash via Vercel Storage in dashboard)' });
  }
  // Make available to helpers below
  globalThis._kvUrl = kvUrl;
  globalThis._kvToken = kvToken;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Health Auto Export sends shape: { data: { metrics: [...], workouts: [...] } }
    const metrics = body?.data?.metrics || [];
    const workouts = body?.data?.workouts || [];

    // Group by date
    const byDate = {};

    for (const m of metrics) {
      const name = m.name;
      const data = m.data || [];

      for (const point of data) {
        const dateStr = pickDate(point);
        if (!dateStr) continue;
        const dateKey = dateStr.slice(0, 10); // YYYY-MM-DD
        if (!byDate[dateKey]) byDate[dateKey] = {};
        applyMetric(byDate[dateKey], name, point);
      }
    }

    // Also process workouts
    for (const w of workouts) {
      const dateStr = pickDate(w);
      if (!dateStr) continue;
      const dateKey = dateStr.slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = {};
      if (!byDate[dateKey].workouts) byDate[dateKey].workouts = [];
      byDate[dateKey].workouts.push({
        type: w.name || w.type,
        duration: w.duration,
        calories: w.totalEnergyBurned || w.activeEnergyBurned,
        start: w.start || w.startDate,
        end: w.end || w.endDate
      });
    }

    // Upsert each date into KV
    const stored = [];
    for (const [date, data] of Object.entries(byDate)) {
      const key = `health:simon:daily:${date}`;
      // Merge with existing data at this key
      const existing = await kvGet(key);
      const merged = { ...existing, ...data, _lastUpdated: new Date().toISOString() };
      await kvSet(key, merged);
      stored.push({ date, fields: Object.keys(data) });
    }

    // Track latest sync timestamp + last raw payload (for debugging)
    await kvSet('health:simon:_meta', {
      lastSyncAt: new Date().toISOString(),
      lastBatchSize: metrics.length + workouts.length,
      datesUpdated: Object.keys(byDate),
      metricNamesReceived: [...new Set(metrics.map(m => m.name))],
      bodyShape: {
        hasData: !!body?.data,
        hasMetrics: Array.isArray(metrics),
        metricsCount: metrics.length,
        workoutsCount: workouts.length,
        topLevelKeys: Object.keys(body || {})
      }
    });
    // Keep last raw payload for inspection (capped to first 5KB to avoid blowing up KV)
    const rawSnippet = JSON.stringify(body).slice(0, 5000);
    await kvSet('health:simon:_lastPayload', { receivedAt: new Date().toISOString(), snippet: rawSnippet });

    return res.status(200).json({
      ok: true,
      received: { metrics: metrics.length, workouts: workouts.length },
      stored
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 500) });
  }
}

// ===== helpers =====

function pickDate(point) {
  return point.date || point.startDate || point.start || point.endDate || point.end;
}

function applyMetric(target, name, point) {
  // Be lenient — match against any name containing the keyword
  const qty = point.qty ?? point.value ?? point.Avg ?? point.avg;
  const n = name.toLowerCase();

  if (n.includes('heart_rate_variability') || n.includes('hrv')) {
    // Use latest non-null value if multiple points
    if (qty != null) target.hrv = qty;
    target.hrvUnit = 'ms';
  } else if (n.includes('resting_heart_rate')) {
    if (qty != null) target.restingHR = qty;
  } else if (n.includes('heart_rate')) {
    if (qty != null) target.heartRate = qty;
  } else if (n.includes('sleep')) {
    target.sleep = {
      duration: point.asleep ?? point.totalSleep ?? point.value ?? point.qty,
      deep: point.deep,
      rem: point.rem,
      light: point.core ?? point.light,
      awake: point.awake,
      inBed: point.inBed,
      bedTime: point.startDate ?? point.start ?? point.sleepStart,
      wakeTime: point.endDate ?? point.end ?? point.sleepEnd,
      source: point.source
    };
  } else if (n.includes('body_mass') || n === 'weight' || n.includes('weight_body')) {
    if (qty != null) {
      target.weight = qty;
      target.weightUnit = 'kg';
    }
  } else if (n.includes('body_fat')) {
    if (qty != null) target.bodyFat = qty;
  } else if (n.includes('lean_body_mass') || n.includes('lean_mass')) {
    if (qty != null) target.leanMass = qty;
  } else if (n.includes('active_energy')) {
    target.activeEnergy = (target.activeEnergy || 0) + (qty || 0);
  } else if (n.includes('basal_energy')) {
    target.basalEnergy = (target.basalEnergy || 0) + (qty || 0);
  } else if (n.includes('step_count') || n === 'steps') {
    target.steps = (target.steps || 0) + (qty || 0);
  } else if (n.includes('exercise_time')) {
    target.exerciseMinutes = (target.exerciseMinutes || 0) + (qty || 0);
  } else if (n.includes('respiratory')) {
    if (qty != null) target.respiratoryRate = qty;
  } else if (n.includes('oxygen_saturation') || n.includes('spo2')) {
    if (qty != null) target.spo2 = qty;
  } else {
    // Unknown — capture raw for debugging
    if (!target._raw) target._raw = {};
    target._raw[name] = qty;
  }
}

function getKVCreds() {
  return {
    url: globalThis._kvUrl || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: globalThis._kvToken || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  };
}

async function kvGet(key) {
  const { url, token } = getKVCreds();
  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.result) return null;
  try { return typeof data.result === 'string' ? JSON.parse(data.result) : data.result; }
  catch { return null; }
}

async function kvSet(key, value) {
  const { url, token } = getKVCreds();
  const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  return r.ok;
}
