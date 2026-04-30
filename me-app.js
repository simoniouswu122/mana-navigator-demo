// Simon's personal Mana experience · v0.2.1
// Live data fetch + mock fallback + badge + error banner

let currentTab = 'today';
let chatMessages = [];
let chartsRendered = {};
let proposedChanges = null; // staged changes awaiting user confirm
let dataSource = 'unknown'; // 'live' | 'demo' | 'demo-error' | 'unknown'
let dataSourceDetail = {};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  await loadProfile();
  renderTopStatus();
  renderTodayTab();
  renderDietTab();
  renderExerciseTab();
  renderSleepTab();
  switchTab('today');
});

// ========== LIVE DATA FETCH ==========
async function loadProfile() {
  try {
    const resp = await fetch('/api/snapshot');
    const data = await resp.json();

    if (resp.ok && data._source === 'live') {
      // Full live: replace SIMON properties wholesale
      Object.assign(SIMON, data);
      setDataSource('live', { generatedAt: data._generatedAt, fields: 'all' });
      hideBanner();
      return;
    }

    if (resp.ok && data._source === 'live-kv') {
      // Partial live (KV-backed health data only) — merge into existing SIMON
      mergeLiveKV(data);
      setDataSource('live-partial', {
        generatedAt: data._generatedAt,
        fields: data._liveFields || []
      });
      hideBanner();
      return;
    }

    if (data._source === 'not-configured' || resp.status === 503) {
      setDataSource('demo', { reason: data.hint || '尚未连接 live 数据' });
      hideBanner();
      return;
    }

    setDataSource('demo-error', {
      reason: data.error || '上游异常',
      detail: data.upstreamBody || ''
    });
    showBanner('Live data 后端不可达', data.error || '已自动切回 demo 数据');
  } catch (err) {
    setDataSource('demo-error', { reason: err.message });
    showBanner('无法连接到 /api/snapshot', err.message);
  }
}

// Merge KV partial data into local SIMON (only the fields we have real data for)
function mergeLiveKV(data) {
  if (data.todayContext) {
    if (data.todayContext.lastNightSleep != null) SIMON.todayContext.lastNightSleep = data.todayContext.lastNightSleep;
    if (data.todayContext.lastNightHRV != null) SIMON.todayContext.lastNightHRV = data.todayContext.lastNightHRV;
    if (data.todayContext.hrvBaseline != null) SIMON.todayContext.hrvBaseline = data.todayContext.hrvBaseline;
  }
  if (data.sleep?.lastNight) {
    SIMON.sleep.lastNight = { ...SIMON.sleep.lastNight, ...data.sleep.lastNight };
  }
  // Body composition — replace current values when wearable/scale data exists
  if (data.body) {
    if (data.body.weight?.current != null) {
      SIMON.body.weight.current = data.body.weight.current;
      if (Array.isArray(data.body.weight.history) && data.body.weight.history.length) {
        SIMON.body.weight.history = data.body.weight.history;
      }
      SIMON.body.weight._measuredOn = data.body.weight.measuredOn;
      SIMON.body.weight._isLive = true;
    }
    if (data.body.bodyFat?.current != null) {
      SIMON.body.bodyFat.current = data.body.bodyFat.current;
      SIMON.body.bodyFat._isLive = true;
    }
    if (data.body.leanMass?.current != null) {
      SIMON.body.leanMass.current = data.body.leanMass.current;
      SIMON.body.leanMass._isLive = true;
    }
  }
  // Activity — today's workout + steps + active energy from wearable
  if (data.activity) {
    if (Array.isArray(data.activity.workouts) && data.activity.workouts.length) {
      const w = data.activity.workouts[0];
      SIMON.exercise.today._liveWorkout = {
        type: w.type,
        duration: w.duration,
        calories: w.calories,
        distance: w.distance,
        avgHR: w.avgHR,
        maxHR: w.maxHR,
        source: w.source
      };
    }
    if (data.activity.steps != null) SIMON.todayContext.todaySteps = data.activity.steps;
    if (data.activity.activeEnergy != null) SIMON.todayContext.todayActiveEnergy = data.activity.activeEnergy;
  }
}

function setDataSource(source, detail) {
  dataSource = source;
  dataSourceDetail = detail || {};

  const badge = document.getElementById('dataSourceBadge');
  const dot = document.getElementById('dataSourceDot');
  const label = document.getElementById('dataSourceLabel');
  if (!badge) return;

  switch (source) {
    case 'live':
      badge.className = 'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border bg-emerald-50 border-emerald-200 text-emerald-800';
      dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
      label.textContent = 'Live';
      break;
    case 'live-partial':
      badge.className = 'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border bg-emerald-50 border-emerald-200 text-emerald-800';
      dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
      label.textContent = 'Live · 部分';
      break;
    case 'demo':
      badge.className = 'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border bg-amber-50 border-amber-200 text-amber-800';
      dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500';
      label.textContent = 'Demo';
      break;
    case 'demo-error':
      badge.className = 'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border bg-red-50 border-red-300 text-red-800';
      dot.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
      label.textContent = 'Demo · 离线';
      break;
    default:
      label.textContent = '检测中...';
  }
}

