const modeToggle = document.getElementById('modeToggle');
const submitBtn = document.getElementById('submitBtn');
const targetInput = document.getElementById('target');
const spinner = document.getElementById('spinner');
const resultWrap = document.getElementById('resultWrap');
const badge = document.getElementById('badge');
const stat = document.getElementById('stat');
const statScoreEl = document.getElementById('statScore');
const headlineEl = document.getElementById('headline');
const commentaryEl = document.getElementById('commentary');
const verdictEl = document.getElementById('verdict');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const card = document.getElementById('card');

let mode = 'roast';

function updateModeUI() {
  document.body.classList.toggle('mode-roast', mode === 'roast');
  document.body.classList.toggle('mode-hype', mode === 'hype');
  if (mode === 'roast') {
    modeToggle.textContent = '🔥 Savage Roast';
    badge.textContent = '🔥 Roast';
  } else {
    modeToggle.textContent = '👑 God-Tier Hype';
    badge.textContent = '👑 Hype';
  }
}

modeToggle.addEventListener('click', () => {
  mode = mode === 'roast' ? 'hype' : 'roast';
  updateModeUI();
});

async function handleSubmit() {
  const target = targetInput.value.trim();
  if (!target) return targetInput.focus();

  spinner.style.display = 'inline-block';
  submitBtn.disabled = true;
  resultWrap.classList.add('hidden');

  try {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, mode })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    renderResult(data);
  } catch (err) {
    alert('Error: ' + (err.message || err));
  } finally {
    spinner.style.display = 'none';
    submitBtn.disabled = false;
  }
}

function renderResult(data) {
  stat.textContent = `${data.statLabel}: `;
  statScoreEl.textContent = data.statScore || '—';
  headlineEl.textContent = data.headline || '—';
  commentaryEl.textContent = data.commentary || '—';
  verdictEl.textContent = data.verdict || '—';
  resultWrap.classList.remove('hidden');
}

submitBtn.addEventListener('click', handleSubmit);
targetInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
});

copyBtn.addEventListener('click', async () => {
  const text = `${headlineEl.textContent}\n\n${commentaryEl.textContent}\n\n${stat.textContent} ${statScoreEl.textContent}\n\n${verdictEl.textContent}`;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy Text'), 1500);
  } catch (err) {
    alert('Unable to copy');
  }
});

downloadBtn.addEventListener('click', async () => {
  try {
    const canvas = await html2canvas(card, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `roast-vs-hype-${mode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert('Failed to generate image');
  }
});

// initialize
updateModeUI();
