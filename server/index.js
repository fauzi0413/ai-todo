// server/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Node 18+ sudah ada global fetch; kalau Node <18, aktifkan node-fetch:
// import fetch from 'node-fetch';

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---- Middleware dasar
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, '../data/tasks.json');

// =================== Storage JSON lokal ===================
async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try { await fs.access(DATA_FILE); }
  catch { await fs.writeFile(DATA_FILE, '[]', 'utf-8'); }
}

app.get('/api/health', (_req, res) => {
  const health = {
    ok: true,
    ts: Date.now(),
    watsonx: {
      configured: Boolean(process.env.WATSONX_AI_API_KEY && process.env.WATSONX_AI_PROJECT_ID),
      serviceUrl: process.env.WATSONX_AI_SERVICE_URL || 'https://us-south.ml.cloud.ibm.com',
      modelId: process.env.WATSONX_AI_MODEL_ID || 'ibm/granite-3-8b-instruct',
      version: '2024-05-31',
    }
  };
  res.json(health);
});

app.get('/api/tasks', async (_req, res) => {
  try {
    await ensureDataFile();
    const txt = await fs.readFile(DATA_FILE, 'utf-8');
    const tasks = JSON.parse(txt || '[]');
    res.json({ ok: true, tasks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'read_failed' });
  }
});

app.put('/api/tasks', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ ok: false, error: 'tasks_must_be_array' });
    }
    await ensureDataFile();
    await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
    res.json({ ok: true });
    // jadwalkan ulang setelah write; tidak blocking response
    scheduleAllFromFile();
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'write_failed' });
  }
});

// =================== IBM Granite via watsonx.ai ===================

// Konfigurasi dari ENV
const WATSONX_VERSION = '2024-05-31';
const WATSONX_SERVICE_URL = process.env.WATSONX_AI_SERVICE_URL || 'https://us-south.ml.cloud.ibm.com';
const WATSONX_API_KEY = process.env.WATSONX_AI_API_KEY || process.env.WATSONX_APIKEY; // jaga-jaga 2 nama
const PROJECT_ID = process.env.WATSONX_AI_PROJECT_ID;
const MODEL_ID = process.env.WATSONX_AI_MODEL_ID || 'ibm/granite-3-8b-instruct';

// Inisialisasi SDK hanya jika kredensial lengkap
let watsonx = null;
if (WATSONX_API_KEY && PROJECT_ID) {
  try {
    watsonx = WatsonXAI.newInstance({
      version: WATSONX_VERSION,
      serviceUrl: WATSONX_SERVICE_URL,
      authenticator: new IamAuthenticator({ apikey: WATSONX_API_KEY }),
    });
  } catch (e) {
    console.error('WatsonX init failed:', e);
  }
}

// Util: panggil model text-generation
async function genText(input, params = {}) {
  if (!watsonx) throw Object.assign(new Error('watsonx_not_configured'), { code: 'CONFIG' });
  try {
    const r = await watsonx.generateText({
      input,
      modelId: MODEL_ID,
      projectId: PROJECT_ID,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.2,
        ...params,
      },
    });
    const text = r?.result?.results?.[0]?.generated_text?.trim();
    if (!text) throw new Error('empty_generation');
    return text;
  } catch (e) {
    // Teruskan info error dari IBM bila ada
    const status = e?.status || e?.code || 'GEN_FAIL';
    console.error('watsonx.generateText error:', status, e?.message || e);
    throw e;
  }
}

// (Opsional) fallback minim kalau LLM belum siap
function naiveParse(text) {
  const t = (text || '').trim();
  if (!t) return null;
  // Priority heuristik
  let priority = 'medium';
  if (/\b(tinggi|urgent|mendesak|high)\b/i.test(t)) priority = 'high';
  if (/\b(rendah|low)\b/i.test(t)) priority = 'low';
  // Due date sederhana (format dd/mm/yyyy atau yyyy-mm-dd)
  const dateMatch = t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}\-\d{1,2}\-\d{1,2})/);
  let due = null;
  if (dateMatch) {
    const d = new Date(dateMatch[0].replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, '$3-$2-$1'));
    if (!isNaN(+d)) due = d.toISOString();
  }
  return { title: t, due, priority};
}

// =================== AI Parse Endpoint ===================