function showBanner(title, detail) {
  document.getElementById('errorBannerTitle').textContent = title;
  document.getElementById('errorBannerDetail').textContent = detail || '';
  document.getElementById('errorBanner').classList.remove('hidden');
}

function hideBanner() {
  document.getElementById('errorBanner').classList.add('hidden');
}

function dismissBanner() { hideBanner(); }

async function retryFetch() {
  showBanner('正在重试...', '');
  await loadProfile();
  // Re-render top status (data may have changed)
  renderTopStatus();
}

function showDataSourceInfo() {
  const body = document.getElementById('dataSourceModalBody');
  let html = '';
  if (dataSource === 'live') {
    html = `
      <div class="flex items-center gap-2 text-emerald-700 font-semibold"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>Live · 来自后端</span></div>
      <div class="text-stone-600">数据从 Mana 后端实时拉取 (经 Vercel proxy)</div>
      ${dataSourceDetail.generatedAt ? `<div class="text-xs text-stone-500">最后更新: ${new Date(dataSourceDetail.generatedAt).toLocaleString('zh-CN')}</div>` : ''}
    `;
  } else if (dataSource === 'demo') {
    html = `
      <div class="flex items-center gap-2 text-amber-700 font-semibold"><span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Demo · 演示数据</span></div>
      <div class="text-stone-600">后端 env vars 未配置, 使用本地 demo 数据.</div>
      ${dataSourceDetail.reason ? `<div class="text-xs text-stone-500 bg-stone-50 p-2 rounded">${dataSourceDetail.reason}</div>` : ''}
    `;
  } else if (dataSource === 'demo-error') {
    html = `
      <div class="flex items-center gap-2 text-red-700 font-semibold"><span class="w-2 h-2 rounded-full bg-red-500"></span><span>Demo · 离线 (后端不可达)</span></div>
      <div class="text-stone-600">后端 env vars 已配置, 但上游 fetch 失败. 已切回 demo 数据.</div>
      ${dataSourceDetail.reason ? `<div class="text-xs text-red-700 bg-red-50 p-2 rounded">${dataSourceDetail.reason}</div>` : ''}
      <button onclick="retryFetch();closeDataSourceModal()" class="mt-2 px-3 py-1.5 bg-stone-900 text-white text-xs font-semibold rounded">重试 fetch</button>
    `;
  } else {
    html = `<div class="text-stone-600">检测中...</div>`;
  }
  body.innerHTML = html;
  document.getElementById('dataSourceModal').classList.remove('hidden');
}

function closeDataSourceModal() {
  document.getElementById('dataSourceModal').classList.add('hidden');
}

// ========== TOP STATUS (compliance + outcome + streak) ==========
function renderTopStatus() {
  const c = computeCompliance();
  document.getElementById('complianceScore').textContent = c.overall;
  document.getElementById('complianceMeta').textContent =
    `蛋白 ${c.proteinPct}% · 训练 ${c.trainingPct}% · 睡眠 ${c.sleepPct}%`;

  const o = computeOutcomeProgress();
  document.getElementById('outcomePct').textContent = o.pct;
  document.getElementById('outcomeMeta').textContent = `已掉 ${o.currentLoss}/${o.targetLoss} kg · ${o.weeksLeft} 周还有`;

  // Drilldown minis
  document.getElementById('dietMini').textContent = `${SIMON.diet.today.calories} / ${SIMON.diet.targetCalories} 卡`;
  document.getElementById('exerciseMini').textContent = `今日 ${SIMON.exercise.today.type}`;
  document.getElementById('sleepMini').textContent = `昨晚 ${SIMON.sleep.lastNight.duration}h · 质量 ${SIMON.sleep.lastNight.quality}`;
  document.getElementById('progressMini').textContent = `${o.weeksDone}/${o.weeksTotal} 周 · ${o.pct}%`;
}

function showComplianceBreakdown() {
  const c = computeCompliance();
  const html = c.breakdown.map(b => {
    const color = b.pct >= 80 ? 'emerald' : b.pct >= 50 ? 'amber' : 'red';
    return `
      <div>
        <div class="flex items-baseline justify-between mb-1">
          <span class="text-sm font-semibold">${b.label}</span>
          <span class="text-xs text-stone-500">${typeof b.current === 'number' ? b.current : b.current} ${b.unit ? '/ ' + b.target + b.unit : ''}</span>
        </div>
        <div class="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div class="h-full bg-${color}-500" style="width: ${b.pct}%"></div>
        </div>
        <div class="text-xs text-${color}-600 font-semibold mt-1">${b.pct}%</div>
      </div>
    `;
  }).join('');
  document.getElementById('complianceBreakdown').innerHTML = html;
  document.getElementById('complianceModal').classList.remove('hidden');
}
function closeCompliance() { document.getElementById('complianceModal').classList.add('hidden'); }

