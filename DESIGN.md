# Mana Navigator · Design Doc

> **Status:** v0 — agreed core decisions, building out IA next
> **Last updated:** 2026-04-28

---

## 一句话承诺

**Mana 是把你身体数据 + 你行为数据整合成一份**实时调整的**每日计划的 AI 团队。**

它不是聊天 AI、不是热量追踪器、不是健身 App——它是这三者中间空缺的、**把它们连起来的导航层**。

---

## North star + leading indicator

| 角色 | 指标 | 在产品里怎么体现 |
|---|---|---|
| **North star** | **Outcome**: 用户达成目标 (减脂 / 增肌 / PR / 等) | 12 周轨迹图 · 体重 / 体脂 / 瘦体重的"起点 → 现在 → 目标" |
| **Leading indicator** | **Compliance**: 今天有没有跟着计划走 | 每个屏幕的右上角一个 compliance score · 跨周 streak |
| Downstream（不主动优化） | 健康知识 (Literacy) | 每条建议的"为什么"解释 — 自然涌现 |
| Downstream（不主动优化） | 焦虑减少 (Emotional) | "你不是没瘦"类共情消息 — 自然涌现 |

**含义:** 任何 feature 必须能回答 "这能帮用户达成 outcome 吗？" 或 "这能提升 compliance 吗？" 否则不做。

---

## 6 个核心决定（已锁定）

| # | 决定 | 含义 |
|---|---|---|
| 1 | **Primary moment**: 全天候 — 接住偏离 + 实时调整 | 不是 "9am briefing app" — 是 ambient companion. 用户每次打开都看到当前状态 vs 计划 |
| 2 | **Audience**: Simon 自用 (private) + 公共模板 (public) | `/me` 是 Simon 自己用 + 给别人看 "你的版本会这样". 后期加 sign-up |
| 3 | **Chat 的工作**: Coach + 调整 + **能真的改写日程** | 用户对话能让 timeline 实时变化. 不是聊完 done — 聊完 schedule 已经更新了 |
| 4 | **Data sources**: 穿戴 (body) + Mana 后端 (behavior) | Apple Watch / Whoop / Oura → HRV / 睡眠 / 心率. Mana 后端 → 餐食照片 / 结构化食物 / Agent 编排 |
| 5 | **North star**: Outcome (body comp / performance) | 不优化 literacy / emotional 直接, 但必须服务 outcome |
| 6 | **Leading indicator**: Compliance (今天跟着计划走) | 每个屏幕都有可见的 compliance signal |

---

## 我们明确不做

- ❌ **不是热量追踪器** — MyFitnessPal 已经做这个
- ❌ **不是训练 App** — Strong / Hevy 已经做这个
- ❌ **不是聊天 AI** — ChatGPT / 豆包 / Claude 已经做这个
- ❌ **不是社交 / 社区** — IG / 小红书 / 微博 已经做这个
- ❌ **不是食谱库 / 备餐服务** — 小红书 / 下厨房 / 各种菜谱 App
- ❌ **不是健身 KOL 平台** — B站 / YouTube
- ✅ **我们是**: 把身体数据 + 行为数据 → 一份实时调整的每日计划. 这中间没有人做.

---

## 核心交互（差异化的 4 件事）

这些是别人没做、我们必须做对的:

### 1. **Drift detection (偏离检测)**
- 计划说你 12:30 应该吃 600 大卡
- 实际：13:00 吃了 850 大卡（外卖 + 含糖饮料）
- **系统主动**说 "你超了 250 卡, 我把今天剩下的调整了"
- UI: Today 屏幕永远显示 "on track / 偏离 / 已调整"

### 2. **Chat-driven schedule mutation (对话改写日程)**
- 用户: "今晚出去吃饭, 改一下"
- 导航员: 给出新计划 + 解释 + **timeline 立即更新**
- 用户能看到 before/after 的对比

### 3. **Compliance signal 在每个屏幕**
- 不是隐藏在 settings — 是**第一眼**就看到
- 今日 compliance: 78% (蛋白拉满 / 运动完成 / 睡眠不足)
- 本周 streak: 4/7 天 fully compliant
- 让 compliance 成为用户能感受到的指标

### 4. **Body data + Behavior data 双线整合**
- 大部分 health App 只有一边（Apple 只有 body, MyFitnessPal 只有 behavior）
- 我们把两边在 Agent 层缝合
- 当 Sleep Agent 看到 HRV 低 → 它能告诉 Exercise Agent → 自动改训练 → 通知 Diet Agent → 自动改饮食
- 整套机制 visible 给用户看（可选展开）

---

## Information Architecture (rebuild target)

### 唯一的主屏幕: **Today (Live)**

不再是 "5 个 tab 平等". Today 是主屏幕, 其他是 drilldown.

```
┌─ Today ────────────────────────────────────────┐
│ 📊 Compliance: 78% on-track  · streak 4/7      │  ← always visible
│ 🎯 Outcome: -1.8kg / target -3.5kg (51% there)│
├────────────────────────────────────────────────┤
│ 🧭 Navigator: "今天 HRV 低, 训练保持但不加重量" │  ← tradeoff card
├────────────────────────────────────────────────┤
│ Now (16:42)                                    │
│ ├─ ✅ 早餐 (06:50) — 真的吃了 (照片)            │  ← past = compliance
│ ├─ ✅ 加餐 (10:15) — 真的吃了                   │
│ ├─ ⚠️ 午餐 (13:10) — 比计划晚 40 分钟+ 250 卡  │  ← drift caught
│ ├─ ⏳ 训练 (17:30) — 1h 后 [Pull day]           │  ← upcoming
│ ├─ ⏳ 晚餐 (19:00) — Diet Agent 已重算: 减 100 卡 │  ← auto-adjusted
│ └─ ⏳ 睡前蛋白 (21:00)                          │
├────────────────────────────────────────────────┤
│ [💬 跟导航员对话]  [📊 Diet]  [💪 Exercise] ... │
└────────────────────────────────────────────────┘
```

