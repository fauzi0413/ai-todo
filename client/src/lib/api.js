export const API_BASE = import.meta.env.VITE_API_BASE || '';

export const apiFetch = (path, init={}) =>
  fetch(`${API_BASE}${path}`, init);

export async function aiParse(input){
  const r = await apiFetch('/api/ai/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input})})
  return r.json()
}
export async function aiSuggest(goal){
  const r = await apiFetch('/api/ai/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal})})
  return r.json()
}
export async function aiSummarize(tasks){
  const r = await apiFetch('/api/ai/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tasks})})
  return r.json()
}