// ========== TAB SWITCHING ==========
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.tab === tab) {
      b.classList.add('border-stone-900', 'text-stone-900', 'font-bold');
      b.classList.remove('border-transparent', 'text-stone-500', 'font-medium');
    } else {
      b.classList.add('border-transparent', 'text-stone-500');
      b.classList.remove('border-stone-900', 'text-stone-900', 'font-bold');
    }
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    if (p.id === `tab-${tab}`) { p.classList.remove('hidden'); p.classList.add('fade-in'); }
    else { p.classList.add('hidden'); p.classList.remove('fade-in'); }
  });
  setTimeout(() => renderChartsForTab(tab), 50);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderChartsForTab(tab) {
  if (tab === 'progress') renderProgressCards();  // always re-run, picks up live merges
  if (chartsRendered[tab]) return;
  chartsRendered[tab] = true;
  if (tab === 'diet') renderDietChart();
  if (tab === 'exercise') { renderVolumeChart(); renderHRVChart(); renderStrengthChart(); }
  if (tab === 'sleep') renderSleepChart();
  if (tab === 'progress') renderProgressChart();
}

function renderProgressCards() {
  const w = SIMON.body.weight, bf = SIMON.body.bodyFat, lm = SIMON.body.leanMass;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };
  const show = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); };

  // Weight
  const wCurrent = (typeof w.current === 'number') ? w.current.toFixed(1) : '—';
  set('weightCurrent', wCurrent);
  set('weightCurrent2', wCurrent);
  set('weightStart', w.start?.toFixed(1) ?? '—');
  set('weightTarget', w.target?.toFixed(1) ?? '—');
  if (typeof w.current === 'number' && typeof w.start === 'number' && typeof w.target === 'number') {
    const totalDelta = w.start - w.target;
    const doneDelta = w.start - w.current;
    const pct = totalDelta !== 0 ? Math.round(Math.max(0, Math.min(100, (doneDelta / totalDelta) * 100))) : 0;
    setW('weightBar', pct);
    set('weightProgress', `完成 ${pct}%`);
    const direction = doneDelta >= 0 ? '↓' : '↑';
    set('weightDelta', `${direction} ${Math.abs(doneDelta).toFixed(1)}kg`);
  }
  if (w._isLive) show('weightLiveBadge');

  // Body fat
  const bfCurrent = (typeof bf.current === 'number') ? bf.current.toFixed(1) : '—';
  set('bodyFatCurrent', bfCurrent);
  set('bodyFatCurrent2', bfCurrent);
  set('bodyFatStart', bf.start?.toFixed(1) ?? '—');
  set('bodyFatTarget', bf.target?.toFixed(1) ?? '—');
  if (typeof bf.current === 'number' && typeof bf.start === 'number' && typeof bf.target === 'number') {
    const totalDelta = bf.start - bf.target;
    const doneDelta = bf.start - bf.current;
    const pct = totalDelta !== 0 ? Math.round(Math.max(0, Math.min(100, (doneDelta / totalDelta) * 100))) : 0;
    setW('bodyFatBar', pct);
    set('bodyFatProgress', `完成 ${pct}%`);
    const direction = doneDelta >= 0 ? '↓' : '↑';
    set('bodyFatDelta', `${direction} ${Math.abs(doneDelta).toFixed(1)}%`);
  }
  if (bf._isLive) show('bodyFatLiveBadge');

  // Lean mass (target is to GAIN, so the math flips)
  const lmCurrent = (typeof lm.current === 'number') ? lm.current.toFixed(1) : '—';
  set('leanMassCurrent', lmCurrent);
  set('leanMassCurrent2', lmCurrent);
  set('leanMassStart', lm.start?.toFixed(1) ?? '—');
  set('leanMassTarget', lm.target?.toFixed(1) ?? '—');
  if (typeof lm.current === 'number' && typeof lm.start === 'number' && typeof lm.target === 'number') {
    const totalDelta = lm.target - lm.start;
    const doneDelta = lm.current - lm.start;
    const pct = totalDelta !== 0 ? Math.round(Math.max(0, Math.min(100, (doneDelta / totalDelta) * 100))) : 0;
    setW('leanMassBar', pct);
    const direction = doneDelta >= 0.05 ? '↑' : (doneDelta <= -0.05 ? '↓' : '→');
    const label = direction === '→' ? '持平' : `${direction} ${Math.abs(doneDelta).toFixed(1)}kg`;
    set('leanMassDelta', label);
  }
  if (lm._isLive) show('leanMassLiveBadge');
}

