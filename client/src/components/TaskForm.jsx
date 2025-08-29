import { useState } from 'react'
import Swal from 'sweetalert2'

// === Helpers tanggal ===
function toISO(date, time){
  if(!date) return null
  const dt = new Date(`${date}T${time || '00:00'}`)
  return isNaN(dt) ? null : dt.toISOString()
}

// Senin sebagai awal minggu
function startOfWeekMonday(d){
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = base.getDay();           // 0=Min ... 6=Sab
  const diff = (dow + 6) % 7;          // jarak ke Senin
  base.setDate(base.getDate() - diff);
  base.setHours(0,0,0,0);
  return base;
}

// Parser lokal sederhana Bahasa Indonesia.
// Contoh yang didukung: "sabtu minggu depan", "kamis pekan depan", "senin depan", "jumat depan jam 9", "pukul 13.30"
function parseIndoRelative(input, now = new Date()){
  if (!input) return null;
  const txt = input.toLowerCase().trim();

  // hari -> index getDay()
  const hari = {
    'minggu':0, 'ahad':0,
    'senin':1,
    'selasa':2,
    'rabu':3,
    'kamis':4,
    'jumat':5, "jum'at":5, 'jum’' :5, // variasi apostrof
    'sabtu':6
  };

  // deteksi "minggu depan" / "pekan depan"
  const hasNextWeek = /\b(minggu|pekan)\s+depan\b/.test(txt);

  // deteksi pola "<hari> depan" (tanpa "minggu/pekan")
  // ex: "senin depan"
  const hariDepanMatch = txt.match(/\b(senin|selasa|rabu|kamis|jum(?:'?|’)at|sabtu|minggu|ahad)\s+depan\b/);

  // deteksi nama hari
  // Hati-hati: kata "minggu" bisa berarti hari Minggu *atau* "minggu depan" (unit minggu).
  // Kita ambil hari spesifik; kalau ada "minggu depan" + "minggu" tanpa "hari", jangan treat sebagai hari Minggu.
  let dayName = null;
  const dayMatch = txt.match(/\b(senin|selasa|rabu|kamis|jum(?:'?|’)at|sabtu|minggu|ahad)\b/);
  if (dayMatch) {
    const dn = dayMatch[1];
    // jika match-nya "minggu" tapi frasa juga punya "minggu depan" dan TIDAK eksplisit "hari minggu", abaikan sebagai hari
    const isUnitWeek = /\bminggu\s+depan\b/.test(txt) && !/\bhari\s+minggu\b/.test(txt);
    if (!(dn === 'minggu' && isUnitWeek)) {
      dayName = dn;
    }
  }

  // deteksi waktu: "jam 9", "pukul 9", "pkl 9", "pukul 13.30", "jam 7:15"
  let hh = 0, mm = 0;
  const tm = txt.match(/\b(?:jam|pukul|pkl)\s*(\d{1,2})(?::|\.?)(\d{2})?\b/);
  if (tm) {
    hh = Math.min(23, parseInt(tm[1],10));
    mm = Math.min(59, parseInt(tm[2] ?? '0',10));
  }

  // Aturan utama yang kamu minta:
  // "sabtu minggu depan" => hari Sabtu pada minggu berikutnya (berbasis Senin sebagai awal minggu)
  // "<hari> pekan depan" => sama seperti di atas
  // "<hari> depan" => hari itu pada minggu berikutnya juga (bukan occurrence terdekat)
  if ((hasNextWeek || hariDepanMatch) && dayName && hari[dayName] !== undefined) {
    const nextMonday = startOfWeekMonday(now);
    nextMonday.setDate(nextMonday.getDate() + 7); // minggu depan
    const targetDow = hari[dayName]; // 0..6 (Minggu..Sabtu)
    // offset dari Senin (1) ke targetDow:
    const offset = (targetDow + 6) % 7; // Senin=0, Selasa=1, ... Minggu=6
    const target = new Date(nextMonday);
    target.setDate(nextMonday.getDate() + offset);
    target.setHours(hh, mm, 0, 0);

    // format ke YYYY-MM-DD & HH:MM
    const pad = n => String(n).padStart(2,'0');
    const date = `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}`;
    const time = `${pad(target.getHours())}:${pad(target.getMinutes())}`;
    return { date, time, dueISO: target.toISOString() };
  }

  // Kalau tidak terdeteksi, kembalikan null
  return null;
}

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('medium')
  const DEFAULT_REMIND = 1440
  const [remindBefore, setRemindBefore] = useState(DEFAULT_REMIND)
  const [aiLoading, setAiLoading] = useState(false)

  async function add(e){
    e.preventDefault()
    const t = title.trim()
    if(!t){
      Swal.fire({ icon:'warning', title:'Judul masih kosong', text:'Isi dulu deskripsi tugasnya, ya.' })
      return
    }
    onAdd({
      id: crypto.randomUUID(),
      title: t,
      due: toISO(date, time),
      priority,
      done:false,
      pinned:false,
      createdAt: Date.now(),
      remindBeforeMinutes: (remindBefore >= 0 ? remindBefore : -1)
    })
    setTitle(''); setDate(''); setTime(''); setPriority('medium'); setRemindBefore(DEFAULT_REMIND)
  }

  async function autoFillFromAI() {
    if (!title.trim()) {
      Swal.fire({ icon:'info', title:'Tulis deskripsi dulu', text:'Contoh: “follow up vendor Jumat 15:00 prioritas tinggi”.' })
      return
    }

    // 1) Coba parser lokal dulu (prioritaskan aturan "sabtu minggu depan" dkk)
    const local = parseIndoRelative(title, new Date())
    if (local?.dueISO) {
      // update form & langsung tambahkan
      setDate(local.date); setTime(local.time);
      const t = title.trim();
      onAdd({
        id: crypto.randomUUID(),
        title: t,
        due: local.dueISO,
        priority,
        done:false,
        pinned:false,
        createdAt: Date.now(),
        remindBeforeMinutes: (remindBefore >= 0 ? remindBefore : -1)
      });
      setTitle(''); setDate(''); setTime(''); setPriority('medium'); setRemindBefore(DEFAULT_REMIND);
      return;
    }

    // 2) Jika parser lokal tidak mengenali, baru panggil server AI
    setAiLoading(true)
    try {
      const r = await fetch('/api/ai/parse', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ input: title })
      })
      if (!r.ok) throw new Error(`Server AI mengembalikan ${r.status}`)

      const res = await r.json()
      const s = res?.data || res?.suggestion || res || {}

      const nextTitle = (s.title || title).trim()
      const iso = s.due || s.dueISO || s.datetimeISO || s.datetime
      let nextDate = '', nextTime = ''
      if (iso) {
        const d = new Date(iso)
        if (!isNaN(d)) {
          const pad = n => String(n).padStart(2,'0')
          nextDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
          nextTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`
        }
      } else {
        nextDate = s.date || ''
        nextTime = s.time || ''
      }
      const nextPriority = s.priority || 'medium'
      const nextRemind = (typeof s.remindBeforeMinutes === 'number') ? s.remindBeforeMinutes : remindBefore

      // Isi form dan langsung tambahkan
      setTitle(nextTitle); setDate(nextDate); setTime(nextTime); setPriority(nextPriority); setRemindBefore(nextRemind)
      onAdd({
        id: crypto.randomUUID(),
        title: nextTitle,
        due: toISO(nextDate, nextTime),
        priority: nextPriority,
        done:false,
        pinned:false,
        createdAt: Date.now(),
        remindBeforeMinutes: (nextRemind >= 0 ? nextRemind : -1)
      })

      setTitle(''); setDate(''); setTime(''); setPriority('medium'); setRemindBefore(DEFAULT_REMIND)
    } catch (e) {
      console.error(e)
      Swal.fire({ icon:'error', title:'Isi Otomatis gagal', text:'Pastikan server lokal aktif.', footer: String(e?.message || e) })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <form onSubmit={add} className="grid gap-3">
      {/* input utama: di mobile 1 kolom, ≥sm jadi 3 kolom */}
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          className="input"
          placeholder="Judul / deskripsi tugas"
          value={title}
          onChange={e=>setTitle(e.target.value)}
        />
        <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} />
        <input type="time" className="input" value={time} onChange={e=>setTime(e.target.value)} />
      </div>

      {/* baris kontrol: wrap + tombol full width di mobile */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <select className="input w-full sm:w-[200px]" value={priority} onChange={e=>setPriority(e.target.value)}>
          <option value="high">Prioritas tinggi</option>
          <option value="medium">Prioritas sedang</option>
          <option value="low">Prioritas rendah</option>
        </select>

        <select className="input w-full sm:w-[220px]" value={remindBefore} onChange={e=>setRemindBefore(Number(e.target.value))}>
          <option value={-1}>Pengingat: Tidak ada</option>
          <option value={5}>Pengingat: 5 menit sebelum</option>
          <option value={15}>Pengingat: 15 menit sebelum</option>
          <option value={30}>Pengingat: 30 menit sebelum</option>
          <option value={60}>Pengingat: 1 jam sebelum</option>
          <option value={1440}>Pengingat: 1 hari sebelum</option>
        </select>

        <div className="flex gap-2 w-full sm:w-auto">
          <button type="submit" className="btn-solid btn-blue w-full sm:w-auto">Tambah</button>

          <button
            type="button"
            onClick={autoFillFromAI}
            disabled={aiLoading}
            className="btn-solid btn-amber disabled:opacity-70 w-full sm:w-auto"
          >
            {aiLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner"></span> Memproses…
              </span>
            ) : 'Isi Otomatis (AI)'}
          </button>
        </div>
      </div>
    </form>
  )
}
