export async function loadTasks(){
  const r = await fetch('/api/tasks',{cache:'no-store'})
  const j = await r.json()
  return j.tasks || []
}
export async function saveTasks(tasks){
  await fetch('/api/tasks',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({tasks})})
}