// --- Ambil jam dari teks Indonesia ---
function extractTimeFromText(text) {
  const s = (text || '').toLowerCase();

  // 1) Bentuk HH:MM atau H.MM
  let m = s.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (m) {
    let hh = +m[1], mm = +m[2];
    // sesuaikan AM/PM natural
    if (/\b(malam|sore|petang|pm|p\.m\.)\b/.test(s) && hh < 12) hh += 12;
    if (/\b(pagi|am|a\.m\.)\b/.test(s) && hh === 12) hh = 0;
    if (/\bsiang\b/.test(s) && hh < 12) hh = Math.max(hh, 12);
    return { hh, mm };
  }

  // 2) Bentuk "jam 7", opsional menit
  m = s.match(/\b(?:jam|pukul)\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (m) {
    let hh = +m[1], mm = m[2] ? +m[2] : 0;
    if (/\b(malam|sore|petang|pm|p\.m\.)\b/.test(s) && hh < 12) hh += 12;
    if (/\b(pagi|am|a\.m\.)\b/.test(s) && hh === 12) hh = 0;
    if (/\bsiang\b/.test(s) && hh < 12) hh = Math.max(hh, 12);
    return { hh, mm };
  }

  return null; // tidak ketemu jam
}

const DOW = { minggu:0, ahad:0, senin:1, selasa:2, rabu:3, kamis:4, jumat:5, "jum'at":5, sabtu:6 };

function nextDayOfWeek(from, targetIdx) {
  const d = new Date(from);
  const diff = ((targetIdx - d.getDay()) + 7) % 7 || 7; // selalu ke depan (bukan hari ini)
  d.setDate(d.getDate() + diff);
  return d;
}

function parseIndoDateTime(text) {
  const s = (text || '').toLowerCase();
  const now = new Date();

  const hasHariIni = /\bhari\s*ini\b/.test(s);
  const hasBesok   = /\b(besok|besuk)\b/.test(s);
  const hasLusa    = /\blusa\b/.test(s);

  // cari nama hari
  let targetIdx = null;
  for (const [name, idx] of Object.entries(DOW)) {
    if (new RegExp(`\\b${name}\\b`).test(s)) { targetIdx = idx; break; }
  }

  const addDays = (n) => { const d = new Date(now); d.setDate(d.getDate()+n); return d; };

  // --- pilih tanggal dasar ---
  let date = null;
  if (hasHariIni) {
    date = addDays(0);
  }

  if (targetIdx != null) {
    if (hasBesok) {
      const tomorrow = addDays(1);
      // kalau memang besok = hari yg disebut, pakai besok; kalau tidak, pakai next <hari>
      date = (tomorrow.getDay() === targetIdx) ? tomorrow : nextDayOfWeek(now, targetIdx);
    } else if (hasLusa) {
      const twoDays = addDays(2);
      date = (twoDays.getDay() === targetIdx) ? twoDays : nextDayOfWeek(now, targetIdx);
    } else if (!date) {
      date = nextDayOfWeek(now, targetIdx);
    }
  } else if (!date) {
    if (hasBesok)      date = addDays(1);
    else if (hasLusa)  date = addDays(2);
  }

  // --- jam ---
  const t = extractTimeFromText(text);   // {hh, mm} atau null
  if (!date && t) date = addDays(0);     // ada jam tapi tak ada hari → anggap hari ini

  if (date) {
    date.setSeconds(0,0);
    if (t) date.setHours(t.hh, t.mm); else date.setHours(9,0); // default 09:00
    return date.toISOString();
  }
  return null;
}


app.post('/api/ai/parse', async (req, res) => {
  try {
    // TERIMA input atau text agar kompatibel
    const raw = (req.body?.input ?? req.body?.text ?? '');
    const input = (typeof raw === 'string' ? raw : '').trim();

    if (!input) {
      return res.status(400).json({ ok: false, error: 'missing_input', message: 'Body harus punya field "input" (string tidak kosong).' });
    }

    // Prompt instruksi
    const prompt = `
      Ekstrak detail tugas dari kalimat berikut dan balas HANYA JSON valid.
      Field wajib:
      - "title": string
      - "due": ISO8601 (contoh "2025-08-28T19:00:00Z") atau null jika tidak jelas
      - "priority": salah satu dari ["low","medium","high"]
      Contoh:
      Kalimat: "rapat ekraf kamis jam 19:00"
      Jawaban: {"title":"rapat ekraf","due":"2025-08-28T19:00:00Z","priority":"medium"}
      Kalimat: ${input}
      `;

    let out;
    try {
      out = await genText(prompt, { temperature: 0.1 });
    } catch (e) {
      if (e?.code === 'CONFIG') {
        // Fallback kalau watsonx belum dikonfigurasi
        const data = naiveParse(input) ?? { title: input, due: null, priority: 'medium' };
        return res.status(503).json({
          ok: false,
          error: 'watsonx_not_configured',
          message: 'Watsonx tidak terkonfigurasi. Menggunakan fallback sederhana.',
          data
        });
      }
      // Error lain dari IBM → 502
      return res.status(502).json({ ok: false, error: 'watsonx_failed', message: String(e?.message || e) });
    }

    let data;
    try {
      data = JSON.parse(out);
    } catch {
      data = { title: input, due: null, priority: 'medium' };
    }

    // Normalisasi & default
    if (!data || typeof data !== 'object') data = {};
    const title = (data.title ?? input)?.toString()?.trim() || input.trim();

    let due = null;
    let dueObj = null;

    if (data.due) {
      const d = new Date(data.due);
      if (!isNaN(d)) { dueObj = d; }
    }

    // 1) Jika model tidak kasih due → coba tebak dari teks
    if (!dueObj) {
      const guessedISO = parseIndoDateTime(input);
      if (guessedISO) {
        dueObj = new Date(guessedISO);
      }
    }

    // 2) Jika due ada tapi jam masih 00:00, isi jam dari teks bila ada
    if (dueObj) {
      const hasMidnight = dueObj.getHours() === 0 && dueObj.getMinutes() === 0;
      const t = extractTimeFromText(input);
      if (hasMidnight && t) {
        dueObj.setHours(t.hh, t.mm, 0, 0);
      }
      due = dueObj.toISOString();
    }

    let priority = ['low','medium','high'].includes((data.priority || '').toLowerCase())
      ? data.priority.toLowerCase()
      : 'medium';

    data = { title, due, priority };

    return res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'ai_parse_failed', message: e?.message || 'unknown_error' });
  }
});

