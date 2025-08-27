import TaskItem from './TaskItem'

function isToday(iso){
  if(!iso) return false
  const d = new Date(iso), n = new Date()
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate()
}
function isSameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function prioRank(p){ return p==='high'?0 : p==='medium'?1 : 2 }

export default function TaskList({
  tasks,
  onToggle,
  onDelete,
  onEdit,
  filter,
  sortKey = 'dueAsc',
  // props opsional (biar tidak ReferenceError kalau belum dipasang di App.jsx)
  selected = new Set(),
  onSelect = () => {},
  onSelectAll = () => {},
  customDate = null
}){
  // FILTER
  let list = tasks.filter(t=>{
    if (filter==='active')   return !t.done
    if (filter==='done')     return  t.done
    if (filter==='today')    return !t.done && isToday(t.due)
    if (filter==='overdue')  return !t.done && t.due && new Date(t.due).getTime() < Date.now()
    if (filter==='pinned')   return  t.pinned === true
    if (filter==='customDate' && customDate)
                             return  t.due && isSameDay(new Date(t.due), customDate)
    return true
  })

  // SORT: pinned dulu, lalu sesuai sortKey
  list.sort((a,b)=>{
    const pinDiff = (b.pinned===true) - (a.pinned===true)
    if (pinDiff !== 0) return pinDiff

    if (sortKey==='prio')        return prioRank(a.priority)-prioRank(b.priority)
    if (sortKey==='createdDesc') return (b.createdAt||0)-(a.createdAt||0)

    const da = a.due ? new Date(a.due).getTime() : Infinity
    const db = b.due ? new Date(b.due).getTime() : Infinity
    return sortKey==='dueDesc' ? (db-da) : (da-db)
  })

  const visible = list // ⬅️ dipakai untuk “pilih semua”

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          checked={visible.length>0 && visible.every(t => selected.has(t.id))}
          onChange={(e)=> onSelectAll(e.target.checked ? visible.map(t=>t.id) : [])}
        />
        <span className="text-sm text-slate-600">Pilih semua (halaman ini)</span>
      </div>

      <div className="grid gap-2">
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
        {visible.length===0 && <div className="text-center text-slate-500 py-6">Tidak ada tugas</div>}
      </div>
    </>
  )
}
