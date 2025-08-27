// client/src/components/TaskItem.jsx
import { useState, useMemo } from 'react'
import { Check, Circle } from 'lucide-react'
import Swal from 'sweetalert2';

function dueState(due, done){
  if(!due || done) return null
  const now = Date.now()
  const t = new Date(due).getTime()
  if (isNaN(t)) return null
  if (t < now) return 'overdue'
  if (t - now <= 24*60*60*1000) return 'soon'
  return null
}

function toDateTime(iso){
  if(!iso) return { date:'', time:'' }
  const d = new Date(iso); if (isNaN(d)) return { date:'', time:'' }
  const pad = n => String(n).padStart(2,'0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,  // YYYY-MM-DD (lokal)
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`                      // HH:MM (lokal)
  }
}

function toISO(date, time){
  if(!date) return null
  const dt = new Date(`${date}T${time || '00:00'}`)
  return isNaN(dt) ? null : dt.toISOString()
}

function humanizeMinutes(mins) {
  if (mins == null || mins < 0) return ''
  if (mins < 60) return `${mins} menit`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} jam ${m} menit` : `${h} jam`
}

export default function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  isSelected = false,     // ✅ deklarasikan props bulk-select
  onSelect = () => {}     // ✅ deklarasikan props bulk-select
}){
  const state = dueState(task.due, task.done)
  const [editing, setEditing] = useState(false)

  const { date: initDate, time: initTime } = useMemo(()=>toDateTime(task.due), [task.due])
  const [title, setTitle]       = useState(task.title)
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [date, setDate]         = useState(initDate)
  const [time, setTime]         = useState(initTime)

  function startEdit(){
    setTitle(task.title)
    setPriority(task.priority || 'medium')
    setDate(initDate)
    setTime(initTime)
    setEditing(true)
  }
  function cancel(){ setEditing(false) }
  function save(){
    onEdit(task.id, {
      title: title.trim() || task.title,
      priority,
      due: toISO(date, time)
    })
    setEditing(false)
  }

  if (editing){
    return (
      <div className="card p-3 grid gap-2">
        <div className="grid md:grid-cols-2 gap-2">
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul / deskripsi"/>
          <div className="flex gap-2">
            <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} />
            <input type="time" className="input" value={time} onChange={e=>setTime(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-[200px]" value={priority} onChange={e=>setPriority(e.target.value)}>
            <option value="high">Prioritas tinggi</option>
            <option value="medium">Prioritas sedang</option>
            <option value="low">Prioritas rendah</option>
          </select>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-ghost" onClick={cancel}>Batal</button>
            <button className="btn btn-primary" onClick={save}>Simpan</button>
          </div>
        </div>
      </div>
    )
  }

  function handleDelete(){
    Swal.fire({
      title: 'Hapus tugas?',
      text: `“${task.title}” akan dihapus permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      focusCancel: true,
      buttonsStyling: false, // agar bisa pakai class Tailwind kita
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'btn-solid btn-red !mx-2',
        cancelButton: 'btn btn-ghost !mx-2'
      }
    }).then(({ isConfirmed }) => {
      if (isConfirmed) onDelete(task.id);
    });
  }

  // tampilan normal
  return (
    <div className={`card p-3 flex items-start gap-3 ${state==='overdue'?'ring-red-300': state==='soon'?'ring-amber-300':''}`}>
      {/* checkbox pilih untuk bulk */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={()=>onSelect(task.id)}
        className="mt-1 h-5 w-5"
        aria-label="Pilih untuk bulk"
      />
      
      {/* Tombol selesai */}
      <button
        type="button"
        aria-pressed={task.done}
        title={task.done ? 'Tandai belum selesai' : 'Tandai selesai'}
        onClick={()=>onToggle(task.id)}
        className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full transition ring-1
          ${task.done ? 'bg-green-500 text-white ring-green-500 hover:bg-green-600'
                      : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}
      >
        {task.done ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${task.done?'line-through text-slate-400':''}`}>{task.title}</span>
          {task.priority && <span className="pill">{task.priority}</span>}
          {task.due && (
            <span className="text-xs text-slate-600">
              ⏰ {new Date(task.due).toLocaleString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
          {typeof task.remindBeforeMinutes === 'number' && task.remindBeforeMinutes >= 0 && task.due && (
            <span className="pill">Pengingat: {humanizeMinutes(task.remindBeforeMinutes)} sebelum</span>
          )}
          {state==='overdue' && <span className="pill bg-red-100 text-red-700 ring-red-200">Terlambat</span>}
          {state==='soon' && <span className="pill bg-amber-100 text-amber-800 ring-amber-200">Segera</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {task.done ? (
          <span className="pill bg-green-100 text-green-700 ring-green-200">Selesai</span>
        ) : (
          <>
            <button
              type="button"
              onClick={()=>onEdit(task.id, { pinned: !task.pinned })}
              className="btn-solid btn-blue"
            >
              {task.pinned ? 'Unpin' : 'Pin'}
            </button>

            <button
              type="button"
              onClick={startEdit}
              className="btn-solid btn-amber"
            >
              Edit
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleDelete}
          className="btn-solid btn-red"
        >
          Hapus
        </button>
      </div>

    </div>
  )
}
