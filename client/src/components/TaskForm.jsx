import { useState } from 'react'
import Swal from 'sweetalert2'

function toISO(date, time){
  if(!date) return null
  const dt = new Date(`${date}T${time || '00:00'}`)
  return isNaN(dt) ? null : dt.toISOString()
}

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState('medium')
  const menit = 1440
  const [remindBefore, setRemindBefore] = useState(menit) // menit
  const [aiLoading, setAiLoading] = useState(false)

  async function add(e){
    e.preventDefault()
    if(!title.trim()){
      Swal.fire({ icon:'warning', title:'Judul masih kosong', text:'Isi dulu deskripsi tugasnya, ya.' })
      return
    }
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      due: toISO(date,time),
      priority,
      done:false,
      pinned:false,
      createdAt: Date.now(),
      remindBeforeMinutes: (remindBefore >= 0 ? remindBefore : -1)
    })
    setTitle(''); setDate(''); setTime(''); setPriority('medium'); setRemindBefore(menit);
  }

  async function autoFillFromAI() {
    if (!title.trim()) {
      Swal.fire({ icon:'info', title:'Tulis deskripsi dulu', text:'Contoh: “follow up vendor Jumat 15:00 prioritas tinggi”.' })
      return
    }
    setAiLoading(true)
    try {
      const r = await fetch('/api/ai/parse', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ input: title })
      })
      if (!r.ok) throw new Error(`Server AI mengembalikan ${r.status}`)

      const resJson = await r.json()
      const s = resJson?.data || resJson?.suggestion || resJson || {}

      // siapkan nilai
      const nextTitle = s.title || title
      const iso = s.due || s.dueISO || s.datetimeISO || s.datetime
      let nextDate = '', nextTime = ''
      if (iso) {
        const d = new Date(iso)
        if (!isNaN(d)) {
          const pad = n => String(n).padStart(2,'0')
          nextDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`  // YYYY-MM-DD (lokal)
          nextTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`                    // HH:MM (lokal)
        }
      } else {
        nextDate = s.date || ''
        nextTime = s.time || ''
      }
      const nextPriority = s.priority || 'medium'
      const nextRemind = (typeof s.remindBeforeMinutes === 'number') ? s.remindBeforeMinutes : remindBefore

      // isi form (biar UI-nya kebaru)
      setTitle(nextTitle)
      setDate(nextDate)
      setTime(nextTime)
      setPriority(nextPriority)
      setRemindBefore(nextRemind)

      // === LANGSUNG TAMBAHKAN ITEM ===
      const toISO = (date, time) => {
        if(!date) return null
        const dt = new Date(`${date}T${time || '00:00'}`)
        return isNaN(dt) ? null : dt.toISOString()
      }
      onAdd({
        id: crypto.randomUUID(),
        title: nextTitle.trim(),
        due: toISO(nextDate, nextTime),
        priority: nextPriority,
        done:false,
        pinned:false,
        createdAt: Date.now(),
        remindBeforeMinutes: (nextRemind >= 0 ? nextRemind : -1)
      })

      // reset form
      setTitle(''); setDate(''); setTime(''); setPriority('medium'); setRemindBefore(menit)
    } catch (e) {
      console.error(e)
      Swal.fire({ icon:'error', title:'Isi Otomatis gagal', text:'Pastikan server lokal aktif dan kredensial IBM Granite benar.', footer: String(e?.message || e) })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <form onSubmit={add} className="grid gap-3">
      <div className="grid md:grid-cols-3 gap-3">
        <input
          className="input"
          placeholder="Judul / deskripsi tugas"
          value={title}
          onChange={e=>setTitle(e.target.value)}
        />
        <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} />
        <input type="time" className="input" value={time} onChange={e=>setTime(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input max-w-[200px]" value={priority} onChange={e=>setPriority(e.target.value)}>
          <option value="high">Prioritas tinggi</option>
          <option value="medium">Prioritas sedang</option>
          <option value="low">Prioritas rendah</option>
        </select>

        <select className="input max-w-[220px]" value={remindBefore} onChange={e=>setRemindBefore(Number(e.target.value))}>
          <option value={-1}>Pengingat: Tidak ada</option>
          <option value={5}>Pengingat: 5 menit sebelum</option>
          <option value={15}>Pengingat: 15 menit sebelum</option>
          <option value={30}>Pengingat: 30 menit sebelum</option>
          <option value={60}>Pengingat: 1 jam sebelum</option>
          <option value={1440}>Pengingat: 1 hari sebelum</option>
        </select>

        <button type="submit" className="btn-solid btn-blue">Tambah</button>

        <button
          type="button"
          onClick={autoFillFromAI}
          disabled={aiLoading}
          className="btn-solid btn-amber disabled:opacity-70"
        >
          {aiLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="spinner"></span> Memproses…
            </span>
          ) : 'Isi Otomatis (AI)'}
        </button>
      </div>
    </form>
  )
}
