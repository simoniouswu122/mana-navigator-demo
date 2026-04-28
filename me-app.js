// Simon's personal Mana experience · main controller
// Handles: tab switching, data rendering, charts, chat

let currentTab = 'today';
let chatMessages = [];
let chartsRendered = {};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  renderTodayTab();
  renderDietTab();
  renderExerciseTab();
  renderSleepTab();
  renderProgressTab();
  switchTab('today');
});

// ========== TAB SWITCHING ==========
function switchTab(tab) {
  currentTab = tab;
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.tab === tab) {
      b.classList.add('border-stone-900', 'text-stone-900');
      b.classList.remove('border-transparent', 'text-stone-500');
    } else {
      b.classList.add('border-transparent', 'text-stone-500');
      b.classList.remove('border-stone-900', 'text-stone-900');
    }
  });

  // Update panes
  document.querySelectorAll('.tab-pane').forEach(p => {
    if (p.id === `tab-${tab}`) {
      p.classList.remove('hidden');
      p.classList.add('fade-in');
    } else {
      p.classList.add('hidden');
      p.classList.remove('fade-in');
    }
  });

  // Render charts on first view
  setTimeout(() => renderChartsForTab(tab), 50);
}

function renderChartsForTab(tab) {
  if (chartsRendered[tab]) return;
  chartsRendered[tab] = true;
  if (tab === 'diet') renderDietChart();
  if (tab === 'exercise') {
    renderVolumeChart();
    renderHRVChart();
    renderStrengthChart();
  }
  if (tab === 'sleep') renderSleepChart();
  if (tab === 'progress') renderProgressChart();
}

