// client/src/components/TaskList.jsx
import TaskItem from './TaskItem'

// Helpers kecil
function isToday(iso){
  if(!iso) return false
  const d = new Date(iso); if (isNaN(d)) return false
  const n = new Date()
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate()
}
function isSameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
// Pemetaan prioritas (semakin kecil = semakin tinggi)
function prioRank(p){
  const v = String(p||'').toLowerCase()
  if (v==='urgent' || v==='mendesak') return 0
  if (v==='high'   || v==='tinggi')   return 1
  if (v==='medium' || v==='sedang')   return 2
  if (v==='low'    || v==='rendah')   return 3
  return 4
}
// Parse waktu due jadi ms; kembalikan sentinel berdasarkan sort agar item tanpa due selalu di bawah
function dueMsForSort(t, sortKey){
  const ms = Date.parse(t?.due)
  if (Number.isNaN(ms)) {
    // triknya: untuk dueAsc maupun dueDesc, sama-sama kembalikan +Infinity → selalu di bawah
    // (nanti pembanding dueDesc pakai "desc" bukan membalik angka dengan minus)
    return Infinity
  }
  return ms
}

export default function TaskList({
  tasks, onToggle, onDelete, onEdit,
  filter, sortKey='dueAsc',
  selected=new Set(), onSelect=()=>{}, onSelectAll=()=>{}, customDate=null
}){
  // 1) FILTER
  let list = tasks.filter(t=>{
    if (filter==='active')   return !t.done
    if (filter==='done')     return  t.done
    if (filter==='today')    return !t.done && isToday(t.due)
    if (filter==='overdue')  return !t.done && t.due && !Number.isNaN(Date.parse(t.due)) && new Date(t.due).getTime() < Date.now()
    if (filter==='pinned')   return  t.pinned === true
    if (filter==='customDate' && customDate)
                             return  t.due && !Number.isNaN(Date.parse(t.due)) && isSameDay(new Date(t.due), customDate)
    return true
  })

  // 2) SORT
  list.sort((a,b)=>{
    // Pinned dulu
    const pinDiff = (b?.pinned===true) - (a?.pinned===true)
    if (pinDiff !== 0) return pinDiff

    if (sortKey==='prio') {
      const pr = prioRank(a?.priority) - prioRank(b?.priority)
      if (pr !== 0) return pr
      // tie-breaker: yang due lebih dekat dulu, lalu terbaru
      const da = dueMsForSort(a, sortKey), db = dueMsForSort(b, sortKey)
      if (da !== db) return da - db
      return (b?.createdAt||0) - (a?.createdAt||0)
    }

    if (sortKey==='createdDesc') {
      const cd = (b?.createdAt||0) - (a?.createdAt||0)
      if (cd !== 0) return cd
      // tie-breaker: pinned handled, kemudian dueAsc
      const da = dueMsForSort(a, sortKey), db = dueMsForSort(b, sortKey)
      if (da !== db) return da - db
      return prioRank(a?.priority) - prioRank(b?.priority)
    }

    // Default: berdasarkan due (asc/desc) — item tanpa due (Infinity) selalu di bawah
    const da = dueMsForSort(a, sortKey)
    const db = dueMsForSort(b, sortKey)
    if (sortKey==='dueDesc') {
      // Descending yang benar: nilai lebih besar tampil dulu, Infinity (tanpa due) kita taruh di bawah
      // Cara: bandingkan normal, tapi jika salah satu Infinity, jadikan dia "lebih besar" untuk asc
      const aNoDue = (da===Infinity), bNoDue = (db===Infinity)
      if (aNoDue && !bNoDue) return 1     // a turun
      if (!aNoDue && bNoDue) return -1    // b turun
      if (db !== da) return db - da       // keduanya punya due valid
      // tie-breaker: prioritas, lalu terbaru
      const pr = prioRank(a?.priority) - prioRank(b?.priority)
      if (pr !== 0) return pr
      return (b?.createdAt||0) - (a?.createdAt||0)
    } else {
      // dueAsc
      if (da !== db) return da - db       // Infinity otomatis di bawah
      const pr = prioRank(a?.priority) - prioRank(b?.priority)
      if (pr !== 0) return pr
      return (b?.createdAt||0) - (a?.createdAt||0)
    }
  })

  const visible = list

  // 3) RENDER
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={visible.length>0 && visible.every(t => selected.has(t.id))}
            onChange={(e)=> onSelectAll(e.target.checked ? visible.map(t=>t.id) : [])}
          />
          <span className="text-sm text-slate-600">Pilih semua (halaman ini)</span>
        </label>
      </div>

      <div className="grid gap-2 sm:gap-3">
        {visible.map(t => (
          <TaskItem
            key={t.id}
            task={t}
            isSelected={selected.has(t.id)}
            onSelect={onSelect}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
        {visible.length===0 && (
          <div className="text-center text-slate-500 py-6">Tidak ada tugas</div>
        )}
      </div>
    </>
  )
}