### Drilldowns (从 Today 进入, 不是平级 tab)

- **Diet** — 今日宏量进度 + 7 天趋势 + 最近餐食
- **Exercise** — 今日训练 + 周训练量 + HRV + 力量进展
- **Sleep** — 昨晚 + 7 天 + 质量分析
- **Progress** — 12 周轨迹 + 目标对比

每个都能从 Today 屏幕的"小卡片"点进去看更深的数据.

### Chat = floating, 永远可达

- 右下角浮动按钮
- 打开后右侧或底部弹出
- **能改 schedule** (这是关键)

---

## 数据流（locked but not built）

```
┌─────────────────┐         ┌──────────────────┐
│ Wearable data   │         │ Mana behavior    │
│ (HRV/sleep/HR)  │         │ (meal photos +   │
│ via HealthKit / │         │  food-print +    │
│ Whoop / Oura    │         │  Mana app data)  │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         └───────────┬───────────────┘
                     │
              ┌──────▼──────┐
              │ Agent layer │
              │ Diet / Ex / │
              │ Sleep / Nav │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  /me UI     │
              │  (today /   │
              │   chat /    │
              │   tabs)     │
              └─────────────┘
```

---

## 阶段化 (Phasing)

### v0.1 — 现在 (mock-but-real-feeling)
- ✅ 5 tab 已经 ship 了 (重构成 Today 为主)
- 🔨 重构 Today 为 "live state vs plan" 视图 (drift detection mock)
- 🔨 Chat-driven schedule mutation (chat 真的改 timeline)
- 🔨 Compliance signal 显示在 Today 顶部
- 🔨 Outcome card on Today (12 周轨迹缩略)
- ✅ Real Claude API 路由已就绪 (等 ANTHROPIC_API_KEY 配置)

### v0.2 — 真实数据
- **Apple HealthKit** 读取 (HRV / 睡眠 / 心率 / 活动) — 它会聚合 Whoop / Oura / 等
- food-print-analysis 后端连接 (Simon 已有)
- Mana 后端 events 流到 `/me`
- 顺序: HealthKit 第一 → Mana 后端第二

### v0.3 — 多用户
- **Supabase** auth + database (Postgres + RLS)
- 每个用户自己的 profile + agent prompts
- `/me` 变成 `/dashboard` (登录后), `/me` 保留为 demo template
- 真实部署 → 真实使用者

### v0.4+ (open)
- 跨天记忆 (Agent 记得你 3 周前说过的话)
- Proactive notifications (drift 触发主动消息)
- Evals (评估 Agent 输出质量, A/B 测试 prompt)

---

## Resolved decisions (2026-04-28)

| # | 问题 | 决定 |
|---|---|---|
| 1 | 第一个 wearable | **Apple HealthKit** — iOS 上能连 Whoop / Oura / 任何兼容设备, 一个集成点拿到所有 |
| 2 | Sign-up 方案 | **Supabase** (auth + Postgres + RLS, 一站式) |
| 3 | `/me` vs 3 demo persona | **都保留** — 现在 `/` 是 3 persona 内容创作版本, `/me` 是 Simon 真实使用版本. 后期可能完全分开成两个 deployment |
| 4 | 真名 + 真数据公开 | ✅ OK — Simon 真名 + 真实 body comp 数字 |
| 5 | Compliance 算法 | **简单加权**: 蛋白达标 + 训练完成 + 睡眠达目标. 三项各 33% 起步, 后期可细化 |
| 6 | Drift 检测阈值 | **默认 ±10% on-track / ±20% drift, 用户可自己调百分比** |
| 7 | Chat 改 schedule | **必须用户确认** — 显示"建议改成这样, 接受 / 拒绝", 不直接改 |
| 8 | `/me` 公开 vs gate | **公开 OK** (现在), 后期加 sign-up 之后才 gate |

---

## Definition of done · v0.1

`/me` 重构完成 = 以下全部成立:

- [ ] **Today 屏幕**显示 compliance score (top, 加权: 蛋白 + 训练 + 睡眠) 永远可见
- [ ] **Today 屏幕**显示 outcome 进度卡片 (12 周轨迹缩略, "51% 完成")
- [ ] **Timeline** 区分 4 种状态: ✅ 已完成 / ⚠️ drift / ⏳ 即将到来 / 🔄 已自动调整
- [ ] **Drift 检测** mock 一个 case (午餐 +250 卡 → 系统已重算晚餐 -100 卡)
- [ ] **Chat 改 schedule 流程**: 提议 → preview before/after → 用户接受/拒绝
- [ ] **Drilldown row** 在 Today 底部 (Diet/Exercise/Sleep/Progress 缩略卡, 点击进入详情)
- [ ] **Settings cog** (top right) 至少包含 drift threshold slider (默认 ±10/20, 用户可调)
- [ ] **8 open questions** 已全部 resolve, 写在 doc 里

---

## 工作流

1. Simon 读这个 doc, push back 任何 disagree 的部分
2. 至少回答 8 个 open questions 中的 3 个
3. 我根据 doc 重构 `/me` (建立 v0.1)
4. v0.1 ship 后, 我们再写 v0.2 的 design (wearable + Mana 后端连接)
5. 不再 build before designing
