exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
      body: JSON.stringify({ error: 'OPENAI_API_KEY not configured in Netlify environment variables.' }),
    };
  }

  let meal;
  try {
    ({ meal } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!meal || typeof meal !== 'string' || meal.length > 1000) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'Invalid meal input' }) };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: 'You are a nutrition expert. Respond ONLY with raw JSON — no markdown, no code fences, no explanation.',
          },
          {
            role: 'user',
            content: `Estimate nutrition for: "${meal}"\n\nReturn exactly this JSON shape:\n{"name":"short meal label","calories":number,"protein":number,"carbs":number,"fat":number,"note":"one tip under 60 chars"}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('OpenAI error:', txt);
      return { statusCode: 502, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: 'OpenAI API error', detail: txt }) };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '{}';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    JSON.parse(clean); // validate

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...cors }, body: clean };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ error: err.message }) };
  }
};
