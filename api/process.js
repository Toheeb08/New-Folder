export function buildGeminiRequest({ apiKey, systemPrompt, userPrompt }) {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 400,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            headline: { type: 'STRING' },
            commentary: { type: 'STRING' },
            statLabel: { type: 'STRING' },
            statScore: { type: 'STRING' },
            verdict: { type: 'STRING' }
          },
          required: ['headline', 'commentary', 'statLabel', 'statScore', 'verdict']
        }
      }
    })
  };
}

export function extractGeminiText(data) {
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    ?.filter(Boolean)
    ?.join('') || '';

  return text;
}

export function parseGeminiJsonOutput(content, fallback = { statLabel: 'Aura Level', statScore: '—', verdict: '—' }) {
  const cleaned = String(content || '').replace(/```+/g, '').replace(/`+/g, '').trim();
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  let candidate = null;
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
    candidate = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  const attempts = [];
  if (candidate) {
    attempts.push(candidate);
    attempts.push(candidate.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']'));
    attempts.push(candidate.replace(/([{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3'));
    attempts.push(candidate.replace(/\n/g, ' '));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // continue trying
    }
  }

  const looseMatch = cleaned.match(/"headline"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  const commentaryMatch = cleaned.match(/"commentary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  const statLabelMatch = cleaned.match(/"statLabel"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  const statScoreMatch = cleaned.match(/"statScore"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  const verdictMatch = cleaned.match(/"verdict"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);

  const partial = {
    headline: looseMatch?.[1] || fallback.headline || '',
    commentary: commentaryMatch?.[1] || fallback.commentary || '',
    statLabel: statLabelMatch?.[1] || fallback.statLabel || '',
    statScore: statScoreMatch?.[1] || fallback.statScore || '',
    verdict: verdictMatch?.[1] || fallback.verdict || ''
  };

  if (!partial.statLabel && fallback.statLabel) partial.statLabel = fallback.statLabel;
  if (!partial.statScore && fallback.statScore) partial.statScore = fallback.statScore;
  if (!partial.verdict && fallback.verdict) partial.verdict = fallback.verdict;

  return Object.values(partial).some(Boolean) ? partial : null;
}

export function buildFallbackResult({ target, mode, statLabel }) {
  const isRoast = mode === 'roast';
  const displayTarget = String(target || 'this idea').trim();

  if (isRoast) {
    return {
      headline: `${displayTarget} Needs a Timeout`,
      commentary: `This one keeps talking like it is the main event, but the room is already checking out. It has big energy, very little polish, and a lot of noise with no real bite.`,
      statLabel: statLabel,
      statScore: '8.6/10',
      verdict: `${displayTarget} is loud, messy, and still somehow memorable.`
    };
  }

  return {
    headline: `${displayTarget} Is Peak Energy`,
    commentary: `This is the kind of move that turns a normal concept into a full-blown moment. It has vision, swagger, and the kind of confidence that makes people stop and pay attention.`,
    statLabel: statLabel,
    statScore: '9.7/10',
    verdict: `${displayTarget} is basically the main character of the entire room.`
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

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

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GMICLOUD_API_KEY;
    if (!GEMINI_API_KEY) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY in environment' });
      return;
    }

    const isRoast = mode === 'roast';
    const statLabel = isRoast ? 'Damage Level' : 'Aura Level';

    let systemPrompt;
    if (isRoast) {
      systemPrompt = `You are "Roast vs Hype AI", a sharp-witted comedic assistant. RETURN ONLY A RAW JSON OBJECT and nothing else. For roast mode, produce a roast that still lands but uses lighter, less heavy English: prefer simple, conversational phrasing, short sentences, and gentle metaphors rather than intense emotional language. Aim for a clever sting that feels punchy without being graphic or deeply personal. Keep "headline" to 4-6 punchy words, "commentary" to 2-3 concise sentences with clear, easy-to-read wording, "statLabel" must be "${statLabel}", "statScore" a short score string (e.g. "9.8/10"), and "verdict" a single-sentence witty decree. IMPORTANT: do NOT include threats, hate, slurs, sexual content, instructions for self-harm, or targeted harassment of protected classes. Do not output any explanatory text, markdown, or code fences—only the JSON object with the exact keys: "headline","commentary","statLabel","statScore","verdict".`;
    } else {
      systemPrompt = `You are "Roast vs Hype AI", a comedic assistant. RETURN ONLY A RAW JSON OBJECT and nothing else. For hype mode, produce exuberant, over-the-top praise. Keep "headline" 4-6 words, "commentary" 2-3 sentences of grandiose hype, "statLabel" must be "${statLabel}", "statScore" a short score string, and "verdict" a single-sentence celebratory decree. Do not include extra text, markdown, or code fences.`;
    }

    const userPrompt = `Target: ${target}\nMode: ${mode}\nRespond only with the JSON object described.`;
    const request = buildGeminiRequest({ apiKey: GEMINI_API_KEY, systemPrompt, userPrompt });

    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      res.status(response.status).json({ error: 'Upstream error', details: text });
      return;
    }

    const data = await response.json().catch(() => null);
    const content = extractGeminiText(data) || JSON.stringify(data) || '';
    const parsed = parseGeminiJsonOutput(content, { statLabel, statScore: '—', verdict: '—' });

    const fallback = buildFallbackResult({ target, mode, statLabel });
    const result = {
      headline: parsed?.headline || fallback.headline,
      commentary: parsed?.commentary || fallback.commentary,
      statLabel: parsed?.statLabel || statLabel,
      statScore: parsed?.statScore || fallback.statScore,
      verdict: parsed?.verdict || fallback.verdict
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
}
