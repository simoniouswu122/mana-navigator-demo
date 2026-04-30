// GET /api/snapshot
//
// Composite endpoint. Tries 3 sources in order:
//   1. Full upstream backend (MANA_API_BASE) — v0.2.4+
//   2. Vercel KV with Health Auto Export data — v0.2.2
//   3. 503 (frontend uses local mock) — v0.2.1 default

export default async function handler(req, res) {
  const apiBase = process.env.MANA_API_BASE;
  const apiKey = process.env.MANA_API_KEY;
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Path 1: full upstream
  if (apiBase && apiKey) {
    try {
      const upstream = await fetch(`${apiBase}/today/snapshot`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
      });
      if (upstream.ok) {
        const data = await upstream.json();
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json({ ...data, _source: 'live', _generatedAt: new Date().toISOString() });
      }
    } catch (err) { /* fall through */ }
  }

  // Path 2: KV partial — health-only
  if (kvUrl && kvToken) {
    try {
      const meta = await kvGet('health:simon:_meta', kvUrl, kvToken);
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const todayData = await kvGet(`health:simon:daily:${todayKey}`, kvUrl, kvToken);
      const yesterdayKey = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      const yesterdayData = await kvGet(`health:simon:daily:${yesterdayKey}`, kvUrl, kvToken);

      const sleepSource = yesterdayData?.sleep || todayData?.sleep;
      const sleepSyncedAt = (yesterdayData?.sleep ? yesterdayData?._lastUpdated : todayData?._lastUpdated);
      const hrvSource = todayData?.hrv ?? yesterdayData?.hrv;
      const hrvSyncedAt = (todayData?.hrv != null ? todayData?._lastUpdated : yesterdayData?._lastUpdated);
      // Latest weight = scan today first, then walk back up to 14 days
      let weightPoint = null;
      let weightDate = null;
      let weightSyncedAt = null;
      const weightCandidates = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        const dk = d.toISOString().slice(0, 10);
        const dat = i === 0 ? todayData : (i === 1 ? yesterdayData : await kvGet(`health:simon:daily:${dk}`, kvUrl, kvToken));
        if (dat?.weight != null) {
          weightCandidates.push({ date: dk, value: dat.weight });
          if (!weightPoint) {
            weightPoint = dat.weight;
            weightDate = dk;
            weightSyncedAt = dat._lastUpdated;
          }
        }
      }
      const bodyFatPoint = todayData?.bodyFat ?? yesterdayData?.bodyFat;
      const bodyFatSyncedAt = (todayData?.bodyFat != null ? todayData?._lastUpdated : yesterdayData?._lastUpdated);
      const leanMassPoint = todayData?.leanMass ?? yesterdayData?.leanMass;
      const leanMassSyncedAt = (todayData?.leanMass != null ? todayData?._lastUpdated : yesterdayData?._lastUpdated);
      const stepsToday = todayData?.steps;
      const activeEnergyToday = todayData?.activeEnergy;
      const workoutsToday = todayData?.workouts || [];

      // Meals — last 7 days from KV (separate namespace pushed by mana-app-server)
      const mealsByDate = {};
      let mealsSyncedAt = null;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        const dk = d.toISOString().slice(0, 10);
        const dat = await kvGet(`health:simon:meals:${dk}`, kvUrl, kvToken);
        if (dat?.meals?.length) {
          mealsByDate[dk] = dat.meals;
          if (!mealsSyncedAt || (dat._lastUpdated && dat._lastUpdated > mealsSyncedAt)) {
            mealsSyncedAt = dat._lastUpdated;
          }
        }
      }
      const todayMeals = mealsByDate[todayKey] || [];
      const yesterdayMeals = mealsByDate[yesterdayKey] || [];
      const todayTotals = todayMeals.reduce((acc, m) => {
        acc.calories += m.calories || 0;
        acc.protein += m.protein || 0;
        acc.carbs += m.carbs || 0;
        acc.fat += m.fat || 0;
        acc.fiber += m.fiber || 0;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

      const hasAnyData = sleepSource || hrvSource || weightPoint || stepsToday != null || workoutsToday.length || Object.keys(mealsByDate).length > 0;
      if (hasAnyData) {
        const liveFields = [];
        const partial = {
          _source: 'live-kv',
          _generatedAt: new Date().toISOString(),
          _lastSyncAt: meta?.lastSyncAt || null,
        };

        if (sleepSource || hrvSource) {
          liveFields.push('todayContext', 'sleep');
          partial.todayContext = {
            lastNightSleep: sleepSource?.duration,
            lastNightHRV: hrvSource,
            hrvBaseline: 62
          };
          partial.sleep = sleepSource ? {
            lastNight: {
              duration: sleepSource.duration,
              target: 8,
              bedTime: sleepSource.bedTime,
              wakeTime: sleepSource.wakeTime,
              quality: sleepSource.duration ? Math.round(Math.min(100, sleepSource.duration / 8 * 90)) : null,
              stages: { deep: sleepSource.deep, rem: sleepSource.rem, light: sleepSource.light },
              hrv: hrvSource,
              restingHR: yesterdayData?.restingHR ?? todayData?.restingHR,
              syncedAt: sleepSyncedAt
            },
            _hrvSyncedAt: hrvSyncedAt
          } : null;
        }

        if (weightPoint != null || bodyFatPoint != null || leanMassPoint != null) {
          liveFields.push('body');
          partial.body = {
            weight: weightPoint != null ? { current: weightPoint, unit: 'kg', measuredOn: weightDate, syncedAt: weightSyncedAt, history: weightCandidates.slice(0, 8).reverse().map(c => c.value) } : null,
            bodyFat: bodyFatPoint != null ? { current: bodyFatPoint, unit: '%', syncedAt: bodyFatSyncedAt } : null,
            leanMass: leanMassPoint != null ? { current: leanMassPoint, unit: 'kg', syncedAt: leanMassSyncedAt } : null
          };
        }

        if (workoutsToday.length || stepsToday != null || activeEnergyToday != null) {
          liveFields.push('activity');
          partial.activity = {
            workouts: workoutsToday,
            steps: stepsToday,
            activeEnergy: activeEnergyToday
          };
        }

        if (Object.keys(mealsByDate).length > 0) {
          liveFields.push('diet');
          // Build a flat recent list (today + yesterday), most-recent first, for the Diet tab
          const recent = [];
          for (const m of [...todayMeals].reverse()) recent.push({ ...m, _dayLabel: '今天' });
          for (const m of [...yesterdayMeals].reverse()) recent.push({ ...m, _dayLabel: '昨天' });
          // Then older days, just the last 5
          const olderDates = Object.keys(mealsByDate)
            .filter(d => d !== todayKey && d !== yesterdayKey)
            .sort()
            .reverse();
          for (const d of olderDates) {
            for (const m of [...mealsByDate[d]].reverse()) recent.push({ ...m, _dayLabel: d });
          }
          partial.diet = {
            today: {
              meals: todayMeals,
              calories: Math.round(todayTotals.calories),
              protein: Math.round(todayTotals.protein),
              carbs: Math.round(todayTotals.carbs),
              fat: Math.round(todayTotals.fat),
              fiber: Math.round(todayTotals.fiber)
            },
            recent: recent.slice(0, 12),
            syncedAt: mealsSyncedAt
          };
        }

        partial._liveFields = liveFields;
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(200).json(partial);
      }
    } catch (err) { /* fall through */ }
  }

  // Path 3: nothing
  return res.status(503).json({
    error: 'Backend not configured',
    hint: 'Set up Vercel KV + Health Auto Export webhook, or set MANA_API_BASE + MANA_API_KEY',
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
