/* Modalità demo (`npm run demo`, o `npm run dev` senza .env.local): dati in memoria. */
import { nextThursday, ymd } from './format'
import type { CatalogItem, Category, EventRow, Ingredient, Order, Player } from './types'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const now = () => new Date().toISOString()

const thu = nextThursday(new Date(Date.now() + 86400000))
const dl = new Date(thu.getFullYear(), thu.getMonth(), thu.getDate() - 1, 22, 0)
const lastThu = new Date(thu.getFullYear(), thu.getMonth(), thu.getDate() - 7)

const seed: [Category, string][] = [
  ['salumi', 'Cotto'], ['salumi', 'Speck'], ['salumi', 'Pancetta'], ['salumi', 'Crudo'], ['salumi', 'Salame'], ['salumi', 'Mortadella'],
  ['formaggi', 'Dobbiaco'], ['formaggi', 'Provola'], ['formaggi', 'Brie'], ['formaggi', 'Squacquerone'], ['formaggi', 'Mozzarella'],
  ['verdure', 'Zucchine'], ['verdure', 'Melanzane'], ['verdure', 'Insalata'], ['verdure', 'Rucola'], ['verdure', 'Pomodoro'], ['verdure', 'Peperoni'],
  ['salse', 'Salsa rosa'], ['salse', 'Senape'], ['salse', 'Ketchup'], ['salse', 'Maionese'],
]
const catalog: CatalogItem[] = seed.map(([category, name], i) => ({
  id: 'c' + i, name, name_key: key(name), category, archived: false, created_at: now(),
}))

const events: EventRow[] = [
  { id: 'ev0', event_date: ymd(lastThu), deadline: new Date(lastThu.getTime() - 2 * 3600e3).toISOString(), closed: false, created_at: now() },
  { id: 'ev1', event_date: ymd(thu), deadline: dl.toISOString(), closed: false, created_at: now() },
]
const ingredients: Ingredient[] = []
function setEventIngredients(ev: string, ids: string[]) {
  for (let i = ingredients.length - 1; i >= 0; i--) {
    if (ingredients[i].event_id === ev && !ids.includes(ingredients[i].catalog_id ?? '')) ingredients.splice(i, 1)
  }
  ids.forEach((cid, sort) => {
    const c = catalog.find((x) => x.id === cid)
    if (!c) return
    const ex = ingredients.find((i) => i.event_id === ev && i.catalog_id === cid)
    if (ex) ex.sort = sort
    else ingredients.push({ id: uid(), event_id: ev, catalog_id: cid, name: c.name, category: c.category, sort })
  })
}
setEventIngredients('ev0', catalog.slice(0, 15).map((c) => c.id))
setEventIngredients('ev1', catalog.filter((c) => c.name !== 'Mortadella').map((c) => c.id))

const players: Player[] = [
  { id: 'p1', first_name: 'Luca', last_name: 'Bianchi' },
  { id: 'p2', first_name: 'Marco', last_name: 'Verdi' },
]
const snap = (ev: string, names: string[]) =>
  ingredients.filter((i) => i.event_id === ev && names.includes(i.name)).map(({ id, name, category }) => ({ id, name, category }))
const orders: Order[] = [
  { id: 'o0', event_id: 'ev0', player_id: 'p2', extra: null, notes: null, items: snap('ev0', ['Crudo', 'Squacquerone', 'Rucola']), created_at: now(), updated_at: now() },
  { id: 'o1', event_id: 'ev1', player_id: 'p1', extra: null, notes: 'ben cotta', items: snap('ev1', ['Cotto', 'Provola', 'Zucchine']), created_at: now(), updated_at: now() },
]
let pin = 'asinella'

function assert(p: string) { if (p !== pin) throw new Error('PIN admin errato') }
const today = () => ymd(new Date())

