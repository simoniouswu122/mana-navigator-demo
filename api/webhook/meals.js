// POST /api/webhook/meals?secret=<MEALS_WEBHOOK_SECRET>
//
// Receiver for mana-app-server's meal events. Stores meals in KV by date.
//
// Expected payload (sent by mana-app-server NavigatorWebhookListener):
// {
//   "event": "meal.saved" | "meal.deleted" | "meal.backfill",
//   "timestamp": "2026-04-30T08:30:00Z",        // event time
//   "userId": "<mana uid>",                      // currently always Simon
//   "meals": [                                   // 1+ for saved/backfill, 0+ for deleted (then use ids)
//     {
//       "id": 12345,                              // mealHistoryId from UserMealHistory
//       "dateTime": "2026-04-30T13:10:00+0800",   // when the meal happened
//       "description": "牛肉面 (外食)",            // user-readable summary
//       "calories": 850,                          // totalCalories
//       "protein": 38.0,                          // totalProteinG
//       "carbs": 95.0,                            // totalCarbohydrateG
//       "fat": 22.0,                              // totalFatG
//       "fiber": 4.0,                             // totalFiberG
//       "score": 7.2,                             // mana score
//       "picUrl": ["https://..."],
//       "dishes": ["牛肉面", "卤蛋"]              // optional, dish names
//     }
//   ],
//   "deletedIds": [12345]                        // only for "meal.deleted"
// }
//
// Required env vars:
//   MEALS_WEBHOOK_SECRET   — random string, must match `?secret=`
//   KV_REST_API_URL/TOKEN  — Upstash KV (already set for wearable webhook)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

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
  globalThis._kvUrl = kvUrl;
  globalThis._kvToken = kvToken;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = body?.event || 'meal.saved';
    const meals = Array.isArray(body?.meals) ? body.meals : [];
    const deletedIds = Array.isArray(body?.deletedIds) ? body.deletedIds : [];

    // Group meals by date (YYYY-MM-DD from dateTime), then upsert into KV
    const byDate = {};
    for (const m of meals) {
      if (!m?.dateTime) continue;
      const dateKey = String(m.dateTime).slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(normalizeMeal(m));
    }

    const datesTouched = [];
    for (const [date, newMeals] of Object.entries(byDate)) {
      const key = `health:simon:meals:${date}`;
      const existing = (await kvGet(key)) || { meals: [] };
      // Upsert by id — newer payload wins
      const byId = new Map((existing.meals || []).map(m => [String(m.id), m]));
      for (const m of newMeals) byId.set(String(m.id), m);
      // Sort by dateTime ascending
      const merged = [...byId.values()].sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)));
      await kvSet(key, {
        meals: merged,
        _lastUpdated: new Date().toISOString()
      });
      datesTouched.push({ date, count: merged.length });
    }

    // Handle deletes — remove by id from any date that contains them
    if (event === 'meal.deleted' && deletedIds.length) {
      const dates = await listMealDates();
      for (const date of dates) {
        const key = `health:simon:meals:${date}`;
        const day = await kvGet(key);
        if (!day?.meals) continue;
        const before = day.meals.length;
        const after = day.meals.filter(m => !deletedIds.includes(m.id));
        if (after.length !== before) {
          await kvSet(key, { meals: after, _lastUpdated: new Date().toISOString() });
          datesTouched.push({ date, count: after.length, deleted: before - after.length });
        }
      }
    }

    await kvSet('health:simon:meals:_meta', {
      lastSyncAt: new Date().toISOString(),
      lastEvent: event,
      lastBatchSize: meals.length,
      datesUpdated: Object.keys(byDate),
      deletedIds
    });
    const rawSnippet = JSON.stringify(body).slice(0, 5000);
    await kvSet('health:simon:meals:_lastPayload', {
      receivedAt: new Date().toISOString(),
      snippet: rawSnippet
    });

    return res.status(200).json({
      ok: true,
      received: { event, meals: meals.length, deleted: deletedIds.length },
      stored: datesTouched
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 500) });
  }
}

function normalizeMeal(m) {
  return {
    id: m.id,
    dateTime: m.dateTime,
    description: m.description || m.summary || '',
    calories: numberOrNull(m.calories),
    protein: numberOrNull(m.protein),
    carbs: numberOrNull(m.carbs),
    fat: numberOrNull(m.fat),
    fiber: numberOrNull(m.fiber),
    score: numberOrNull(m.score),
    picUrl: Array.isArray(m.picUrl) ? m.picUrl : [],
    dishes: Array.isArray(m.dishes) ? m.dishes : [],
    type: classifyMealType(m.dateTime),
    receivedAt: new Date().toISOString()
  };
}

function numberOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Simple buckets so frontend can group by meal type without new server logic
function classifyMealType(dateTime) {
  if (!dateTime) return 'other';
  const hour = parseInt(String(dateTime).slice(11, 13), 10);
  if (Number.isNaN(hour)) return 'other';
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 18) return 'snack';
  if (hour < 23) return 'dinner';
  return 'late';
}

async function listMealDates() {
  // KV REST scan — list all keys under the meals namespace, then strip prefix
  const { url, token } = getKVCreds();
  const r = await fetch(`${url}/keys/health:simon:meals:*`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return [];
  const data = await r.json();
  const keys = data?.result || [];
  return keys
    .map(k => k.replace(/^health:simon:meals:/, ''))
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  return r.ok;
}
