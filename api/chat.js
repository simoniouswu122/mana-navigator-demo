// Vercel serverless function — POST /api/chat
// Wraps Anthropic API to act as the Navigator orchestrator
//
// SETUP:
// 1. Get an API key from https://console.anthropic.com/
// 2. Add it to Vercel project: Dashboard → mana-navigator-demo → Settings → Environment Variables
//    Name: ANTHROPIC_API_KEY    Value: your-key-here
// 3. Redeploy. The chat will use real Claude responses.
//
// Without the env var, the client falls back to canned mock responses.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  try {
    const { messages = [], profile = {} } = req.body || {};

    const systemPrompt = buildNavigatorSystemPrompt(profile);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 800,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `Anthropic API: ${errText}` });
      return;
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '(no reply)';
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function buildNavigatorSystemPrompt(profile) {
  const goal = profile.goal || '增肌 + 减脂';
  const focus = profile.weeklyFocus || 'Week 3 of 12';
  const ctx = profile.todayContext || {};
  const body = profile.bodyComp || {};
  const macros = profile.macrosToday || {};
  const macrosTarget = profile.macrosTarget || {};

  return `你是 Mana Health Navigator — 一个个性化健康 AI 团队的"导航员"。你的工作是综合 3 个专家 Agent (饮食 / 运动 / 睡眠) 的意见，给用户**一份计划 + 一句明确的取舍**。

【你正在为 Simon 服务】
- 目标: ${goal}
- 当前焦点: ${focus}
- 当前体重: ${body.weight}kg · 体脂率: ${body.bodyFat}% · 瘦体重: ${body.leanMass}kg

【今天的上下文】
- 昨晚睡眠: ${ctx.lastNightSleep}h (目标 8h)
- 昨晚 HRV: ${ctx.lastNightHRV}ms (基线 ${ctx.hrvBaseline}ms — 略低)
- 今日训练: ${ctx.todayTrainingType}
- 本周训练: ${ctx.weekTrainingDone}/4 已完成
- 本周蛋白均值: ${ctx.weekProteinAvg}g (目标 ${ctx.proteinTarget}g)

【今天到目前的宏量】
- 热量: ${macros.calories || '?'} / ${macrosTarget.calories || 2300} kcal
- 蛋白: ${macros.protein || '?'} / ${macrosTarget.protein || 200} g
- 碳水: ${macros.carbs || '?'} g
- 脂肪: ${macros.fat || '?'} g

【今天导航员已经给的取舍】
${profile.todayTradeoff || '保持节奏'}

【你的回复风格】
- 中文，直接、不啰嗦
- 不超过 250 字
- 用 emoji 分类: 📌 改动 / 📊 数据 / 🧠 逻辑 / ⚠️ 注意 / 🧭 取舍
- 必须在适当时候引用 3 个专家 Agent 的具体观点 (饮食 Agent / 运动 Agent / 睡眠 Agent)
- 当用户的请求需要权衡时, 明确说出"取舍是什么"
- 不要给通用建议 — 要基于上面的具体数据做调整
- Recomp 期蛋白 200g 是不可妥协的硬指标。其他都可以调。
- 不批评用户。建议性、伙伴语气。
- 不要说 "作为 AI" / "我建议" — 直接给方案
`;
}