export const demo = {
  subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } },
  currentEvent: async () => {
    const sorted = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date))
    return sorted.find((e) => e.event_date >= today()) ?? sorted.at(-1) ?? null
  },
  events: async () => [...events].sort((a, b) => b.event_date.localeCompare(a.event_date)),
  ingredients: async (ev: string) => ingredients.filter((i) => i.event_id === ev).sort((a, b) => a.sort - b.sort),
  orders: async (ev: string) => orders.filter((o) => o.event_id === ev),
  players: async () => [...players],
  catalog: async () => [...catalog],
  login: async (f: string, l: string) => {
    const k = key(f + ' ' + l)
    let p = players.find((x) => key(x.first_name + ' ' + x.last_name) === k)
    if (!p) { p = { id: uid(), first_name: f.trim(), last_name: l.trim() }; players.push(p); emit() }
    return p
  },
  submit: async (player: string, ev: string, ids: string[], extra: string, notes: string) => {
    await new Promise((r) => setTimeout(r, 400))
    const e = events.find((x) => x.id === ev)
    if (!e || e.closed || new Date(e.deadline) < new Date()) throw new Error('Ordini chiusi per questa serata')
    const items = ids.map((id) => ingredients.find((i) => i.id === id)).filter(Boolean).map((i) => ({ id: i!.id, name: i!.name, category: i!.category }))
    let o = orders.find((x) => x.player_id === player && x.event_id === ev)
    if (o) Object.assign(o, { items, extra: extra || null, notes: notes || null, updated_at: now() })
    else { o = { id: uid(), event_id: ev, player_id: player, items, extra: extra || null, notes: notes || null, created_at: now(), updated_at: now() }; orders.push(o) }
    emit()
    return o
  },
  cancel: async (player: string, ev: string) => {
    const i = orders.findIndex((x) => x.player_id === player && x.event_id === ev)
    if (i >= 0) orders.splice(i, 1)
    emit()
  },
  check: async (p: string) => p === pin,
  assert,
  changePin: async (p: string, np: string) => { assert(p); pin = np },
  saveEvent: async (p: string, id: string | null, date: string, deadline: string, closed: boolean) => {
    assert(p)
    const ev = events.find((e) => e.id === id)
    if (!ev) throw new Error('Serata non trovata')
    Object.assign(ev, { event_date: date, deadline, closed })
    emit()
    return ev
  },
  createEvent: async (p: string, date: string, deadline: string, ids: string[]) => {
    assert(p)
    if (events.some((e) => e.event_date >= today())) throw new Error("C'è già una serata in corso: potrai crearne una nuova quando sarà conclusa")
    const ev = { id: uid(), event_date: date, deadline, closed: false, created_at: now() }
    events.push(ev)
    setEventIngredients(ev.id, ids)
    emit()
    return ev
  },
  setEventIngredients: async (p: string, ev: string, ids: string[]) => { assert(p); setEventIngredients(ev, ids); emit() },
  deleteEvent: async (p: string, id: string) => { assert(p); events.splice(events.findIndex((e) => e.id === id), 1); emit() },
  catalogAdd: async (p: string, name: string, category: Category) => {
    assert(p)
    const n = name.trim().replace(/\s+/g, ' ')
    let c = catalog.find((x) => x.name_key === key(n))
    if (c) c.archived = false
    else { c = { id: uid(), name: n, name_key: key(n), category, archived: false, created_at: now() }; catalog.push(c) }
    emit()
    return c
  },
  catalogUpdate: async (p: string, id: string, name: string, category: Category, archived: boolean) => {
    assert(p)
    const c = catalog.find((x) => x.id === id)
    if (!c) throw new Error('Ingrediente non trovato')
    if (key(name) !== c.name_key && catalog.some((x) => x.name_key === key(name))) throw new Error('Esiste già un ingrediente con questo nome')
    Object.assign(c, { name: name.trim(), name_key: key(name), category, archived })
    ingredients.filter((i) => i.catalog_id === id).forEach((i) => Object.assign(i, { name: c.name, category }))
    emit()
    return c
  },
  deleteOrder: async (p: string, id: string) => { assert(p); orders.splice(orders.findIndex((o) => o.id === id), 1); emit() },
}
