// Simon's personalized Mana data · v0.1
// All data is plausible based on a real recomp journey (Week 3 of 12)
//
// Schedule items now have status: 'done' | 'drift' | 'upcoming' | 'adjusted'
// + actual/adjustedFrom fields for drift detection visualization

const SIMON = {
  name: "Simon",
  avatar: "S",
  joinedWeek: 3,
  totalWeeks: 12,
  goalLabel: "增肌 + 减脂 (Recomp)",
  weeklyFocus: "Week 3 / 12 · 微赤字 + 力量训练 + 蛋白拉到 200g",
  todayDate: "2026-04-28",
  todayDayOfWeek: "周一",
  // Pretend "now" for the demo (after lunch, before training)
  pretendNow: "16:42",

  body: {
    weight: {
      start: 75.0, current: 73.2, target: 71.5, unit: "kg",
      history: [75.0, 74.4, 73.7, 73.2],
      projection: [73.2, 72.8, 72.4, 72.0, 71.7, 71.5, 71.3, 71.0, 70.8]
    },
    bodyFat: {
      start: 19.5, current: 17.8, target: 14.0, unit: "%",
      history: [19.5, 19.0, 18.4, 17.8],
      projection: [17.8, 17.3, 16.8, 16.3, 15.8, 15.3, 14.8, 14.4, 14.0]
    },
    leanMass: {
      start: 60.4, current: 60.2, target: 61.5, unit: "kg",
      history: [60.4, 60.3, 60.2, 60.2],
      projection: [60.2, 60.4, 60.6, 60.8, 61.0, 61.1, 61.2, 61.3, 61.5]
    }
  },

  todayContext: {
    lastNightSleep: 7.2, lastNightHRV: 58, hrvBaseline: 62,
    todayTrainingType: "Pull (背 + 二头)",
    weekTrainingDone: 2, weekProteinAvg: 198, proteinTarget: 200
  },

  // Streak tracking
  streak: { current: 4, weekTarget: 7, lastBreak: "上周日 · 应酬" },

  // Settings (user can adjust)
  settings: {
    driftThresholdOnTrack: 10,   // ±10% = on-track
    driftThresholdAlert: 20      // ±20% = drift
  },

  // The schedule with full state for v0.1
  // status: 'done' | 'drift' | 'upcoming' | 'adjusted'
  schedule: [
    {
      id: "wake",
      time: "06:00", icon: "☀️", what: "起床 · 500ml 水 + 黑咖啡",
      detail: "空腹 30 min 启动代谢",
      agent: "导航员",
      status: "done",
      actual: { complianceNote: "如计划 · 06:08 起床" },
      why: "咖啡因 + 空腹状态 — 咖啡因促进脂肪酸释放，空腹让身体优先用脂肪供能。这是 recomp 早晨的代谢窗口。"
    },
    {
      id: "breakfast",
      time: "07:00", icon: "🍳", what: "早餐 · 3 鸡蛋 + 燕麦 60g + 蓝莓 + 花生酱 1 勺",
      detail: "450 大卡 · 35g 蛋白",
      agent: "饮食 Agent",
      status: "done",
      actual: { calories: 460, protein: 36, complianceNote: "✓ 蛋白达标" },
      why: "今天目标 200g 蛋白 (1g/磅)。早餐 35g 是分散摄入策略 — 一次摄入 30g 以上肌肉合成边际效益开始下降。"
    },
    {
      id: "snack-am",
      time: "10:00", icon: "🥤", what: "加餐 · 乳清蛋白 1 勺 + 苹果",
      detail: "180 大卡 · 24g 蛋白",
      agent: "饮食 Agent",
      status: "done",
      actual: { calories: 175, protein: 24, complianceNote: "✓ 如计划" },
      why: "上午到中午之间不掉链子。乳清蛋白 30 分钟达峰，适合训练日的'夹缝补给'。"
    },
    {
      id: "lunch",
      time: "12:30", icon: "🥩", what: "午餐 · 瘦牛肉 + 紫米饭 + 牛油果 + 蔬菜（计划）",
      detail: "600 大卡 · 45g 蛋白",
      agent: "饮食 Agent",
      status: "drift",
      // What actually happened
      actual: {
        time: "13:10",
        what: "午餐 · 同事请客 · 牛肉面 + 半份炸鸡",
        calories: 850,
        protein: 38,
        drift: { calories: +250, time: 40, complianceNote: "⚠️ +250 大卡 · 晚 40 分钟" }
      },
      why: "Recomp 午餐黄金组合：复合碳水 + 健康脂肪 + 高蛋白。瘦牛肉的肌酸 + 锌 + B12 对力量训练特别重要。"
    },
    {
      id: "preworkout",
      time: "15:00", icon: "🥜", what: "训练前 · 鸡胸 1 片 + 杏仁一把",
      detail: "180 大卡 · 30g 蛋白",
      agent: "饮食 Agent",
      status: "done",
      actual: { calories: 175, protein: 28, complianceNote: "✓ 训练前餐" },
      why: "训练前 2.5 小时的'训练前餐' — 蛋白 + 慢碳水给训练能量。"
    },
    {
      id: "training",
      time: "17:30", icon: "💪", what: "Pull · 引体 / 划船 / 硬拉 / 二头 × 4 组",
      detail: "渐进超负荷：硬拉比上周多 2.5kg",
      agent: "运动 Agent",
      status: "upcoming",
      countdown: "1 小时后",
      why: "今天是 pull day（昨天 push）。复合动作 + 渐进超负荷 = 增肌的核心。HRV 58 略低于基线 62，但仍在可训练区间。",
      highlight: true
    },
    {
      id: "dinner",
      time: "19:00", icon: "🍱", what: "训练后晚餐 · 鸡胸 150g + 紫米饭 150g + 西兰花",
      detail: "550 大卡 · 50g 蛋白",
      agent: "饮食 Agent",
      status: "adjusted",
      adjustedFrom: {
        detail: "原 650 大卡 · 紫米饭 200g",
        reason: "因为午餐 +250 大卡 → 饮食 Agent 把晚餐碳水削减 50g 以维持今日总热量"
      },
      why: "训练后 1 小时内吃 — 蛋白合成的窗口期。米饭量调低是因为午餐已经超了。"
    },
    {
      id: "night-protein",
      time: "21:00", icon: "🥛", what: "睡前蛋白 · 希腊酸奶（或酪蛋白 1 勺）",
      detail: "150 大卡 · 25g 蛋白",
      agent: "饮食 Agent",
      status: "upcoming",
      why: "酪蛋白慢释放 — 给身体睡觉时合成肌肉的原料。研究显示睡前 30g 酪蛋白可增加 22% 的肌肉合成率。"
    },
    {
      id: "sleep",
      time: "22:30", icon: "🌙", what: "睡觉 · 目标 8 小时",
      detail: "昨晚 7.2h（略低于目标）— 今晚补回",
      agent: "睡眠 Agent",
      status: "upcoming",
      why: "睡眠不够再吃多蛋白也白搭 — 肌肉是睡出来的。深睡阶段生长激素分泌量是清醒时的 75 倍。",
      highlight: true
    }
  ],

  // The navigator's tradeoff line for today (post-drift recalc)
  tradeoff: "午餐超了 250 卡 — 饮食 Agent 已经把晚餐削减 50g 米饭. 训练强度保持但不冒险加大重量 (HRV 58 < 基线 62). 蛋白还差 16g, 晚餐 + 睡前能补回.",

  diet: {
    targetCalories: 2300, targetProtein: 200, targetCarbs: 230, targetFat: 75,
    today: { calories: 2210, protein: 184, carbs: 215, fat: 72 },
    week: [
      { day: "周二", cal: 2280, protein: 195, carbs: 225, fat: 73 },
      { day: "周三", cal: 2350, protein: 205, carbs: 240, fat: 76 },
      { day: "周四", cal: 2310, protein: 198, carbs: 228, fat: 74 },
      { day: "周五", cal: 2420, protein: 210, carbs: 255, fat: 78 },
      { day: "周六", cal: 2380, protein: 195, carbs: 245, fat: 80 },
      { day: "周日", cal: 2280, protein: 200, carbs: 220, fat: 74 },
      { day: "今日", cal: 2210, protein: 184, carbs: 215, fat: 72 }
    ],
    recentMeals: [
      { time: "07:00", date: "今天", name: "早餐 · 鸡蛋燕麦", cal: 460, protein: 36, photo: "🍳" },
      { time: "13:10", date: "今天", name: "午餐 · 牛肉面 (外食)", cal: 850, protein: 38, photo: "🍜", drift: true },
      { time: "12:30", date: "昨天", name: "午餐 · 牛肉紫米饭", cal: 620, protein: 47, photo: "🥩" },
      { time: "19:00", date: "昨天", name: "晚餐 · 鸡胸三文鱼", cal: 580, protein: 52, photo: "🐟" },
      { time: "21:00", date: "昨天", name: "睡前 · 希腊酸奶", cal: 150, protein: 25, photo: "🥛" }
    ]
  },

  exercise: {
    today: {
      type: "Pull (背 + 二头)",
      duration: 60,
      lifts: [
        { name: "引体向上", sets: "4 × 8", weight: "自重 +5kg", trend: "↑ +2.5kg" },
        { name: "杠铃划船", sets: "4 × 10", weight: "65kg", trend: "↑ +2.5kg" },
        { name: "硬拉", sets: "4 × 6", weight: "120kg", trend: "↑ +2.5kg ⭐" },
        { name: "二头弯举", sets: "3 × 12", weight: "16kg × 2", trend: "→ 同上周" }
      ]
    },
    weekVolume: [
      { day: "周一", volume: 0, type: "rest" },
      { day: "周二", volume: 12500, type: "Push" },
      { day: "周三", volume: 0, type: "rest" },
      { day: "周四", volume: 14200, type: "Legs" },
      { day: "周五", volume: 0, type: "Zone 2" },
      { day: "周六", volume: 13800, type: "Push" },
      { day: "周日", volume: 0, type: "rest" },
      { day: "今日", volume: 15400, type: "Pull", current: true }
    ],
    hrv: [60, 63, 64, 62, 61, 65, 67, 64, 63, 61, 60, 58, 62, 58],
    strengthProgression: {
      squat: [85, 87.5, 90, 92.5, 95, 95, 97.5, 100],
      bench: [60, 60, 62.5, 62.5, 65, 65, 67.5, 67.5],
      deadlift: [110, 112.5, 115, 115, 117.5, 117.5, 117.5, 120]
    }
  },

  sleep: {
    lastNight: {
      duration: 7.2, target: 8, bedTime: "23:42", wakeTime: "06:54",
      quality: 78, stages: { deep: 1.4, rem: 1.8, light: 4.0 },
      hrv: 58, restingHR: 54
    },
    week: [
      { day: "周二", duration: 7.5, quality: 82 },
      { day: "周三", duration: 6.8, quality: 71 },
      { day: "周四", duration: 8.1, quality: 88 },
      { day: "周五", duration: 7.8, quality: 85 },
      { day: "周六", duration: 8.4, quality: 90 },
      { day: "周日", duration: 7.6, quality: 82 },
      { day: "昨晚", duration: 7.2, quality: 78, current: true }
    ],
    avgDuration: 7.6, avgQuality: 82
  }
};

