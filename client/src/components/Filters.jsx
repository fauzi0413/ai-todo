export default function Filters({
  filter,
  setFilter,
  sortKey,
  setSortKey,
  onToggleCalendar, // opsional: fungsi untuk toggle kalender
}) {
  const Tab = ({ v, label }) => (
    <button
      onClick={() => setFilter(v)}
      className={"btn " + (filter === v ? "btn-primary" : "btn-ghost")}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      <Tab v="all" label="Semua" />
      <Tab v="pinned" label="Pinned" />
      <Tab v="active" label="Aktif" />
      <Tab v="done" label="Selesai" />
      <Tab v="today" label="Hari ini" />
      <Tab v="overdue" label="Terlambat" />
      <select
        className="input"
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value)}
      >
        <option value="dueAsc">Urut: Deadline naik</option>
        <option value="dueDesc">Urut: Deadline turun</option>
        <option value="prio">Urut: Prioritas</option>
        <option value="createdDesc">Urut: Terbaru</option>
      </select>
      {onToggleCalendar && (
        <button className="btn btn-ghost" onClick={onToggleCalendar}>
          Kalender
        </button>
      )}
    </div>
  );
}
