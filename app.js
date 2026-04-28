// Mana Navigator Demo · main controller
// Handles: profile selection → agent thinking animation → plan reveal

let currentProfile = null;
let currentTimeline = [];

function selectProfile(profileKey) {
  currentProfile = profileKey;
  const profile = PROFILES[profileKey];
  if (!profile) return;

  // Scroll to output
  document.getElementById('output').classList.remove('hidden');
  document.getElementById('planOutput').classList.add('hidden');
  resetAgentStream();

  // Smooth scroll
  document.getElementById('output').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Disable profile cards visually
  document.querySelectorAll('.profile-card').forEach(c => {
    if (c.dataset.profile === profileKey) {
      c.classList.add('ring-2', 'ring-offset-2', 'ring-stone-900');
    } else {
      c.classList.remove('ring-2', 'ring-offset-2', 'ring-stone-900');
    }
  });

  // Run agent animation then reveal plan
  runAgentStream(profile);
}

function resetAgentStream() {
  ['diet', 'exercise', 'sleep', 'navigator'].forEach(name => {
    const card = document.getElementById('agent-' + name);
    const status = document.getElementById('agent-' + name + '-status');
    card.classList.remove('opacity-100', 'border-green-400', 'bg-green-50');
    card.classList.add('opacity-30');
    status.textContent = '等待...';
    status.classList.remove('text-green-700', 'agent-pulse', 'font-semibold');
  });
}

async function runAgentStream(profile) {
  const sequence = [
    {
      key: 'diet',
      thinking: '分析当前宏量目标 + 餐食偏好...',
      done: '✓ 安排了 5 顿餐 + 加餐'
    },
    {
      key: 'exercise',
      thinking: '评估训练历史 + 今日恢复状态...',
      done: getExerciseDone(profile)
    },
    {
      key: 'sleep',
      thinking: '检查 HRV 趋势 + 上周睡眠质量...',
      done: getSleepDone(profile)
    },
    {
      key: 'navigator',
      thinking: '汇总 3 个专家意见 + 写出取舍...',
      done: '✓ 完整一日计划已生成'
    }
  ];

  for (const step of sequence) {
    await activateAgent(step);
  }

  // Brief pause before reveal
  await sleep(400);
  revealPlan(profile);
}

async function activateAgent(step) {
  const card = document.getElementById('agent-' + step.key);
  const status = document.getElementById('agent-' + step.key + '-status');

  // Activate
  card.classList.remove('opacity-30');
  card.classList.add('opacity-100');
  status.textContent = step.thinking;
  status.classList.add('agent-pulse');

  // Wait for "thinking"
  await sleep(900);

  // Mark done
  status.classList.remove('agent-pulse');
  status.classList.add('text-green-700', 'font-semibold');
  status.textContent = step.done;
  card.classList.add('border-green-400', 'bg-green-50');

  await sleep(200);
}

function getExerciseDone(profile) {
  if (profile.label.includes('上班族')) return '✓ 30 min 全身循环 (家中可做)';
  if (profile.label.includes('马拉松')) return '✓ 16 km Zone 2 长跑';
  if (profile.label.includes('增肌')) return '✓ 4 个复合动作 × 4 组';
  return '✓ 训练计划已就绪';
}

function getSleepDone(profile) {
  if (profile.label.includes('上班族')) return '✓ 目标 7-8 小时';
  if (profile.label.includes('马拉松')) return '✓ 目标 9 小时 (恢复优先)';
  if (profile.label.includes('增肌')) return '✓ 目标 8 小时';
  return '✓ 睡眠目标已设定';
}

function revealPlan(profile) {
  document.getElementById('planOutput').classList.remove('hidden');
  currentTimeline = profile.timeline;

  // Header
  document.getElementById('planLabel').textContent = profile.label;
  document.getElementById('planLabel').className = 'inline-block px-3 py-1 text-xs font-semibold rounded-full mb-3 ' + profile.labelClass;
  document.getElementById('planTitle').textContent = profile.title;

  // Stats
  const statsEl = document.getElementById('planStats');
  statsEl.innerHTML = profile.stats.map(s => `
    <div class="flex items-baseline gap-1.5">
      <span class="font-bold text-xl ${s.highlight ? 'text-red-600' : 'text-stone-900'}">${s.value}</span>
      <span class="text-stone-500">${s.unit}</span>
    </div>
  `).join('<div class="text-stone-300">·</div>');

  // Tradeoff
  document.getElementById('tradeoffText').textContent = profile.tradeoff;

  // Timeline
  const timelineEl = document.getElementById('timeline');
  timelineEl.innerHTML = profile.timeline.map((item, i) => `
    <button onclick="showWhy(${i})" class="w-full text-left p-4 hover:bg-stone-50 transition flex items-start gap-4 group">
      <div class="flex flex-col items-center w-20 flex-shrink-0">
        <div class="text-xs font-semibold text-stone-500 mb-1">${item.time}</div>
        <div class="text-2xl">${item.icon}</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold ${item.highlight ? 'text-stone-900' : 'text-stone-800'}">${item.what}${item.highlight ? ' <span class="ml-1 inline-block px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded font-semibold">关键节点</span>' : ''}</div>
        ${item.detail ? `<div class="text-sm text-stone-500 mt-1">${item.detail}</div>` : ''}
        <div class="mt-2 text-xs text-stone-400 group-hover:text-stone-600">点击查看「为什么这样安排」 →</div>
      </div>
    </button>
  `).join('');

  // Principles
  const principlesEl = document.getElementById('principles');
  principlesEl.innerHTML = profile.principles.map((p, i) => `
    <li class="flex items-start gap-3">
      <div class="w-7 h-7 bg-stone-900 text-white text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">${i + 1}</div>
      <div>
        <div class="font-semibold text-stone-900">${p.title}</div>
        <div class="text-sm text-stone-600 mt-0.5">${p.detail}</div>
      </div>
    </li>
  `).join('');
}

function showWhy(index) {
  const item = currentTimeline[index];
  if (!item) return;

  document.getElementById('whyTitle').textContent = item.what;
  document.getElementById('whyContent').innerHTML = `<div class="text-base leading-relaxed">${item.why}</div>`;
  document.getElementById('whyAgent').textContent = item.agent || '导航员';
  document.getElementById('whyModal').classList.remove('hidden');
}

function closeWhy(event) {
  if (event && event.target.id !== 'whyModal' && !event.target.closest('button')) {
    return;
  }
  document.getElementById('whyModal').classList.add('hidden');
}

function resetDemo() {
  currentProfile = null;
  document.getElementById('output').classList.add('hidden');
  document.querySelectorAll('.profile-card').forEach(c => {
    c.classList.remove('ring-2', 'ring-offset-2', 'ring-stone-900');
  });
  // Smooth scroll back
  document.querySelector('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleCustomForm() {
  const form = document.getElementById('customForm');
  const toggle = document.getElementById('customToggle');
  if (form.classList.contains('hidden')) {
    form.classList.remove('hidden');
    form.classList.add('fade-in');
    toggle.textContent = '← 隐藏自定义';
  } else {
    form.classList.add('hidden');
    toggle.textContent = '或者输入你自己的画像 →';
  }
}

function generateCustom() {
  // For demo: map to nearest preset based on goal
  const goal = document.getElementById('custom-goal').value;
  const goalMap = {
    'lose-weight': 'weight-loss',
    'marathon': 'marathon',
    'recomp': 'recomp',
    'maintain': 'weight-loss'
  };
  selectProfile(goalMap[goal] || 'weight-loss');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Keyboard: ESC closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('whyModal').classList.add('hidden');
  }
});
