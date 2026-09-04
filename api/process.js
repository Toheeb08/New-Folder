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

    // Craft a mode-sensitive system prompt. For roast mode, instruct the model to produce
    // emotionally cutting and vividly metaphorical roasts while enforcing safety guards.
    let systemPrompt;
    if (isRoast) {
      systemPrompt = `You are "Roast vs Hype AI", a sharp-witted comedic assistant. RETURN ONLY A RAW JSON OBJECT and nothing else. For roast mode, produce a roast that still lands but uses lighter, less heavy English: prefer simple, conversational phrasing, short sentences, and gentle metaphors rather than intense emotional language. Aim for a clever sting that feels punchy without being graphic or deeply personal. Keep "headline" to 4-6 punchy words, "commentary" to 2-3 concise sentences with clear, easy-to-read wording, "statLabel" must be "${statLabel}", "statScore" a short score string (e.g. "9.8/10"), and "verdict" a single-sentence witty decree. IMPORTANT: do NOT include threats, hate, slurs, sexual content, instructions for self-harm, or targeted harassment of protected classes. Do not output any explanatory text, markdown, or code fences—only the JSON object with the exact keys: "headline","commentary","statLabel","statScore","verdict".`;
    } else {
      systemPrompt = `You are "Roast vs Hype AI", a comedic assistant. RETURN ONLY A RAW JSON OBJECT and nothing else. For hype mode, produce exuberant, over-the-top praise. Keep "headline" 4-6 words, "commentary" 2-3 sentences of grandiose hype, "statLabel" must be "${statLabel}", "statScore" a short score string, and "verdict" a single-sentence celebratory decree. Do not include extra text, markdown, or code fences.`;
    }

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