// ========== TODAY TAB ==========
function renderTodayTab() {
  document.getElementById('todayTradeoff').textContent = SIMON.tradeoff;
  renderTimeline();
}

function renderTimeline() {
  const timeline = document.getElementById('todayTimeline');
  timeline.innerHTML = SIMON.schedule.map((item, i) => {
    const stateMarker = renderStateMarker(item);
    const stateBg = item.status === 'drift' ? 'bg-orange-50' :
                    item.status === 'adjusted' ? 'bg-blue-50' :
                    item.status === 'done' ? 'bg-emerald-50/40' : '';
    return `
      <button onclick="showWhy(${i})" class="w-full text-left p-4 hover:bg-stone-50 transition flex items-start gap-4 group ${stateBg}">
        <div class="flex flex-col items-center w-16 flex-shrink-0">
          <div class="text-xs font-semibold text-stone-500">${item.time}</div>
          <div class="text-2xl mt-1">${item.icon}</div>
          <div class="mt-1">${stateMarker}</div>
        </div>
        <div class="flex-1 min-w-0">
          ${renderTimelineItemContent(item)}
        </div>
      </button>
    `;
  }).join('');
}

function renderStateMarker(item) {
  switch (item.status) {
    case 'done': return '<span class="text-xs text-emerald-700 font-semibold">✅</span>';
    case 'drift': return '<span class="text-xs text-orange-700 font-semibold animate-pulse">⚠️</span>';
    case 'upcoming': return '<span class="text-xs text-stone-500 font-semibold">⏳</span>';
    case 'adjusted': return '<span class="text-xs text-blue-700 font-semibold">🔄</span>';
    default: return '';
  }
}

function renderTimelineItemContent(item) {
  if (item.status === 'drift') {
    return `
      <div class="font-semibold text-stone-800 line-through opacity-60">${item.what}</div>
      <div class="text-sm text-stone-500 line-through opacity-60">${item.detail}</div>
      <div class="mt-2 bg-orange-100 border border-orange-200 rounded-lg p-2.5">
        <div class="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-0.5">实际 ${item.actual.time}</div>
        <div class="font-semibold text-sm text-orange-900">${item.actual.what}</div>
        <div class="text-xs text-orange-700 mt-0.5">${item.actual.calories} 大卡 · ${item.actual.protein}g 蛋白 · ${item.actual.drift.complianceNote}</div>
      </div>
    `;
  }
  if (item.status === 'adjusted') {
    return `
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold text-blue-700 uppercase tracking-wider px-1.5 py-0.5 bg-blue-100 rounded">已自动调整</span>
      </div>
      <div class="font-semibold text-stone-800 mt-1">${item.what}</div>
      <div class="text-sm text-stone-500">${item.detail}</div>
      <div class="text-xs text-blue-700 mt-1.5">${item.adjustedFrom.detail} → 现在</div>
      <div class="text-xs text-stone-500 mt-1">${item.adjustedFrom.reason}</div>
    `;
  }
  if (item.status === 'done') {
    return `
      <div class="font-semibold text-stone-800">${item.what}</div>
      ${item.detail ? `<div class="text-sm text-stone-500">${item.detail}</div>` : ''}
      <div class="text-xs text-emerald-700 mt-1">${item.actual.complianceNote}</div>
    `;
  }
  // upcoming
  return `
    <div class="font-semibold ${item.highlight ? 'text-stone-900' : 'text-stone-800'}">${item.what}${item.highlight ? ' <span class="ml-1 inline-block px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded font-semibold">关键节点</span>' : ''}</div>
    ${item.detail ? `<div class="text-sm text-stone-500 mt-0.5">${item.detail}</div>` : ''}
    ${item.countdown ? `<div class="text-xs text-stone-400 mt-1">${item.countdown}</div>` : ''}
  `;
}

function showWhy(index) {
  const item = SIMON.schedule[index];
  if (!item) return;
  document.getElementById('whyTitle').textContent = item.what;
  document.getElementById('whyContent').innerHTML = `<div class="text-base leading-relaxed">${item.why}</div>`;
  document.getElementById('whyAgent').textContent = item.agent;
  document.getElementById('whyModal').classList.remove('hidden');
}

function closeWhy(event) {
  if (event && event.target.id !== 'whyModal' && !event.target.closest('button')) return;
  document.getElementById('whyModal').classList.add('hidden');
}

