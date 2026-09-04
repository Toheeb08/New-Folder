import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiRequest, extractGeminiText, parseGeminiJsonOutput, buildFallbackResult } from './process.js';

test('buildGeminiRequest includes Gemini API params', () => {
  const request = buildGeminiRequest({
    apiKey: 'test-key',
    systemPrompt: 'You are a roast bot.',
    userPrompt: 'Target: Bob\nMode: roast'
  });

  assert.equal(
    request.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=test-key'
  );

  const body = JSON.parse(request.body);
  assert.equal(body.system_instruction.parts[0].text, 'You are a roast bot.');
  assert.equal(body.contents[0].parts[0].text, 'Target: Bob\nMode: roast');
});

test('extractGeminiText reads the text from Gemini candidates', () => {
  const text = extractGeminiText({
    candidates: [{
      content: {
        parts: [{ text: '{"headline":"Big win","commentary":"Nice work"}' }]
      }
    }]
  });

  assert.equal(text, '{"headline":"Big win","commentary":"Nice work"}');
});

test('parseGeminiJsonOutput recovers partial JSON from truncated Gemini output', () => {
  const parsed = parseGeminiJsonOutput(
    '{"headline":"The Next Big Thing","commentary":"The future is electric"',
    { statLabel: 'Aura Level', statScore: '—', verdict: '—' }
  );

  assert.equal(parsed.headline, 'The Next Big Thing');
  assert.equal(parsed.commentary, 'The future is electric');
  assert.equal(parsed.statLabel, 'Aura Level');
});

test('buildFallbackResult supplies a usable result when Gemini is incomplete', () => {
  const result = buildFallbackResult({ target: 'OpenAI', mode: 'hype', statLabel: 'Aura Level' });

  assert.match(result.headline, /OpenAI/i);
  assert.match(result.commentary, /attention|energy|moment/i);
  assert.equal(result.statLabel, 'Aura Level');
  assert.match(result.statScore, /9\./);
});
