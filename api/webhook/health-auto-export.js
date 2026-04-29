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

  // Verify KV configured
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured (set up Vercel KV in dashboard)' });
  }

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

    // Track latest sync timestamp
    await kvSet('health:simon:_meta', {
      lastSyncAt: new Date().toISOString(),
      lastBatchSize: metrics.length + workouts.length,
      datesUpdated: Object.keys(byDate)
    });

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
  // Map Health Auto Export metric names to our schema
  const qty = point.qty ?? point.value;
  switch (name) {
    case 'heart_rate_variability_sdnn':
      target.hrv = qty;
      target.hrvUnit = 'ms';
      break;
    case 'resting_heart_rate':
      target.restingHR = qty;
      break;
    case 'heart_rate':
      // Can be many points per day; keep latest
      target.heartRate = qty;
      break;
    case 'sleep_analysis':
      target.sleep = {
        duration: point.asleep ?? point.totalSleep ?? point.value,
        deep: point.deep,
        rem: point.rem,
        light: point.core ?? point.light,
        awake: point.awake,
        inBed: point.inBed,
        bedTime: point.startDate ?? point.start,
        wakeTime: point.endDate ?? point.end,
        source: point.source
      };
      break;
    case 'body_mass':
    case 'weight':
      target.weight = qty;
      target.weightUnit = 'kg';
      break;
    case 'body_fat_percentage':
      target.bodyFat = qty;
      break;
    case 'lean_body_mass':
      target.leanMass = qty;
      break;
    case 'active_energy':
      target.activeEnergy = (target.activeEnergy || 0) + qty;
      break;
    case 'basal_energy_burned':
      target.basalEnergy = (target.basalEnergy || 0) + qty;
      break;
    case 'step_count':
      target.steps = (target.steps || 0) + qty;
      break;
    case 'apple_exercise_time':
      target.exerciseMinutes = (target.exerciseMinutes || 0) + qty;
      break;
    case 'respiratory_rate':
      target.respiratoryRate = qty;
      break;
    case 'oxygen_saturation':
      target.spo2 = qty;
      break;
    default:
      // Capture unknown metrics raw, in case useful later
      if (!target._raw) target._raw = {};
      target._raw[name] = qty;
  }
}

async function kvGet(key) {
  const r = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.result) return null;
  try { return typeof data.result === 'string' ? JSON.parse(data.result) : data.result; }
  catch { return null; }
}

async function kvSet(key, value) {
  const r = await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  return r.ok;
}
