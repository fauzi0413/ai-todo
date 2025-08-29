// client/src/components/TaskItem.jsx
import { useState } from 'react'
import { Check, Circle } from 'lucide-react'
import Swal from 'sweetalert2'

// --- Utils ---
function dueState(due, done){
  if(!due || done) return null
  const t = new Date(due).getTime()
  if (isNaN(t)) return null
  const now = Date.now()
  if (t < now) return 'overdue'
  if (t - now <= 24*60*60*1000) return 'soon'
  return null
}

function toDateTime(iso){
  if(!iso) return { date:'', time:'' }
  const d = new Date(iso); if (isNaN(d)) return { date:'', time:'' }
  const pad = n => String(n).toString().padStart(2,'0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
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

function parseDateSafe(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d) ? null : d
}

// --- Component ---
export default function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  isSelected = false,
  onSelect = () => {}
}){
  const state = dueState(task?.due, task?.done) // 'overdue' | 'soon' | null
  const [editing, setEditing] = useState(false)

  const { date: initDate, time: initTime } = (toDateTime(task?.due) ?? { date:'', time:'' })
  const dueDate = parseDateSafe(task?.due)
  const [title, setTitle]       = useState(task?.title ?? '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [date, setDate]         = useState(initDate)
  const [time, setTime]         = useState(initTime)

  const timeClass =
    state === 'overdue' ? 'text-rose-700' :
    state === 'soon'    ? 'text-amber-700' : 'text-slate-600'

  function startEdit(){
    setTitle(task.title ?? '')
    setPriority(task.priority || 'medium')
    setDate(initDate)
    setTime(initTime)
    setEditing(true)
  }
  function cancel(){ setEditing(false) }
  function save(){
    onEdit(task.id, {
      title: (title ?? '').trim() || task.title,
      priority,
      due: toISO(date, time)
    })
    setEditing(false)
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
      buttonsStyling: false,
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'btn-solid btn-red !mx-2',
        cancelButton: 'btn btn-ghost !mx-2'
      }
    }).then(({ isConfirmed }) => { if (isConfirmed) onDelete(task.id) })
  }

  // --- Editing view (responsif) ---
  if (editing){
    return (
      <div className="card p-3 grid gap-2">
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul / deskripsi"/>
          <div className="flex gap-2">
            <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} />
            <input type="time" className="input" value={time} onChange={e=>setTime(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-full sm:max-w-[200px]" value={priority} onChange={e=>setPriority(e.target.value)}>
            <option value="high">Prioritas tinggi</option>
            <option value="medium">Prioritas sedang</option>
            <option value="low">Prioritas rendah</option>
          </select>
          <div className="ml-auto flex flex-wrap gap-2 w-full sm:w-auto">
            <button className="btn btn-ghost w-full sm:w-auto" onClick={cancel}>Batal</button>
            <button className="btn btn-primary w-full sm:w-auto" onClick={save}>Simpan</button>
          </div>
        </div>
      </div>
    )
  }

  // --- Normal view (tampilan lama + responsif) ---
  return (
    <div
      className={`card p-3 grid gap-3 sm:gap-4 sm:grid-cols-[auto,1fr,auto] items-start
        ${state==='overdue'?'ring-rose-300': state==='soon'?'ring-amber-300':''}`}
    >
      {/* kolom 1: checkbox + toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={()=>onSelect(task.id)}
          className="h-5 w-5"
          aria-label="Pilih untuk bulk"
        />
        <button
          type="button"
          aria-pressed={task.done}
          title={task.done ? 'Tandai belum selesai' : 'Tandai selesai'}
          onClick={()=>onToggle(task.id)}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ring-1
            ${task.done ? 'bg-green-500 text-white ring-green-500 hover:bg-green-600'
                        : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}
        >
          {task.done ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
      </div>

      {/* kolom 2: info utama */}
      <div className="min-w-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-2">
          <span className={`font-medium break-words ${task.done?'line-through text-slate-400':''}`}>
            {task.title}
          </span>

          {task.priority && <span className="pill">{task.priority}</span>}

          {dueDate && (
            <span className={`text-xs ${timeClass}`}>
              ⏰ {dueDate.toLocaleString('id-ID', {
                day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
              })}
            </span>
          )}

          {typeof task.remindBeforeMinutes === 'number' && task.remindBeforeMinutes >= 0 && dueDate && (
            <span className="pill">Pengingat: {humanizeMinutes(task.remindBeforeMinutes)} sebelum</span>
          )}

          {state==='overdue' && <span className="pill bg-rose-100 text-rose-700 ring-rose-200">Terlambat</span>}
          {state==='soon' && <span className="pill bg-amber-100 text-amber-800 ring-amber-200">Segera</span>}
        </div>
      </div>

      {/* kolom 3: aksi — SELALU sebaris di mobile */}
      <div className="flex flex-nowrap items-center justify-end sm:justify-start gap-1.5 whitespace-nowrap overflow-x-auto">
        {task.done ? (
          <span className="pill bg-green-100 text-green-700 ring-green-200">Selesai</span>
        ) : (
          <>
            <button
              type="button"
              onClick={()=>onEdit(task.id, { pinned: !task.pinned })}
              className="btn-solid btn-blue shrink-0"
            >
              {task.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="btn-solid btn-amber shrink-0"
            >
              Ubah
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="btn-solid btn-red shrink-0"
        >
          Hapus
        </button>
      </div>
    </div>
  )
}