// ========== DIET TAB ==========
function renderDietTab() {
  const t = SIMON.diet.today;
  const target = SIMON.diet;
  const macros = [
    { name: '热量', current: t.calories, target: target.targetCalories, unit: 'kcal', color: 'bg-stone-700' },
    { name: '蛋白', current: t.protein, target: target.targetProtein, unit: 'g', color: 'bg-red-500' },
    { name: '碳水', current: t.carbs, target: target.targetCarbs, unit: 'g', color: 'bg-amber-500' },
    { name: '脂肪', current: t.fat, target: target.targetFat, unit: 'g', color: 'bg-blue-500' }
  ];
  document.getElementById('macroProgress').innerHTML = macros.map(m => {
    const pct = Math.min(100, Math.round(m.current / m.target * 100));
    return `
      <div>
        <div class="flex items-baseline justify-between mb-1">
          <span class="text-sm font-semibold">${m.name}</span>
          <span class="text-xs text-stone-500"><span class="font-bold text-stone-900">${m.current}</span> / ${m.target} ${m.unit}</span>
        </div>
        <div class="h-2 bg-stone-100 rounded-full overflow-hidden"><div class="h-full ${m.color}" style="width: ${pct}%"></div></div>
      </div>
    `;
  }).join('');
  document.getElementById('recentMeals').innerHTML = SIMON.diet.recentMeals.map(m => `
    <div class="p-4 flex items-center gap-4 hover:bg-stone-50 transition ${m.drift ? 'bg-orange-50/40' : ''}">
      <div class="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">${m.photo}</div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm">${m.name}${m.drift ? ' <span class="ml-1 inline-block px-1.5 py-0.5 bg-orange-200 text-orange-900 text-[10px] rounded font-bold">DRIFT</span>' : ''}</div>
        <div class="text-xs text-stone-500 mt-0.5">${m.date} · ${m.time}</div>
      </div>
      <div class="text-right">
        <div class="font-bold text-sm">${m.cal} <span class="text-xs text-stone-500 font-normal">大卡</span></div>
        <div class="text-xs text-red-600 font-semibold">${m.protein}g 蛋白</div>
      </div>
    </div>
  `).join('');
}

function renderDietChart() {
  const ctx = document.getElementById('dietWeekChart');
  if (!ctx) return;
  const data = SIMON.diet.week;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.day),
      datasets: [
        { label: '热量', data: data.map(d => d.cal), backgroundColor: '#1c1917', yAxisID: 'y1', barPercentage: 0.6 },
        { label: '蛋白 (g)', data: data.map(d => d.protein), backgroundColor: '#dc2626', yAxisID: 'y2', barPercentage: 0.6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y1: { type: 'linear', position: 'left', title: { display: true, text: 'kcal' }, beginAtZero: true },
        y2: { type: 'linear', position: 'right', title: { display: true, text: 'g' }, grid: { display: false }, beginAtZero: true }
      }
    }
  });
}

// ========== EXERCISE TAB ==========
function renderExerciseTab() {
  const ex = SIMON.exercise;
  const live = ex.today._liveWorkout;
  if (live) {
    document.getElementById('todayTrainingType').textContent = `${live.type || '训练'} · 已记录`;
    const bits = [];
    if (live.duration) bits.push(`${Math.round(live.duration)} 分钟`);
    if (live.calories) bits.push(`${Math.round(live.calories)} 卡`);
    if (live.avgHR) bits.push(`平均 HR ${Math.round(live.avgHR)}`);
    if (live.source) bits.push(live.source);
    document.getElementById('todayTrainingMeta').textContent = bits.join(' · ') || '已同步';
  } else {
    document.getElementById('todayTrainingType').textContent = ex.today.type;
    document.getElementById('todayTrainingMeta').textContent = `约 ${ex.today.duration} 分钟 · 渐进超负荷`;
  }
  document.getElementById('todayLifts').innerHTML = ex.today.lifts.map(l => `
    <div class="px-2 py-3 flex items-center gap-4 hover:bg-stone-50 transition rounded">
      <div class="flex-1">
        <div class="font-semibold text-sm">${l.name}</div>
        <div class="text-xs text-stone-500">${l.sets} · ${l.weight}</div>
      </div>
      <div class="text-xs font-semibold ${l.trend.includes('↑') ? 'text-emerald-600' : 'text-stone-500'}">${l.trend}</div>
    </div>
  `).join('');
}

function renderVolumeChart() {
  const ctx = document.getElementById('volumeChart'); if (!ctx) return;
  const data = SIMON.exercise.weekVolume;
  new Chart(ctx, {
    type: 'bar',
    data: { labels: data.map(d => d.day), datasets: [{ label: 'Volume', data: data.map(d => d.volume), backgroundColor: data.map(d => d.current ? '#dc2626' : (d.volume > 0 ? '#1c1917' : '#e7e5e4')), barPercentage: 0.7 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (ctx) => data[ctx.dataIndex].type } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'kg-reps' } } } }
  });
}

