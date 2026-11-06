const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export function formatEventDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  return `${DAYS[dt.getDay()]} ${day} ${MONTHS[m - 1]}`
}

export function formatDeadline(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} alle ${hh}:${mm}`
}

export function timeLeft(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 48) return `${Math.floor(h / 24)} giorni`
  if (h >= 1) return `${h}h ${m}m`
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

/** ISO <-> valore per <input type="datetime-local"> */
export function toLocalInput(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function fromLocalInput(v: string) {
  return new Date(v).toISOString()
}

export function nextThursday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7))
  return d
}
export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isOpen(ev: { closed: boolean; deadline: string } | null, now = Date.now()) {
  return !!ev && !ev.closed && new Date(ev.deadline).getTime() > now
}

export type EventPhase = 'open' | 'closed' | 'concluded'

/** aperta: si ordina · chiusa: scadenza passata, serata non ancora fatta · conclusa: giorno passato */
export function eventPhase(ev: { closed: boolean; deadline: string; event_date: string }, now = Date.now()): EventPhase {
  if (ev.event_date < ymd(new Date(now))) return 'concluded'
  if (ev.closed || new Date(ev.deadline).getTime() <= now) return 'closed'
  return 'open'
}
