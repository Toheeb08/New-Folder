import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import processHandler from './api/process.js';

dotenv.config();

const app = express();
app.use(express.json());

const __dirname = path.dirname(new URL(import.meta.url).pathname);

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/process', async (req, res) => {
  try {
    await processHandler(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Local server running on http://localhost:${port}`));
