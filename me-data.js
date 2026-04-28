// Simon's personalized Mana data
// All data is plausible based on a real recomp journey (Week 3 of 12)
// Swap with real Mana backend output when ready

const SIMON = {
  name: "Simon",
  avatar: "S",
  joinedWeek: 3,
  totalWeeks: 12,
  goalLabel: "增肌 + 减脂 (Recomp)",
  weeklyFocus: "Week 3 / 12 · 微赤字 + 力量训练 + 蛋白拉到 200g",
  todayDate: "2026-04-28",
  todayDayOfWeek: "周一",

  // Body composition: start → current → target
  body: {
    weight: {
      start: 75.0,
      current: 73.2,
      target: 71.5,
      unit: "kg",
      // 8-week trend (current week is week 3, so 3 data points + projection)
      history: [75.0, 74.4, 73.7, 73.2], // weeks 0, 1, 2, 3
      projection: [73.2, 72.8, 72.4, 72.0, 71.7, 71.5, 71.3, 71.0, 70.8] // weeks 3-11
    },
    bodyFat: {
      start: 19.5,
      current: 17.8,
      target: 14.0,
      unit: "%",
      history: [19.5, 19.0, 18.4, 17.8],
      projection: [17.8, 17.3, 16.8, 16.3, 15.8, 15.3, 14.8, 14.4, 14.0]
    },
    leanMass: {
      start: 60.4,
      current: 60.2,
      target: 61.5,
      unit: "kg",
      history: [60.4, 60.3, 60.2, 60.2],
      projection: [60.2, 60.4, 60.6, 60.8, 61.0, 61.1, 61.2, 61.3, 61.5]
    }
  },

  // Today's context that drives the plan
  todayContext: {
    lastNightSleep: 7.2,
    lastNightHRV: 58,
    hrvBaseline: 62,
    todayTrainingType: "Pull (背 + 二头)",
    weekTrainingDone: 2, // 2 of 4 sessions done so far
    weekProteinAvg: 198,
    proteinTarget: 200
  },

  // Today's schedule (the Navigator's output for today)
  schedule: [
    {
      time: "06:00", icon: "☀️", what: "起床 · 500ml 水 + 黑咖啡",
      detail: "空腹 30 min 启动代谢",
      agent: "导航员",
      why: "咖啡因 + 空腹状态 — 咖啡因促进脂肪酸释放，空腹让身体优先用脂肪供能。这是 recomp 早晨的代谢窗口。"
    },
    {
      time: "07:00", icon: "🍳", what: "早餐 · 3 鸡蛋 + 燕麦 60g + 蓝莓 + 花生酱 1 勺",
      detail: "450 大卡 · 35g 蛋白",
      agent: "饮食 Agent",
      why: "今天目标 200g 蛋白 (1g/磅)。早餐 35g 是分散摄入策略 — 一次摄入 30g 以上肌肉合成边际效益开始下降。"
    },
    {
      time: "10:00", icon: "🥤", what: "加餐 · 乳清蛋白 1 勺 + 苹果",
      detail: "180 大卡 · 24g 蛋白",
      agent: "饮食 Agent",
      why: "上午到中午之间不掉链子。乳清蛋白 30 分钟达峰，适合训练日的'夹缝补给'。"
    },
    {
      time: "12:30", icon: "🥩", what: "午餐 · 瘦牛肉 150g + 紫米饭 150g + 牛油果半个 + 大份蔬菜",
      detail: "600 大卡 · 45g 蛋白",
      agent: "饮食 Agent",
      why: "Recomp 午餐黄金组合：复合碳水 + 健康脂肪 + 高蛋白。瘦牛肉的肌酸 + 锌 + B12 对力量训练特别重要。"
    },
    {
      time: "15:00", icon: "🥜", what: "训练前 · 鸡胸 1 片 + 杏仁一把",
      detail: "180 大卡 · 30g 蛋白",
      agent: "饮食 Agent",
      why: "训练前 2.5 小时的'训练前餐' — 蛋白 + 慢碳水给训练能量。"
    },
    {
      time: "17:30", icon: "💪", what: "Pull · 引体 / 划船 / 硬拉 / 二头 × 4 组",
      detail: "渐进超负荷：硬拉比上周多 2.5kg",
      agent: "运动 Agent",
      why: "今天是 pull day（昨天 push）。复合动作 + 渐进超负荷 = 增肌的核心。HRV 58 略低于基线 62，但仍在可训练区间。",
      highlight: true
    },
    {
      time: "19:00", icon: "🍱", what: "训练后晚餐 · 鸡胸 150g + 紫米饭 200g + 西兰花",
      detail: "650 大卡 · 50g 蛋白",
      agent: "饮食 Agent",
      why: "训练后 1 小时内吃 — 蛋白合成的窗口期。米饭量不要怕，你刚消耗了大量肌糖原。"
    },
    {
      time: "21:00", icon: "🥛", what: "睡前蛋白 · 希腊酸奶（或酪蛋白 1 勺）",
      detail: "150 大卡 · 25g 蛋白",
      agent: "饮食 Agent",
      why: "酪蛋白慢释放 — 给身体睡觉时合成肌肉的原料。研究显示睡前 30g 酪蛋白可增加 22% 的肌肉合成率。"
    },
    {
      time: "22:30", icon: "🌙", what: "睡觉 · 目标 8 小时",
      detail: "昨晚 7.2h（略低于目标）— 今晚补回",
      agent: "睡眠 Agent",
      why: "睡眠不够再吃多蛋白也白搭 — 肌肉是睡出来的。深睡阶段生长激素分泌量是清醒时的 75 倍。",
      highlight: true
    }
  ],

  // The navigator's tradeoff line for today
  tradeoff: "今天 HRV 58（略低于基线 62）— 训练强度保持但不冒险加大重量。蛋白 200g 不可妥协。",

  // 7-day diet trend
  diet: {
    targetCalories: 2300,
    targetProtein: 200,
    targetCarbs: 230,
    targetFat: 75,
    today: { calories: 2210, protein: 184, carbs: 215, fat: 72 }, // partial day
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
      { time: "07:00", date: "今天", name: "早餐 · 鸡蛋燕麦", cal: 450, protein: 35, photo: "🍳" },
      { time: "12:30", date: "昨天", name: "午餐 · 牛肉紫米饭", cal: 620, protein: 47, photo: "🥩" },
      { time: "19:00", date: "昨天", name: "晚餐 · 鸡胸三文鱼", cal: 580, protein: 52, photo: "🐟" },
      { time: "21:00", date: "昨天", name: "睡前 · 希腊酸奶", cal: 150, protein: 25, photo: "🥛" },
      { time: "07:30", date: "昨天", name: "早餐 · 蛋白燕麦碗", cal: 480, protein: 38, photo: "🥣" }
    ]
  },

  // Exercise data
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
    // HRV trend last 14 days (baseline 62)
    hrv: [60, 63, 64, 62, 61, 65, 67, 64, 63, 61, 60, 58, 62, 58],
    strengthProgression: {
      // 8-week strength PRs
      squat: [85, 87.5, 90, 92.5, 95, 95, 97.5, 100],
      bench: [60, 60, 62.5, 62.5, 65, 65, 67.5, 67.5],
      deadlift: [110, 112.5, 115, 115, 117.5, 117.5, 117.5, 120]
    }
  },

  // Sleep data
  sleep: {
    lastNight: {
      duration: 7.2,
      target: 8,
      bedTime: "23:42",
      wakeTime: "06:54",
      quality: 78,
      stages: { deep: 1.4, rem: 1.8, light: 4.0 },
      hrv: 58,
      restingHR: 54
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
    avgDuration: 7.6,
    avgQuality: 82
  }
};