// Compliance score: weighted sum (33% protein, 33% training, 33% sleep)
// Returns { overall, protein, training, sleep, breakdown }
function computeCompliance() {
  // Protein: today's actual / target (capped at 100%)
  const proteinPct = Math.min(100, Math.round(SIMON.diet.today.protein / SIMON.diet.targetProtein * 100));
  // Training: today's session done? (treat upcoming as 0% until done; 100% if done; partial if drift)
  const trainingItem = SIMON.schedule.find(s => s.id === "training");
  const trainingPct = trainingItem.status === "done" ? 100 : trainingItem.status === "upcoming" ? 0 : 50;
  // Sleep: last night vs target (8h)
  const sleepPct = Math.min(100, Math.round(SIMON.sleep.lastNight.duration / SIMON.sleep.lastNight.target * 100));
  // Overall: simple average
  const overall = Math.round((proteinPct + trainingPct + sleepPct) / 3);
  return {
    overall, proteinPct, trainingPct, sleepPct,
    breakdown: [
      { label: "蛋白", pct: proteinPct, current: SIMON.diet.today.protein, target: SIMON.diet.targetProtein, unit: "g" },
      { label: "训练", pct: trainingPct, current: trainingItem.status === "done" ? "完成" : "未完成", target: "今日 1 次" },
      { label: "睡眠", pct: sleepPct, current: SIMON.sleep.lastNight.duration, target: SIMON.sleep.lastNight.target, unit: "h" }
    ]
  };
}

// Outcome progress: how close to goal (51% based on weight loss)
function computeOutcomeProgress() {
  const w = SIMON.body.weight;
  const totalLoss = w.start - w.target; // 3.5kg
  const currentLoss = w.start - w.current; // 1.8kg
  const pct = Math.round(currentLoss / totalLoss * 100);
  const weeksLeft = SIMON.totalWeeks - SIMON.joinedWeek;
  return {
    pct,
    currentLoss: currentLoss.toFixed(1),
    targetLoss: totalLoss.toFixed(1),
    weeksLeft,
    weeksTotal: SIMON.totalWeeks,
    weeksDone: SIMON.joinedWeek
  };
}
