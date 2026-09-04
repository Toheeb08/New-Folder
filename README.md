# Roast vs Hype AI — Local Development

Quick steps to run locally (no Vercel required):

1. Install dependencies:

```bash
npm install express dotenv
```

2. Add your Gemini API key to `.env`:

```ini
GEMINI_API_KEY=your_real_key_here
```

3. Start the local server:

```bash
npm run dev
```

4. Open http://localhost:3000 in your browser.

Notes:
- The Express server in `server.js` mounts the Vercel-style function at `/api/process` so frontend requests work unchanged.
- For production deploy to Vercel, set `GEMINI_API_KEY` in the environment variables and deploy the repo — Vercel will use the existing `api/process.js` as a serverless function.
