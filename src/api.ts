import { supabase, supabaseConfigured } from './supabase'
import { demo } from './demo'

export const DEMO = !supabaseConfigured && import.meta.env.DEV
import type { Category, EventRow, Ingredient, Order, Player } from './types'
import type { IngredientImage } from './piadina/images'

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Serata corrente: la prima con data >= oggi, altrimenti l'ultima. */
export async function fetchCurrentEvent(): Promise<EventRow | null> {
  if (DEMO) return demo.currentEvent()
  const now = new Date()
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const upcoming = unwrap<EventRow[]>(
    await supabase.from('events').select('*').gte('event_date', iso).order('event_date').limit(1),
  )
  if (upcoming.length) return upcoming[0]
  const last = unwrap<EventRow[]>(
    await supabase.from('events').select('*').order('event_date', { ascending: false }).limit(1),
  )
  return last[0] ?? null
}

export async function fetchEvents(): Promise<EventRow[]> {
  return unwrap(await supabase.from('events').select('*').order('event_date', { ascending: false }).limit(20))
}

export async function fetchIngredients(eventId: string): Promise<Ingredient[]> {
  if (DEMO) return demo.ingredients(eventId)
  return unwrap(
    await supabase.from('ingredients').select('*').eq('event_id', eventId).order('sort').order('created_at'),
  )
}

export async function fetchOrders(eventId: string): Promise<Order[]> {
  if (DEMO) return demo.orders(eventId)
  return unwrap(await supabase.from('orders').select('*').eq('event_id', eventId).order('created_at'))
}

export async function fetchPlayers(): Promise<Player[]> {
  if (DEMO) return demo.players()
  return unwrap(await supabase.from('players').select('id, first_name, last_name').order('first_name'))
}

export async function loginPlayer(first: string, last: string): Promise<Player> {
  if (DEMO) return demo.login(first, last)
  return unwrap(await supabase.rpc('login_player', { p_first: first, p_last: last }))
}

export async function submitOrder(
  playerId: string, eventId: string, ingredientIds: string[], extra: string, notes: string,
): Promise<Order> {
  if (DEMO) return demo.submit(playerId, eventId, ingredientIds, extra, notes)
  return unwrap(
    await supabase.rpc('submit_order', {
      p_player: playerId, p_event: eventId, p_ingredient_ids: ingredientIds, p_extra: extra, p_notes: notes,
    }),
  )
}

export async function cancelOrder(playerId: string, eventId: string) {
  if (DEMO) return demo.cancel(playerId, eventId)
  unwrap(await supabase.rpc('cancel_order', { p_player: playerId, p_event: eventId }))
}

// ---------- admin ----------
export async function adminCheck(pin: string): Promise<boolean> {
  if (DEMO) return demo.check(pin)
  return unwrap(await supabase.rpc('admin_check', { p_pin: pin }))
}
export async function adminChangePin(pin: string, newPin: string) {
  if (DEMO) return demo.changePin(pin, newPin)
  unwrap(await supabase.rpc('admin_change_pin', { p_pin: pin, p_new_pin: newPin }))
}
export async function adminSaveEvent(
  pin: string, id: string | null, eventDate: string, deadline: string, closed: boolean, copyFrom: string | null = null,
): Promise<EventRow> {
  if (DEMO) return demo.saveEvent(pin, id, eventDate, deadline, closed, copyFrom)
  return unwrap(
    await supabase.rpc('admin_save_event', {
      p_pin: pin, p_id: id, p_event_date: eventDate, p_deadline: deadline, p_closed: closed, p_copy_from: copyFrom,
    }),
  )
}
export async function adminDeleteEvent(pin: string, id: string) {
  if (DEMO) return demo.deleteEvent(pin, id)
  unwrap(await supabase.rpc('admin_delete_event', { p_pin: pin, p_id: id }))
}
export async function adminAddIngredient(pin: string, eventId: string, category: string, name: string) {
  if (DEMO) return demo.addIngredient(pin, eventId, category as Category, name)
  return unwrap<Ingredient>(
    await supabase.rpc('admin_add_ingredient', { p_pin: pin, p_event: eventId, p_category: category, p_name: name }),
  )
}
export async function adminDeleteIngredient(pin: string, id: string) {
  if (DEMO) return demo.deleteIngredient(pin, id)
  unwrap(await supabase.rpc('admin_delete_ingredient', { p_pin: pin, p_id: id }))
}
export async function adminDeleteOrder(pin: string, id: string) {
  if (DEMO) return demo.deleteOrder(pin, id)
  unwrap(await supabase.rpc('admin_delete_order', { p_pin: pin, p_id: id }))
}

// ---------- immagini ingredienti (Gemini) ----------
export async function fetchIngredientImages(): Promise<IngredientImage[]> {
  if (DEMO) return []
  return unwrap(await supabase.from('ingredient_images').select('*'))
}

/** Chiede alla Edge Function di generare (o rigenerare) l'immagine di un ingrediente. */
export async function generateIngredientImage(pin: string, name: string, category: string) {
  if (DEMO) throw new Error('In modalità demo la generazione con Gemini non è disponibile')
  const { data, error } = await supabase.functions.invoke('generate-ingredient', { body: { pin, name, category } })
  if (error) {
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) msg = (await ctx.json()).error ?? msg
    } catch { /* noop */ }
    throw new Error(msg)
  }
  return data as { image_url?: string; color?: string }
}

export async function adminDeleteIngredientImage(pin: string, nameKey: string) {
  unwrap(await supabase.rpc('admin_delete_ingredient_image', { p_pin: pin, p_name_key: nameKey }))
}

/** Realtime: richiama cb a ogni cambio su orders/ingredients/events. */
export function subscribeChanges(cb: () => void) {
  if (DEMO) return demo.subscribe(cb)
  const ch = supabase
    .channel('asinella-live-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredient_images' }, cb)
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}