function renderHRVChart() {
  const ctx = document.getElementById('hrvChart'); if (!ctx) return;
  const data = SIMON.exercise.hrv;
  const labels = data.map((_, i) => `D-${data.length - 1 - i}`);
  labels[labels.length - 1] = '今';
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'HRV', data, borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', tension: 0.3, pointRadius: data.map((_, i) => i === data.length - 1 ? 6 : 3), pointBackgroundColor: data.map((_, i) => i === data.length - 1 ? '#dc2626' : '#fff'), pointBorderColor: '#dc2626', fill: true },
      { label: '基线', data: Array(data.length).fill(62), borderColor: '#a8a29e', borderDash: [5, 5], pointRadius: 0, fill: false }
    ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'ms' } } } }
  });
}

function renderStrengthChart() {
  const ctx = document.getElementById('strengthChart'); if (!ctx) return;
  const sp = SIMON.exercise.strengthProgression;
  const labels = sp.squat.map((_, i) => `W${i + 1}`);
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: '深蹲', data: sp.squat, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3 },
      { label: '卧推', data: sp.bench, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3 },
      { label: '硬拉', data: sp.deadlift, borderColor: '#1c1917', backgroundColor: 'rgba(28,25,23,0.1)', tension: 0.3 }
    ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } }, scales: { y: { title: { display: true, text: 'kg' } } } }
  });
}

// ========== SLEEP TAB ==========
function renderSleepTab() {}
function renderSleepChart() {
  const ctx = document.getElementById('sleepChart'); if (!ctx) return;
  const data = SIMON.sleep.week;
  new Chart(ctx, {
    type: 'bar',
    data: { labels: data.map(d => d.day), datasets: [
      { label: '时长 (h)', data: data.map(d => d.duration), backgroundColor: data.map(d => d.current ? '#dc2626' : '#6366f1'), yAxisID: 'y1', barPercentage: 0.6 },
      { label: '质量分', data: data.map(d => d.quality), type: 'line', borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', yAxisID: 'y2', tension: 0.3, pointRadius: 4 }
    ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: {
      y1: { type: 'linear', position: 'left', title: { display: true, text: 'h' }, beginAtZero: true, max: 10 },
      y2: { type: 'linear', position: 'right', title: { display: true, text: 'quality' }, grid: { display: false }, min: 50, max: 100 }
    } }
  });
}

// ========== PROGRESS TAB ==========
function renderProgressChart() {
  const ctx = document.getElementById('progressChart'); if (!ctx) return;
  const w = SIMON.body.weight, bf = SIMON.body.bodyFat, lm = SIMON.body.leanMass;
  const labels = Array.from({ length: 12 }, (_, i) => `W${i}`);
  const weightActual = [...w.history, ...Array(8).fill(null)];
  const weightProj = [...Array(3).fill(null), ...w.projection];
  const bfActual = [...bf.history, ...Array(8).fill(null)];
  const bfProj = [...Array(3).fill(null), ...bf.projection];
  const lmActual = [...lm.history, ...Array(8).fill(null)];
  const lmProj = [...Array(3).fill(null), ...lm.projection];
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: '体重 (kg)', data: weightActual, borderColor: '#1c1917', backgroundColor: 'rgba(28,25,23,0.1)', tension: 0.3, pointRadius: 4, yAxisID: 'y1' },
      { label: '体重 预测', data: weightProj, borderColor: '#1c1917', borderDash: [5, 5], pointRadius: 2, yAxisID: 'y1' },
      { label: '体脂率 (%)', data: bfActual, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3, pointRadius: 4, yAxisID: 'y2' },
      { label: '体脂率 预测', data: bfProj, borderColor: '#dc2626', borderDash: [5, 5], pointRadius: 2, yAxisID: 'y2' },
      { label: '瘦体重 (kg)', data: lmActual, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, pointRadius: 4, yAxisID: 'y1' },
      { label: '瘦体重 预测', data: lmProj, borderColor: '#10b981', borderDash: [5, 5], pointRadius: 2, yAxisID: 'y1' }
    ] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, filter: l => !l.text.includes('预测') } } }, scales: {
      y1: { type: 'linear', position: 'left', title: { display: true, text: 'kg' } },
      y2: { type: 'linear', position: 'right', title: { display: true, text: '%' }, grid: { display: false } }
    } }
  });
}

// ========== CHAT (with mutation + confirm) ==========
function toggleChat() {
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    setTimeout(() => document.getElementById('chatInput').focus(), 100);
  }
}

function askNavigator(prompt) {
  const panel = document.getElementById('chatPanel');
  if (panel.classList.contains('hidden')) toggleChat();
  document.getElementById('chatInput').value = prompt;
  sendChatMessage();
}

