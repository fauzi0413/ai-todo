import { useEffect, useState } from 'react'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import Filters from './components/Filters'
import SidePanel from './components/SidePanel'
import { loadTasks, saveTasks } from './lib/storage'
import './index.css'

export default function App(){
  const [tasks,setTasks]=useState([])
  const [ready,setReady]=useState(false)
  const [filter,setFilter]=useState('active')
  const [sortKey,setSortKey]=useState('dueAsc')

  useEffect(()=>{ (async()=>{ setTasks(await loadTasks()); setReady(true) })() }, [])
  useEffect(()=>{ if(ready) saveTasks(tasks) }, [tasks,ready])

  const addTask   = (t)=>setTasks([t, ...tasks])
  const toggle    = (id)=>setTasks(tasks.map(t=>t.id===id? {...t, done:!t.done} : t))
  const remove    = (id)=>setTasks(tasks.filter(t=>t.id!==id))
  const updateTask= (id, patch)=>setTasks(tasks.map(t=>t.id===id? {...t, ...patch} : t))

  const [selected, setSelected] = useState(new Set());
  function toggleSelect(id){
    const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s);
  }
  function clearSelect(){ setSelected(new Set()) }
  function selectAllVisible(visibleIds){ setSelected(new Set(visibleIds)) }

  const [selectedDate, setSelectedDate] = useState(null); // Date | null

  // ⬇️ handler khusus untuk clear + ubah filter ke 'done'
  function clearSelectedDate(){
    setSelectedDate(null);
    setFilter('active');
  }

  // Bila user memilih tanggal di kalender, pakai filter 'customDate' (TaskList sudah menerima prop customDate)
  useEffect(()=>{ if (selectedDate) setFilter('customDate') }, [selectedDate]);

  function isSameDayISO(iso, d){
    if(!iso||!d) return false;
    const a = new Date(iso), b = new Date(d);
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  }

  // Aksi bulk (rapikan duplikat pin bila ada)
  const selectedItems = tasks.filter(t => selected.has(t.id));
  const allSelectedDone = selectedItems.length > 0 && selectedItems.every(t => t.done);
  function bulkMarkDone(){ setTasks(tasks.map(t => selected.has(t.id) ? { ...t, done: true } : t)); clearSelect(); }
  function bulkMarkUndone(){ setTasks(tasks.map(t => selected.has(t.id) ? { ...t, done: false } : t)); clearSelect(); }
  const allSelectedPinned = selectedItems.length > 0 && selectedItems.every(t => t.pinned === true);
  function bulkPin(){ setTasks(tasks.map(t => selected.has(t.id) ? { ...t, pinned: true } : t)); clearSelect(); }
  function bulkUnpin(){ setTasks(tasks.map(t => selected.has(t.id) ? { ...t, pinned: false } : t)); clearSelect(); }

  // Saat filter "done", paksa urutan deadline menurun
  const effectiveSortKey = (filter === 'done' && (sortKey === 'dueAsc' || sortKey === 'dueDesc')) ? 'dueDesc' : sortKey;

   return (
    // ⬇️ gunakan 100dvh + safe area bottom + cegah horizontal scroll
    <div className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)] overflow-x-hidden">
      <header className="bg-white/70 backdrop-blur sticky top-0 z-10 ring-1 ring-slate-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold"><span className="text-indigo-600">🧠</span> AI To-Do</h1>
        </div>
      </header>

      {/* ⬇️ 2 kolom hanya di lg, pakai minmax(0,…) agar konten bisa mengecil */}
      <main className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,340px),1fr]">
        {/* SIDE CONTENT */}
        <aside className="w-full lg:sticky lg:top-20 h-max min-w-0">
          <SidePanel
            tasks={tasks}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onClearDate={clearSelectedDate}
            isSameDayISO={isSameDayISO}
          />
        </aside>

        {/* KONTEN UTAMA */}
        <section className="grid gap-5 min-w-0">
          <div className="card p-4"><TaskForm onAdd={addTask} /></div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Daftar Tugas</h2>
            <Filters
              filter={filter}
              setFilter={setFilter}
              sortKey={effectiveSortKey}
              setSortKey={setSortKey}
            />
          </div>

          {/* beri min-w-0 agar list tidak mendorong layout melebar */}
          <div className="card p-4 min-w-0">
            {selected.size > 0 && (
              <div className="card p-3 flex flex-wrap items-center gap-2">
                <span className="text-sm">{selected.size} terpilih</span>

                <button
                  className={`btn-solid ${allSelectedDone ? 'btn-amber' : 'btn-blue'}`}
                  onClick={allSelectedDone ? bulkMarkUndone : bulkMarkDone}
                >
                  {allSelectedDone ? 'Batalkan selesai' : 'Tandai selesai'}
                </button>

                {!allSelectedDone && (
                  <button className="btn-solid btn-blue" onClick={allSelectedPinned ? bulkUnpin : bulkPin}>
                    {allSelectedPinned ? 'Unpin' : 'Pin'}
                  </button>
                )}

                <button
                  className="btn-solid btn-red"
                  onClick={()=>{ setTasks(tasks.filter(t => !selected.has(t.id))); clearSelect(); }}
                >
                  Hapus
                </button>
                <button className="btn btn-ghost" onClick={clearSelect}>Batal</button>
              </div>
            )}

            {!ready ? (
              <div className="text-slate-500">Memuat…</div>
            ) : (
              <TaskList
                tasks={tasks}
                onToggle={toggle}
                onDelete={remove}
                onEdit={updateTask}
                filter={filter}
                sortKey={effectiveSortKey}
                selected={selected}
                onSelect={toggleSelect}
                onSelectAll={selectAllVisible}
                customDate={selectedDate}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
