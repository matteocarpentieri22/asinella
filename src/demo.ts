/* Modalità demo (solo `npm run dev` senza .env.local): dati in memoria. */
import { nextThursday, ymd } from './format'
import type { Category, EventRow, Ingredient, Order, Player } from './types'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const thu = nextThursday(new Date(Date.now() + 86400000))
const dl = new Date(thu.getFullYear(), thu.getMonth(), thu.getDate() - 1, 22, 0)

const events: EventRow[] = [
  { id: 'ev1', event_date: ymd(thu), deadline: dl.toISOString(), closed: false, created_at: new Date().toISOString() },
]
const seed: [Category, string][] = [
  ['salumi', 'Cotto'], ['salumi', 'Speck'], ['salumi', 'Pancetta'], ['salumi', 'Crudo'], ['salumi', 'Salame'],
  ['formaggi', 'Dobbiaco'], ['formaggi', 'Provola'], ['formaggi', 'Brie'], ['formaggi', 'Squacquerone'], ['formaggi', 'Mozzarella'],
  ['verdure', 'Zucchine'], ['verdure', 'Melanzane'], ['verdure', 'Insalata'], ['verdure', 'Rucola'], ['verdure', 'Pomodoro'], ['verdure', 'Peperoni'],
  ['salse', 'Salsa rosa'], ['salse', 'Senape'], ['salse', 'Ketchup'], ['salse', 'Maionese'],
]
const ingredients: Ingredient[] = seed.map(([category, name], i) => ({ id: 'i' + i, event_id: 'ev1', category, name, sort: i }))
const players: Player[] = [
  { id: 'p1', first_name: 'Luca', last_name: 'Bianchi' },
  { id: 'p2', first_name: 'Marco', last_name: 'Verdi' },
]
const orders: Order[] = [
  {
    id: 'o1', event_id: 'ev1', player_id: 'p1', extra: null, notes: 'ben cotta',
    items: [ingredients[0], ingredients[6], ingredients[10]].map(({ id, name, category }) => ({ id, name, category })),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]
let pin = 'asinella'

export const demo = {
  subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } },
  currentEvent: async () => [...events].sort((a, b) => a.event_date.localeCompare(b.event_date)).at(-1) ?? null,
  ingredients: async (ev: string) => ingredients.filter((i) => i.event_id === ev),
  orders: async (ev: string) => orders.filter((o) => o.event_id === ev),
  players: async () => [...players],
  login: async (f: string, l: string) => {
    const key = (f + ' ' + l).trim().toLowerCase()
    let p = players.find((x) => (x.first_name + ' ' + x.last_name).toLowerCase() === key)
    if (!p) { p = { id: uid(), first_name: f.trim(), last_name: l.trim() }; players.push(p); emit() }
    return p
  },
  submit: async (player: string, ev: string, ids: string[], extra: string, notes: string) => {
    await new Promise((r) => setTimeout(r, 400))
    const items = ids.map((id) => ingredients.find((i) => i.id === id)!).filter(Boolean).map(({ id, name, category }) => ({ id, name, category }))
    let o = orders.find((x) => x.player_id === player && x.event_id === ev)
    const now = new Date().toISOString()
    if (o) Object.assign(o, { items, extra: extra || null, notes: notes || null, updated_at: now })
    else { o = { id: uid(), event_id: ev, player_id: player, items, extra: extra || null, notes: notes || null, created_at: now, updated_at: now }; orders.push(o) }
    emit()
    return o
  },
  cancel: async (player: string, ev: string) => {
    const i = orders.findIndex((x) => x.player_id === player && x.event_id === ev)
    if (i >= 0) orders.splice(i, 1)
    emit()
  },
  check: async (p: string) => p === pin,
  assert(p: string) { if (p !== pin) throw new Error('PIN admin errato') },
  changePin: async (p: string, np: string) => { demo.assert(p); pin = np },
  saveEvent: async (p: string, id: string | null, date: string, deadline: string, closed: boolean, copyFrom: string | null) => {
    demo.assert(p)
    let ev = events.find((e) => e.id === id)
    if (ev) Object.assign(ev, { event_date: date, deadline, closed })
    else {
      ev = { id: uid(), event_date: date, deadline, closed, created_at: new Date().toISOString() }
      events.push(ev)
      if (copyFrom) ingredients.filter((i) => i.event_id === copyFrom).forEach((i) => ingredients.push({ ...i, id: uid(), event_id: ev!.id }))
    }
    emit()
    return ev
  },
  deleteEvent: async (p: string, id: string) => { demo.assert(p); events.splice(events.findIndex((e) => e.id === id), 1); emit() },
  addIngredient: async (p: string, ev: string, category: Category, name: string) => {
    demo.assert(p)
    const g = { id: uid(), event_id: ev, category, name, sort: ingredients.length }
    ingredients.push(g)
    emit()
    return g
  },
  deleteIngredient: async (p: string, id: string) => { demo.assert(p); ingredients.splice(ingredients.findIndex((i) => i.id === id), 1); emit() },
  deleteOrder: async (p: string, id: string) => { demo.assert(p); orders.splice(orders.findIndex((o) => o.id === id), 1); emit() },
}