function sendQuickMsg(msg) {
  document.getElementById('chatInput').value = msg;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendMessage('user', text);
  const typingEl = appendTyping();
  chatMessages.push({ role: 'user', content: text });
  try {
    const result = await callNavigator(chatMessages);
    typingEl.remove();
    appendMessage('navigator', result.reply);
    chatMessages.push({ role: 'assistant', content: result.reply });
    // If there are proposed schedule changes, render preview card
    if (result.proposedChanges && result.proposedChanges.length > 0) {
      proposedChanges = result.proposedChanges;
      appendProposalCard(result.proposedChanges);
    }
  } catch (err) {
    typingEl.remove();
    appendMessage('navigator', '⚠️ 出错了。再试一次？(' + err.message + ')');
  }
}

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  if (role === 'user') {
    div.className = 'bg-stone-900 text-white rounded-xl p-3 text-sm slide-up ml-auto max-w-[85%]';
    div.innerHTML = `<p class="leading-relaxed">${escapeHtml(text)}</p>`;
  } else {
    div.className = 'bg-stone-50 rounded-xl p-3 text-sm slide-up max-w-[90%]';
    div.innerHTML = `<div class="font-semibold text-xs text-stone-500 mb-1">导航员</div><p class="leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</p>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'bg-stone-50 rounded-xl p-3 text-sm slide-up max-w-[90%]';
  div.innerHTML = `
    <div class="font-semibold text-xs text-stone-500 mb-1">导航员</div>
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 bg-stone-400 rounded-full typing-dot"></span>
      <span class="w-2 h-2 bg-stone-400 rounded-full typing-dot"></span>
      <span class="w-2 h-2 bg-stone-400 rounded-full typing-dot"></span>
      <span class="text-xs text-stone-400 ml-2">三个 Agent 正在汇总意见...</span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendProposalCard(changes) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'bg-blue-50 border-2 border-blue-300 rounded-xl p-3 slide-up max-w-[95%]';
  div.id = 'pendingProposal';
  const summary = changes.map(c => {
    if (c.type === 'remove') {
      const item = SIMON.schedule.find(s => s.id === c.id);
      return `<div class="flex items-center gap-2 text-xs"><span class="text-red-600 font-bold">−</span><span class="line-through opacity-60">${item?.time} ${item?.what?.split('·')[0]}</span></div>`;
    }
    if (c.type === 'modify') {
      const item = SIMON.schedule.find(s => s.id === c.id);
      return `<div class="flex items-start gap-2 text-xs"><span class="text-blue-600 font-bold">~</span><div><div class="line-through opacity-50">${item?.time} ${item?.detail || item?.what}</div><div class="font-semibold mt-0.5">→ ${c.newDetail || c.newWhat}</div></div></div>`;
    }
    return '';
  }).join('');
  div.innerHTML = `
    <div class="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">📋 建议改动 · 等你确认</div>
    <div class="space-y-1.5 mb-3">${summary}</div>
    <div class="flex gap-2">
      <button onclick="acceptProposal()" class="flex-1 px-3 py-1.5 bg-stone-900 text-white text-xs font-bold rounded-lg hover:bg-stone-700">✓ 接受</button>
      <button onclick="rejectProposal()" class="flex-1 px-3 py-1.5 bg-white border border-stone-300 text-xs font-bold rounded-lg hover:bg-stone-50">✕ 拒绝</button>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function acceptProposal() {
  if (!proposedChanges) return;
  // Apply changes to local state
  for (const change of proposedChanges) {
    const idx = SIMON.schedule.findIndex(s => s.id === change.id);
    if (idx === -1) continue;
    if (change.type === 'remove') {
      SIMON.schedule.splice(idx, 1);
    } else if (change.type === 'modify') {
      const item = SIMON.schedule[idx];
      item.adjustedFrom = { detail: item.detail, reason: '你接受了对话中的调整' };
      item.what = change.newWhat || item.what;
      item.detail = change.newDetail || item.detail;
      item.status = 'adjusted';
    }
  }
  proposedChanges = null;
  document.getElementById('pendingProposal')?.remove();
  appendMessage('navigator', '✓ 已更新今日计划. 可以回 Today 屏幕看新版.');
  // Re-render timeline
  renderTimeline();
  renderTopStatus();
}

function rejectProposal() {
  proposedChanges = null;
  document.getElementById('pendingProposal')?.remove();
  appendMessage('navigator', '好的, 计划保持不变. 还需要其他调整吗?');
}

async function callNavigator(messages) {
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, profile: getProfileSnapshot() })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (err) {
    return mockNavigatorReply(messages[messages.length - 1].content);
  }
}

function getProfileSnapshot() {
  return {
    name: SIMON.name, goal: SIMON.goalLabel, weeklyFocus: SIMON.weeklyFocus,
    todayContext: SIMON.todayContext, todayTradeoff: SIMON.tradeoff,
    bodyComp: { weight: SIMON.body.weight.current, bodyFat: SIMON.body.bodyFat.current, leanMass: SIMON.body.leanMass.current },
    macrosToday: SIMON.diet.today, macrosTarget: { calories: SIMON.diet.targetCalories, protein: SIMON.diet.targetProtein }
  };
}

function mockNavigatorReply(text) {
  const t = text.toLowerCase();
  if (t.includes('出去吃') || t.includes('饭局') || t.includes('饭店') || t.includes('应酬')) {
    return {
      reply: `好的，我帮你重新排今天剩下的：

📌 改动建议:
• 跳过 15:00 的训练前餐（你已经吃过了）
• 19:00 训练后晚餐改成外食 (~700 大卡, 主菜选高蛋白)
• 21:00 睡前蛋白照常

📌 取舍:
今天热量可能略超 200-300 卡 (社交场不可控). 明天午餐砍 200g 米饭可以补回. 蛋白还是要够 200g.`,
      proposedChanges: [
        { type: 'modify', id: 'dinner', newWhat: '外食晚餐 · 高蛋白 (牛排 / 鱼) + 蔬菜 + 适量碳水', newDetail: '~700 大卡 · 50g 蛋白' }
      ]
    };
  }
  if (t.includes('累') || t.includes('不想') || t.includes('懒')) {
    return {
      reply: `理解. HRV 58 (基线 62) 也确认昨晚恢复差.

📌 改动建议:
• 训练改成轻松 Zone 2 慢跑 30 分钟
• Pull day 推到明天
• 蛋白照常 200g — 不能让

📌 取舍:
本周训练量会少一次, 但 recomp 是 12 周的事. 今晚 8h 睡眠 + 蛋白能保住的话, 这周仍然有效.`,
      proposedChanges: [
        { type: 'modify', id: 'training', newWhat: 'Zone 2 慢跑 30 min (替代 Pull)', newDetail: '低强度恢复' }
      ]
    };
  }
  if (t.includes('为什么') && (t.includes('调整') || t.includes('晚餐'))) {
    return {
      reply: `逻辑链:

🧠 你午餐多吃了 250 卡 (850 vs 计划 600)
📊 今日总热量目标 2300, 早午加起来已经 1675
📋 剩下还有训练后晚餐 + 睡前蛋白 = 800 卡空间
✂️ 把晚餐从 650 卡降到 550 卡 = 削 100 卡 → 总量 2275 卡 ≈ 目标
🔒 蛋白量目标不变 (200g) — 削的是碳水 (米饭 200g → 150g)

为什么是晚餐而不是早餐? — 早餐已经吃了, 没法改.
为什么不 skip 加餐? — 加餐已经在 15:00 吃了.
唯一能调的就是接下来的两餐. 选晚餐削是因为它的总量最大.`,
      proposedChanges: null
    };
  }
  return {
    reply: `让我把你的请求分发给 3 个 Agent...

我注意到你说: "${text}"

如果你能告诉我具体要调整哪一项 (饮食 / 训练 / 睡眠), 我可以更精准地帮你重排.

也可以试试上面的快捷按钮.

(💡 真实 Claude API 集成已就绪 — 需要在 Vercel 设置 ANTHROPIC_API_KEY 环境变量)`,
    proposedChanges: null
  };
}

function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ========== SETTINGS ==========
function loadSettings() {
  try {
    const saved = localStorage.getItem('mana_settings');
    if (saved) {
      const s = JSON.parse(saved);
      SIMON.settings = { ...SIMON.settings, ...s };
    }
  } catch (e) {}
}
function openSettings() {
  document.getElementById('onTrackSlider').value = SIMON.settings.driftThresholdOnTrack;
  document.getElementById('alertSlider').value = SIMON.settings.driftThresholdAlert;
  document.getElementById('onTrackValue').textContent = `±${SIMON.settings.driftThresholdOnTrack}%`;
  document.getElementById('alertValue').textContent = `±${SIMON.settings.driftThresholdAlert}%`;
  document.getElementById('settingsModal').classList.remove('hidden');
}
function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }
function saveSettings() {
  SIMON.settings.driftThresholdOnTrack = parseInt(document.getElementById('onTrackSlider').value);
  SIMON.settings.driftThresholdAlert = parseInt(document.getElementById('alertSlider').value);
  try { localStorage.setItem('mana_settings', JSON.stringify(SIMON.settings)); } catch (e) {}
  closeSettings();
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'onTrackSlider') document.getElementById('onTrackValue').textContent = `±${e.target.value}%`;
  if (e.target.id === 'alertSlider') document.getElementById('alertValue').textContent = `±${e.target.value}%`;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('whyModal').classList.add('hidden');
    document.getElementById('settingsModal').classList.add('hidden');
    document.getElementById('complianceModal').classList.add('hidden');
    document.getElementById('dataSourceModal').classList.add('hidden');
  }
});
