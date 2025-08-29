export default function Filters({ filter, setFilter, sortKey, setSortKey, onToggleCalendar }) {
  const Tab = ({ v, label }) => (
    <button
      onClick={() => setFilter(v)}
      className={"btn " + (filter === v ? "btn-primary" : "btn-ghost")}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full flex flex-wrap items-center gap-2">
      {/* strip tab: boleh scroll mendatar di layar sangat sempit */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 max-w-full whitespace-nowrap">
        <Tab v="active" label="Aktif" />
        <Tab v="done" label="Selesai" />
        {/* <Tab v="pinned" label="Pinned" /> */}
        <Tab v="overdue" label="Terlambat" />
        <Tab v="all" label="Semua" />
        {/* <Tab v="today" label="Hari ini" /> */}
      </div>

      {/* taruh select & tombol di kanan, tapi di mobile pindah ke baris baru */}
      <div className="ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <select
          className="input w-full sm:w-[220px]"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
        >
          <option value="dueAsc">Urut: Deadline Terdekat</option>
          <option value="dueDesc">Urut: Deadline Terjauh</option>
          <option value="prio">Urut: Prioritas</option>
          <option value="createdDesc">Urut: Terbaru</option>
        </select>

        {onToggleCalendar && (
          <button className="btn btn-ghost w-full sm:w-auto" onClick={onToggleCalendar}>
            Kalender
          </button>
        )}
      </div>
    </div>
  );
}
