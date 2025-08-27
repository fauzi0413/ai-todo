import { useEffect, useState } from 'react'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import Filters from './components/Filters'
import { loadTasks, saveTasks } from './lib/storage'
import './index.css'

export default function App(){
  const [tasks,setTasks]=useState([])
  const [ready,setReady]=useState(false)
  const [filter,setFilter]=useState('all')
  const [sortKey,setSortKey]=useState('dueAsc')   // ⬅️ ganti dari "sort"

  useEffect(()=>{ (async()=>{ setTasks(await loadTasks()); setReady(true) })() }, [])
  useEffect(()=>{ if(ready) saveTasks(tasks) }, [tasks,ready])

  const addTask   = (t)=>setTasks([t, ...tasks])
  const toggle    = (id)=>setTasks(tasks.map(t=>t.id===id? {...t, done:!t.done} : t))
  const remove    = (id)=>setTasks(tasks.filter(t=>t.id!==id))
  const updateTask= (id, patch)=>setTasks(tasks.map(t=>t.id===id? {...t, ...patch} : t))

  const [selected, setSelected] = useState(new Set()); // id terpilih
  function toggleSelect(id){
    const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s);
  }
  function clearSelect(){ setSelected(new Set()) }

  function bulkComplete(){ setTasks(tasks.map(t => selected.has(t.id) ? {...t, done:true} : t)); clearSelect(); }
  function bulkDelete(){ setTasks(tasks.filter(t => !selected.has(t.id))); clearSelect(); }
  function bulkPin(){ setTasks(tasks.map(t => selected.has(t.id) ? {...t, pinned:true} : t)); clearSelect(); }
  function selectAllVisible(visibleIds){ setSelected(new Set(visibleIds)) }

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // Date | null

  // jika selectedDate ada, pakai filter 'customDate'
  useEffect(()=>{
    if (selectedDate) setFilter('customDate');
  }, [selectedDate]);

  function isSameDayISO(iso, d){
    if(!iso||!d) return false;
    const a = new Date(iso), b = new Date(d);
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  }


  const selectedItems = tasks.filter(t => selected.has(t.id));
  const allSelectedDone = selectedItems.length > 0 && selectedItems.every(t => t.done);
  function bulkMarkDone(){
    setTasks(tasks.map(t => selected.has(t.id) ? { ...t, done: true } : t));
    clearSelect();
  }
  function bulkMarkUndone(){
    setTasks(tasks.map(t => selected.has(t.id) ? { ...t, done: false } : t));
    clearSelect();
  }


  const allSelectedPinned = selectedItems.length > 0 && selectedItems.every(t => t.pinned === true);
  function bulkPin(){
    setTasks(tasks.map(t => selected.has(t.id) ? { ...t, pinned: true } : t));
    clearSelect();
  }
  function bulkUnpin(){
    setTasks(tasks.map(t => selected.has(t.id) ? { ...t, pinned: false } : t));
    clearSelect();
  }


  return (
    <div className="min-h-screen">
      <header className="bg-white/70 backdrop-blur sticky top-0 z-10 ring-1 ring-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold"><span className="text-indigo-600">🧠</span> AI To-Do</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 grid gap-5">
        <div className="card p-4"><TaskForm onAdd={addTask} /></div>

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Daftar Tugas</h2>
          <Filters filter={filter} setFilter={setFilter} sortKey={sortKey} setSortKey={setSortKey} />
        </div>

        {calendarOpen && (
          <CalendarView selected={selectedDate} onSelect={setSelectedDate} />
        )}

        <div className="card p-4">
          {selected.size > 0 && (
            <div className="card p-3 flex flex-wrap items-center gap-2">
              <span className="text-sm">{selected.size} terpilih</span>

              <button
                className={`btn-solid ${allSelectedDone ? 'btn-amber' : 'btn-blue'}`}
                onClick={allSelectedDone ? bulkMarkUndone : bulkMarkDone}
              >
                {allSelectedDone ? 'Batalkan selesai' : 'Tandai selesai'}
              </button>

              {/* ⬇️ Pin/Unpin hanya muncul jika tidak semua terpilih sudah selesai */}
              {!allSelectedDone && (
                <button
                  className="btn-solid btn-blue"
                  onClick={allSelectedPinned ? bulkUnpin : bulkPin}
                >
                  {allSelectedPinned ? 'Unpin' : 'Pin'}
                </button>
              )}

              <button className="btn-solid btn-red" onClick={bulkDelete}>Hapus</button>
              <button className="btn btn-ghost" onClick={clearSelect}>Batal</button>
            </div>
          )}

          {!ready ? <div className="text-slate-500">Memuat…</div> :
            <TaskList
              tasks={tasks}
              onToggle={toggle}
              onDelete={remove}
              onEdit={updateTask}
              filter={filter}
              sortKey={sortKey}
              selected={selected}
              onSelect={toggleSelect}
              onSelectAll={selectAllVisible}
              customDate={selectedDate}
            />
          }
        </div>
      </main>
    </div>
  )
}