// =================== WhatsApp Cloud API ===================
const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WA_TO = process.env.WHATSAPP_TO;

async function sendWhatsAppText(text) {
  if (!WA_TOKEN || !WA_PHONE_ID || !WA_TO) {
    console.warn('WA env missing; skip send');
    return;
  }
  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: WA_TO,
      type: 'text',
      text: { body: text }
    })
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('WA send failed:', r.status, t);
  }
}

async function sendWhatsAppTemplate(title, dueLocal) {
  if (!WA_TOKEN || !WA_PHONE_ID || !WA_TO) return;
  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: WA_TO,
      type: 'template',
      template: {
        name: 'task_reminder',
        language: { code: 'id' },
        components: [
          { type: 'body', parameters: [
            { type: 'text', text: title },
            { type: 'text', text: dueLocal }
          ]}
        ]
      }
    })
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('WA template failed:', r.status, t);
  }
}

// =================== Scheduler ===================
const timers = new Map(); // idTask -> timeoutId

function clearTimers() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

function scheduleTaskReminder(task) {
  if (!task?.due || task.remindBeforeMinutes == null) return;
  const dueTs = new Date(task.due).getTime();
  if (isNaN(dueTs)) return;
  const remindAt = dueTs - (Number(task.remindBeforeMinutes) * 60 * 1000);
  const delay = remindAt - Date.now();
  if (delay <= 0) return; // sudah lewat

  if (timers.has(task.id)) { clearTimeout(timers.get(task.id)); timers.delete(task.id); }
  const timeoutId = setTimeout(async () => {
    const local = new Date(dueTs).toLocaleString();
    const title = task.title || 'Tugas';
    try { await sendWhatsAppTemplate(title, local); } catch {}
    await sendWhatsAppText(`⏰ Pengingat: "${title}"\nJatuh tempo: ${local}`);
    timers.delete(task.id);
  }, delay);
  timers.set(task.id, timeoutId);
}

async function scheduleAllFromFile() {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const tasks = JSON.parse(raw || '[]');
    clearTimers();
    for (const t of tasks) scheduleTaskReminder(t);
  } catch (e) {
    console.error('reschedule failed', e);
  }
}

// panggil saat server start
scheduleAllFromFile();

// rescan tiap menit agar robust
import cron from 'node-cron';
cron.schedule('* * * * *', () => scheduleAllFromFile());

// Start server
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
