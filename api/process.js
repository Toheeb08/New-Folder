export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // body may be parsed by platform or need to be read
    const body = req.body && Object.keys(req.body).length ? req.body : await new Promise((r) => {
      let data = '';
      req.on && req.on('data', (chunk) => (data += chunk));
      req.on && req.on('end', () => {
        try { r(JSON.parse(data)); } catch (e) { r({}); }
      });
    });

    const target = body.target && String(body.target).trim();
    const mode = body.mode && String(body.mode).trim().toLowerCase();

    if (!target || !mode || !['roast', 'hype'].includes(mode)) {
      res.status(400).json({ error: 'Request must include `target` and `mode` (roast|hype)' });
      return;
    }

    const GMICLOUD_API_KEY = process.env.GMICLOUD_API_KEY;
    if (!GMICLOUD_API_KEY) {
      res.status(500).json({ error: 'Missing GMICLOUD_API_KEY in environment' });
      return;
    }

    const isRoast = mode === 'roast';
    const statLabel = isRoast ? 'Damage Level' : 'Aura Level';

    const systemPrompt = `You are "Roast vs Hype AI", a comedic assistant. Return ONLY a raw JSON object and nothing else. Do NOT include any explanatory text, markdown, or code fences. The JSON must have these keys exactly: \n- "headline": a 4-6 word punchy title string.\n- "commentary": 2-3 sentence roast or hype.\n- "statLabel": either \"${statLabel}\".\n- "statScore": a short score string (examples: \"9.8/10\" or \"+9,999,999\").\n- "verdict": a 1-sentence funny diagnosis or decree.\nMake responses concise, clever, and in-language of the target. Do not output any additional keys.`;

    const userPrompt = `Target: ${target}\nMode: ${mode}\nRespond only with the JSON object described.`;

    const payload = {
      model: 'MiniMaxAI/MiniMax-M3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 400
    };

    const response = await fetch('https://api.gmi-serving.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GMICLOUD_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      res.status(response.status).json({ error: 'Upstream error', details: text });
      return;
    }

    const data = await response.json().catch(() => null);
    const content = (data && (data.choices?.[0]?.message?.content || data.choices?.[0]?.text)) || JSON.stringify(data) || '';

    // Strip markdown backticks and fences
    let cleaned = String(content).replace(/```+/g, '').replace(/`+/g, '').trim();

    // Extract first JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'Model did not return JSON', raw: cleaned });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      // try to recover common issues like trailing commas
      try {
        const relaxed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
        parsed = JSON.parse(relaxed);
      } catch (err2) {
        res.status(500).json({ error: 'Failed to parse JSON from model', raw: jsonMatch[0] });
        return;
      }
    }

    // Enforce required keys and fill defaults if necessary
    const result = {
      headline: parsed.headline || '',
      commentary: parsed.commentary || '',
      statLabel: parsed.statLabel || statLabel,
      statScore: parsed.statScore || '',
      verdict: parsed.verdict || ''
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
}
