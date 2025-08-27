import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

export default function CalendarView({ selected, onSelect }){
  return (
    <div className="card p-3">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  )
}
