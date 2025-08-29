// components/SidePanel.jsx
import { useMemo, useState } from 'react'

export default function SidePanel({ tasks, selectedDate, onSelectDate, onClearDate, isSameDayISO }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(selectedDate || today)

  // ——— utils ———
  function getDueISO(t) { return t.due ?? t.dueAt ?? t.deadline ?? t.dueISO ?? t.date ?? null }
  function isSameDay(a, b) {
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
  }
  function fmtDateID(d) { return d.toLocaleDateString('id-ID', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }) }
  function fmtDayShort(d) { return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) }
  function fmtTimeID(d) { return d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())          // Minggu sebagai awal
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))

  function dayHasOpenTasks(d) {
    return tasks.some(t => {
      const iso = getDueISO(t)
      return iso && isSameDayISO?.(iso, d) && !t.done
    })
  }

  const anchorDate = selectedDate || today
  const dateTitle = selectedDate ? fmtDateID(anchorDate) : 'Hari ini'

  const tasksOnAnchor = useMemo(() => {
    return tasks
      .filter(t => {
        const iso = getDueISO(t)
        return iso && isSameDayISO?.(iso, anchorDate)
      })
      .sort((a,b)=>{
        const A = getDueISO(a), B = getDueISO(b)
        return (A?new Date(A).getTime():0) - (B?new Date(B).getTime():0)
      })
  }, [tasks, anchorDate, isSameDayISO])

  const pinnedTasks = useMemo(() => tasks.filter(t => t.pinned && !t.done), [tasks])

  // ——— badge/pill ———
  function Pill({ children, tone='slate', title }) {
    const toneMap = {
      slate:  'bg-slate-100 text-slate-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      emerald:'bg-emerald-100 text-emerald-700',
      amber:  'bg-amber-100 text-amber-700',
      rose:   'bg-rose-100 text-rose-700',
      sky:    'bg-sky-100 text-sky-700',
      orange: 'bg-orange-100 text-orange-700',
    }
    return <span title={title} className={`px-2 py-0.5 rounded-full text-[11px] ${toneMap[tone]}`}>{children}</span>
  }
  function PriorityBadge({ p }) {
    if (!p) return null
    const val = String(p).toLowerCase()
    const tone = val==='high' || val==='tinggi' ? 'orange'
               : val==='urgent' ? 'rose'
               : val==='medium' || val==='sedang' ? 'sky'
               : 'slate'
    return <Pill tone={tone} title="Prioritas">{val}</Pill>
  }

  function MiniTaskItem({ t }) {
    const iso = getDueISO(t)
    const due = iso ? new Date(iso) : null
    const now = new Date()

    let status = null, accent = 'indigo'
    if (t.done) { status = 'Selesai'; accent = 'emerald' }
    else if (due && due < now) { status = 'Terlambat'; accent = 'rose' }
    else if (t.pinned) { accent = 'amber' }

    const title = t.title ?? t.text ?? t.name ?? '(tanpa judul)'

    return (
      <li className={`flex items-start justify-between gap-2 rounded-md px-2 py-1.5 border-l-4
        ${accent==='emerald'?'border-emerald-500':''}
        ${accent==='rose'?'border-rose-500':''}
        ${accent==='amber'?'border-amber-500':''}
        ${accent==='indigo'?'border-indigo-400':''}
        hover:bg-slate-50`}
      >
        <div className="min-w-0">
          <div className={`text-sm ${t.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {t.pinned && <span className="mr-1" title="Pinned">📌</span>}
            <span className="line-clamp-2">{title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {status && <Pill tone={status==='Selesai'?'emerald':'rose'}>{status}</Pill>}
            <PriorityBadge p={t.priority} />
            {!t.done && !status && <Pill tone="indigo">Aktif</Pill>}
          </div>
        </div>
        <div className="text-xs text-slate-500 whitespace-nowrap ml-2">
          {due ? (<><span>{fmtDayShort(due)}</span><br/><span className="font-medium">{fmtTimeID(due)}</span></>) : '-'}
        </div>
      </li>
    )
  }

  return (
    <div className="grid gap-4 w-full">
      {/* —— Kalender —— */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <button className="btn px-2" onClick={()=>setViewDate(new Date(year, month-1, 1))} aria-label="Bulan sebelumnya">‹</button>
          <div className="font-semibold">
            {viewDate.toLocaleDateString('id-ID', { month:'long', year:'numeric' })}
          </div>
          <button className="btn px-2" onClick={()=>setViewDate(new Date(year, month+1, 1))} aria-label="Bulan berikutnya">›</button>
        </div>

        <div className="grid grid-cols-7 text-[11px] sm:text-xs text-slate-500 mb-1">
          {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => <div key={d} className="text-center py-1">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d,i)=>{
            const outside = d.getMonth() !== month
            const isToday = isSameDay(d, today)
            const isSelected = selectedDate && isSameDay(d, selectedDate)
            const hasTasks = dayHasOpenTasks(d)

            return (
              <button
                key={i}
                onClick={()=>{ onSelectDate?.(new Date(d)) ; setViewDate(new Date(d)) }}
                className={[
                "rounded-lg p-1.5 sm:p-2 text-[12px] sm:text-sm text-center hover:ring-1 hover:ring-indigo-200 transition",
                outside ? "text-slate-300" : "text-slate-700",
                isSelected ? "bg-indigo-600 text-white" : "",
                !isSelected && isToday ? "ring-1 ring-indigo-400" : ""
                ].join(' ')}
                title={fmtDateID(d)}
              >
                <div className="leading-none">{d.getDate()}</div>
                {hasTasks && <div className={`mx-auto mt-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />}
              </button>
            )
          })}
        </div>

        <div className="flex justify-between mt-2">
          <button className="btn text-xs" onClick={()=>{ setViewDate(new Date()); onSelectDate?.(null); }}>
            Hari ini
          </button>
          {selectedDate && (
            <button className="btn text-xs" onClick={()=>{ onClearDate ? onClearDate() : onSelectDate?.(null) }}>
              Hapus pilihan tanggal
            </button>
          )}
        </div>
      </div>

      {/* —— Data Hari Ini / Tanggal terpilih —— */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Data {dateTitle}</h3>
          <span className="text-xs text-slate-500">{tasksOnAnchor.length} tugas</span>
        </div>

        {tasksOnAnchor.length === 0 ? (
          <div className="text-sm text-slate-500">Belum ada tugas.</div>
        ) : (
          <ul className="space-y-2">
            {tasksOnAnchor.slice(0, 10).map(t => <MiniTaskItem key={t.id} t={t} />)}
          </ul>
        )}
      </div>

      {/* —— Data Pinned —— */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Pinned</h3>
          <span className="text-xs text-slate-500">{pinnedTasks.length} tugas</span>
        </div>

        {pinnedTasks.length === 0 ? (
          <div className="text-sm text-slate-500">Tidak ada tugas pinned.</div>
        ) : (
          <ul className="space-y-2">
            {pinnedTasks.slice(0, 10).map(t => <MiniTaskItem key={t.id} t={t} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
