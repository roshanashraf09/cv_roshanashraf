exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { type } = body;
  let system, user, maxTokens = 250;

  // ── MEAL ANALYSIS ──
  if (type === 'meal') {
    const { meal } = body;
    if (!meal || typeof meal !== 'string' || meal.length > 1000)
      return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Invalid meal' }) };
    system = 'You are a nutrition expert. Respond ONLY with raw JSON — no markdown, no code fences, no explanation.';
    user   = `Estimate nutrition for: "${meal}"\n\nReturn exactly: {"name":"short meal label","calories":number,"protein":number,"carbs":number,"fat":number,"note":"one useful tip under 60 chars"}`;
    maxTokens = 200;

  // ── AI MACRO GOALS ──
  } else if (type === 'goals') {
    const { currentWeight, goalWeight, targetDate, age, sex, height, activity } = body;
    if (!currentWeight || !goalWeight || !targetDate || !age || !height)
      return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Missing profile fields' }) };

    const daysLeft  = Math.max(7, Math.round((new Date(targetDate) - new Date()) / 86400000));
    const weightDiff = (parseFloat(currentWeight) - parseFloat(goalWeight)).toFixed(1);

    system = 'You are a certified sports nutritionist. Respond ONLY with raw JSON — no markdown, no code fences.';
    user   = `Calculate personalised daily macro targets for a cutting plan:
- Current: ${currentWeight}kg → Goal: ${goalWeight}kg (lose ${weightDiff}kg)
- Timeframe: ${daysLeft} days
- Age: ${age}, Sex: ${sex}, Height: ${height}cm, Activity multiplier: ${activity}

Use Mifflin-St Jeor for BMR × activity for TDEE. Create a sensible calorie deficit (max −750 kcal/day). Set protein ≈ 2.2g/kg of goal bodyweight. Fill remaining calories: ~45% carbs, ~25% fat.

Return exactly: {"dailyCalories":number,"protein":number,"carbs":number,"fat":number,"weeklyLoss":number,"tdee":number,"note":"brief strategy note max 90 chars"}`;
    maxTokens = 280;

  // ── TOMORROW'S SUGGESTION ──
  } else if (type === 'suggest') {
    const { todayMacros, profile, currentWeight } = body;
    if (!todayMacros || !profile)
      return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Missing data' }) };

    const { goalWeight, goalDate, targetCalories, targetProtein } = profile;
    const daysLeft = goalDate ? Math.max(1, Math.round((new Date(goalDate) - new Date()) / 86400000)) : '?';
    const calDiff  = (todayMacros.calories || 0) - (targetCalories || 2000);

    system = 'You are a precision nutrition coach. Respond ONLY with raw JSON — no markdown, no code fences.';
    user   = `Analyse today's food log and produce tomorrow's eating plan.

Today's intake: ${todayMacros.calories} kcal | ${todayMacros.protein}g protein | ${todayMacros.carbs}g carbs | ${todayMacros.fat}g fat
Daily targets:  ${targetCalories} kcal | ${targetProtein}g protein
Calorie difference vs target today: ${calDiff > 0 ? '+' : ''}${calDiff} kcal
Current weight: ${currentWeight}kg → Goal: ${goalWeight}kg in ${daysLeft} days

Return exactly: {"status":"on_track|slightly_over|slightly_under|significantly_over|significantly_under","tomorrowCalories":number,"tomorrowProtein":number,"tip1":"specific actionable tip","tip2":"specific actionable tip","tip3":"specific actionable tip","summary":"1-sentence assessment under 100 chars"}`;
    maxTokens = 350;

  } else {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Unknown type' }) };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });

    if (!res.ok) {
      const t = await res.text();
      return { statusCode: 502, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: t }) };
    }

    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || '{}';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    JSON.parse(clean);

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...cors }, body: clean };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: err.message }) };
  }
};
