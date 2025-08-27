import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import OpenAI from 'openai';
import { put, list } from '@vercel/blob';

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== Blob JSON storage =====
const FILE_NAME = 'tasks.json';

async function ensureFileExists() {
  const { blobs } = await list({ prefix: FILE_NAME });
  if (!blobs.length) {
    await put(FILE_NAME, JSON.stringify([]), {
      access: 'public',
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false
    });
  }
}
async function readTasks() {
  await ensureFileExists();
  const url = `https://blob.vercel-storage.com/${FILE_NAME}`; // fallback (akan di-resolve otomatis oleh list()[0].url di produksi)
  const r = await fetch((await list({ prefix: FILE_NAME })).blobs[0].url, { cache: 'no-store' });
  return r.ok ? await r.json() : [];
}
async function writeTasks(tasks) {
  await put(FILE_NAME, JSON.stringify(tasks, null, 2), {
    access: 'public',
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false
  });
}

// ===== Routes Tasks =====
app.get('/api/tasks', async (_req, res) => {
  try { res.json({ ok:true, tasks: await readTasks() }); }
  catch (e) { console.error(e); res.status(500).json({ ok:false, error:'read_failed' }); }
});
app.put('/api/tasks', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ ok:false, error:'tasks_must_be_array' });
    await writeTasks(tasks);
    res.json({ ok:true });
  } catch (e) { console.error(e); res.status(500).json({ ok:false, error:'write_failed' }); }
});

// ===== AI Endpoints =====
app.post('/api/ai/parse', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error:'Missing input' });
    const system = `Ekstrak tugas dari kalimat natural. Balas JSON: {title, due, priority, tags[]}`;
    const resp = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role:'system', content:system }, { role:'user', content:`Kalimat: ${input}` }],
      temperature: 0.2
    });
    let data; try { data = JSON.parse(resp.output_text.trim()); } catch { data = { title: input, due:null, priority:'medium', tags:[] }; }
    res.json({ ok:true, data });
  } catch (e) { console.error(e); res.status(500).json({ error:'ai_parse_failed' }); }
});
app.post('/api/ai/suggest', async (req, res) => {
  try {
    const { goal } = req.body;
    if (!goal) return res.status(400).json({ error:'Missing goal' });
    const system = `Buat daftar tugas atomik untuk goal. JSON array of {title, priority, tags[]}`;
    const resp = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role:'system', content:system }, { role:'user', content:`Goal: ${goal}` }],
      temperature: 0.3
    });
    let data; try { data = JSON.parse(resp.output_text.trim()); } catch { data = []; }
    res.json({ ok:true, data });
  } catch (e) { console.error(e); res.status(500).json({ error:'ai_suggest_failed' }); }
});
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { tasks } = req.body;
    const system = `Ringkas status to-do list (≤80 kata) dalam Bahasa Indonesia.`;
    const resp = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role:'system', content:system }, { role:'user', content: JSON.stringify(tasks || []) }],
      temperature: 0.4
    });
    res.json({ ok:true, summary: resp.output_text.trim() });
  } catch (e) { console.error(e); res.status(500).json({ error:'ai_summarize_failed' }); }
});

export default serverless(app);