// ========== TODAY TAB ==========
function renderTodayTab() {
  document.getElementById('todayTradeoff').textContent = SIMON.tradeoff;

  const timeline = document.getElementById('todayTimeline');
  timeline.innerHTML = SIMON.schedule.map((item, i) => `
    <button onclick="showWhy(${i})" class="w-full text-left p-4 hover:bg-stone-50 transition flex items-start gap-4 group">
      <div class="flex flex-col items-center w-16 flex-shrink-0">
        <div class="text-xs font-semibold text-stone-500">${item.time}</div>
        <div class="text-2xl mt-1">${item.icon}</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold ${item.highlight ? 'text-stone-900' : 'text-stone-800'}">${item.what}${item.highlight ? ' <span class="ml-1 inline-block px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded font-semibold">关键节点</span>' : ''}</div>
        ${item.detail ? `<div class="text-sm text-stone-500 mt-1">${item.detail}</div>` : ''}
        <div class="mt-1.5 text-xs text-stone-400 group-hover:text-stone-600">${item.agent} · 点击看「为什么」</div>
      </div>
    </button>
  `).join('');
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
        <div class="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div class="h-full ${m.color}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Recent meals
  document.getElementById('recentMeals').innerHTML = SIMON.diet.recentMeals.map(m => `
    <div class="p-4 flex items-center gap-4 hover:bg-stone-50 transition">
      <div class="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">${m.photo}</div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm">${m.name}</div>
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
  const days = SIMON.diet.week.map(d => d.day);
  const cals = SIMON.diet.week.map(d => d.cal);
  const proteins = SIMON.diet.week.map(d => d.protein);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        { label: '热量', data: cals, backgroundColor: '#1c1917', yAxisID: 'y1', barPercentage: 0.6 },
        { label: '蛋白 (g)', data: proteins, backgroundColor: '#dc2626', yAxisID: 'y2', barPercentage: 0.6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
  document.getElementById('todayTrainingType').textContent = ex.today.type;
  document.getElementById('todayTrainingMeta').textContent = `约 ${ex.today.duration} 分钟 · 渐进超负荷`;
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
  const ctx = document.getElementById('volumeChart');
  if (!ctx) return;
  const data = SIMON.exercise.weekVolume;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.day),
      datasets: [{
        label: 'Volume',
        data: data.map(d => d.volume),
        backgroundColor: data.map(d => d.current ? '#dc2626' : (d.volume > 0 ? '#1c1917' : '#e7e5e4')),
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (ctx) => data[ctx.dataIndex].type } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'kg-reps' } } }
    }
  });
}

function renderHRVChart() {
  const ctx = document.getElementById('hrvChart');
  if (!ctx) return;
  const data = SIMON.exercise.hrv;
  const labels = data.map((_, i) => `D-${data.length - 1 - i}`);
  labels[labels.length - 1] = '今';
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'HRV',
          data,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          tension: 0.3,
          pointRadius: data.map((_, i) => i === data.length - 1 ? 6 : 3),
          pointBackgroundColor: data.map((_, i) => i === data.length - 1 ? '#dc2626' : '#fff'),
          pointBorderColor: '#dc2626',
          fill: true
        },
        {
          label: '基线',
          data: Array(data.length).fill(62),
          borderColor: '#a8a29e',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { title: { display: true, text: 'ms' } } }
    }
  });
}

function renderStrengthChart() {
  const ctx = document.getElementById('strengthChart');
  if (!ctx) return;
  const sp = SIMON.exercise.strengthProgression;
  const labels = sp.squat.map((_, i) => `W${i + 1}`);
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '深蹲', data: sp.squat, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3 },
        { label: '卧推', data: sp.bench, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3 },
        { label: '硬拉', data: sp.deadlift, borderColor: '#1c1917', backgroundColor: 'rgba(28,25,23,0.1)', tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } },
      scales: { y: { title: { display: true, text: 'kg' } } }
    }
  });
}

// ========== SLEEP TAB ==========
function renderSleepTab() {
  // Static content already in HTML, just chart
}

function renderSleepChart() {
  const ctx = document.getElementById('sleepChart');
  if (!ctx) return;
  const data = SIMON.sleep.week;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.day),
      datasets: [
        {
          label: '时长 (h)',
          data: data.map(d => d.duration),
          backgroundColor: data.map(d => d.current ? '#dc2626' : '#6366f1'),
          yAxisID: 'y1',
          barPercentage: 0.6
        },
        {
          label: '质量分',
          data: data.map(d => d.quality),
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          yAxisID: 'y2',
          tension: 0.3,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y1: { type: 'linear', position: 'left', title: { display: true, text: 'h' }, beginAtZero: true, max: 10 },
        y2: { type: 'linear', position: 'right', title: { display: true, text: 'quality' }, grid: { display: false }, min: 50, max: 100 }
      }
    }
  });
}

// ========== PROGRESS TAB ==========
function renderProgressTab() {
  // Static cards in HTML
}

function renderProgressChart() {
  const ctx = document.getElementById('progressChart');
  if (!ctx) return;
  const w = SIMON.body.weight;
  const bf = SIMON.body.bodyFat;
  const lm = SIMON.body.leanMass;
  const labels = Array.from({ length: 12 }, (_, i) => `W${i}`);

  // Combine history + projection
  const weightActual = [...w.history, ...Array(8).fill(null)];
  const weightProj = [...Array(3).fill(null), ...w.projection];

  const bfActual = [...bf.history, ...Array(8).fill(null)];
  const bfProj = [...Array(3).fill(null), ...bf.projection];

  const lmActual = [...lm.history, ...Array(8).fill(null)];
  const lmProj = [...Array(3).fill(null), ...lm.projection];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '体重 (kg)', data: weightActual, borderColor: '#1c1917', backgroundColor: 'rgba(28,25,23,0.1)', tension: 0.3, pointRadius: 4, yAxisID: 'y1' },
        { label: '体重 预测', data: weightProj, borderColor: '#1c1917', borderDash: [5, 5], pointRadius: 2, yAxisID: 'y1' },
        { label: '体脂率 (%)', data: bfActual, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3, pointRadius: 4, yAxisID: 'y2' },
        { label: '体脂率 预测', data: bfProj, borderColor: '#dc2626', borderDash: [5, 5], pointRadius: 2, yAxisID: 'y2' },
        { label: '瘦体重 (kg)', data: lmActual, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, pointRadius: 4, yAxisID: 'y1' },
        { label: '瘦体重 预测', data: lmProj, borderColor: '#10b981', borderDash: [5, 5], pointRadius: 2, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, filter: l => !l.text.includes('预测') } } },
      scales: {
        y1: { type: 'linear', position: 'left', title: { display: true, text: 'kg' } },
        y2: { type: 'linear', position: 'right', title: { display: true, text: '%' }, grid: { display: false } }
      }
    }
  });
}

// ========== CHAT ==========
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

  // Append user message to UI
  appendMessage('user', text);

  // Append typing indicator
  const typingEl = appendTyping();

  // Track in history
  chatMessages.push({ role: 'user', content: text });

  try {
    const reply = await callNavigator(chatMessages);
    typingEl.remove();
    appendMessage('navigator', reply);
    chatMessages.push({ role: 'assistant', content: reply });
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

async function callNavigator(messages) {
  // Try the API route first; fall back to client-side mock
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, profile: getProfileSnapshot() })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.reply;
  } catch (err) {
    // Fallback: local mock based on keywords
    return mockNavigatorReply(messages[messages.length - 1].content);
  }
}

function getProfileSnapshot() {
  return {
    name: SIMON.name,
    goal: SIMON.goalLabel,
    weeklyFocus: SIMON.weeklyFocus,
    todayContext: SIMON.todayContext,
    todayTradeoff: SIMON.tradeoff,
    bodyComp: { weight: SIMON.body.weight.current, bodyFat: SIMON.body.bodyFat.current, leanMass: SIMON.body.leanMass.current },
    macrosToday: SIMON.diet.today,
    macrosTarget: { calories: SIMON.diet.targetCalories, protein: SIMON.diet.targetProtein }
  };
}

// Mock fallback for when /api/chat is unavailable
function mockNavigatorReply(text) {
  const t = text.toLowerCase();
  if (t.includes('出去吃') || t.includes('饭局') || t.includes('饭店') || t.includes('应酬')) {
    return `好的，我帮你重新排今天剩下的：

📌 改动：
• 跳过 15:00 的训练前餐（鸡胸+杏仁）
• 17:30 训练保持不变 — 但训练后晚餐改成训练后立即喝一杯 30g 乳清蛋白
• 出去吃饭时优先选高蛋白（牛排/鱼/烤鸡）+ 蔬菜，碳水控制在 ~80g
• 21:00 睡前蛋白照常

📌 取舍：
今天热量可能略超 200-300 大卡（社交场不可控）。明天午餐砍 200g 米饭，本周还能稳住 deficit。

享受你的饭局 — 减肥不是受苦，是会调整。`;
  }
  if (t.includes('累') || t.includes('不想') || t.includes('懒')) {
    return `理解。睡眠 Agent 也确认昨晚 HRV 略低（58 vs 基线 62）。

📌 今天的版本（轻量）：
• 训练改成 30 min 轻松 Zone 2 慢跑（替代 pull day）
• Pull day 推到明天
• 蛋白照常 200g — 这个不能让

📌 取舍：
本周训练量会少一次，但 recomp 是 12 周的事，不是一周。睡眠 + 蛋白能保住的话，这周仍然有效。

明天你会感觉好很多。`;
  }
  if (t.includes('为什么') || t.includes('解释')) {
    return `今天的核心逻辑：

🧠 你这周的目标：增肌 + 减脂（recomp）— Week 3/12
📊 昨晚信号：睡眠 7.2h（略低），HRV 58 vs 基线 62（↓ 6%）
📋 训练上下文：昨天 Push，今天 Pull（轮动逻辑）

📌 决策：
• 训练保持但不冒险加大重量（HRV 略低）
• 蛋白 200g 不可妥协（recomp 的硬指标）
• 训练后晚餐高蛋白高碳水（蛋白合成窗口）
• 今晚必须 8h 睡眠（补回昨晚的赤字）

3 个 Agent 都同意。我做最终的"什么告诉你 / 什么不告诉你"的取舍。`;
  }
  if (t.includes('为什么') && t.includes('pull')) {
    return `运动 Agent 用的是 Push/Pull/Legs 轮动：
• 周二：Push（胸 + 肩 + 三头）
• 周四：Legs（腿 + 屁股）
• 周日：Push
• 今天（周一）：Pull（背 + 二头）

逻辑：每个肌群每周练 2 次，恢复 ~48-72 小时。今天 pull 可以让昨天 push 的胸肩肩三头继续恢复。

如果你觉得疲劳大于动力 — 我们可以推迟。`;
  }
  if (t.includes('蛋白') || t.includes('protein')) {
    return `你今天吃了 184g 蛋白（目标 200g）。还差 16g。

剩下的来源：
• 训练后晚餐：50g（鸡胸 150g）
• 睡前蛋白：25g（希腊酸奶或酪蛋白）

按计划走的话，你今天会到 ~209g — 略超目标，但 recomp 期可以。

蛋白是 recomp 唯一不能让的指标。其他都可以调。`;
  }
  // Default
  return `让我把你的请求分发给 3 个 Agent...

我注意到你说："${text}"

如果你能告诉我具体是想调整哪一项（饮食 / 训练 / 睡眠），或者今天遇到什么具体情况，我可以更精准地帮你重排。

也可以试试上面的快捷按钮。

(💡 真实 Claude API 集成已就绪 — 需要你在 Vercel 设置 ANTHROPIC_API_KEY 环境变量)`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Keyboard ESC closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('whyModal').classList.add('hidden');
  }
});
