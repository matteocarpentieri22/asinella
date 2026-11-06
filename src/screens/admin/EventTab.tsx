import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import {
  adminCreateEvent, adminDeleteEvent, adminDeleteOrder, adminSetEventIngredients, adminUpdateEvent,
  fetchEvents, fetchIngredients, fetchOrders,
} from '../../api'
import {
  eventPhase, formatDeadline, formatEventDate, fromLocalInput, nextThursday, timeLeft, toLocalInput, ymd,
} from '../../format'
import { IngredientIcon } from '../../piadina/IngredientIcon'
import { asinellaText, orderLabel } from '../../summary'
import type { CatalogItem, EventRow, Ingredient, Order, Player } from '../../types'
import { IngredientPicker } from './IngredientPicker'

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<void>

interface Common {
  pin: string; players: Player[]; catalog: CatalogItem[]; run: Run; flash: (t: string) => void
  onError: (m: string) => void; reload: () => Promise<void>; phone: string | null; onOpenSettings: () => void
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

function defaultDeadline(eventDate: string) {
  const [y, m, d] = eventDate.split('-').map(Number)
  return new Date(y, m - 1, d - 1, 22, 0).toISOString()
}

/** Numero italiano → formato internazionale per wa.me */
export function waNumber(phone: string | null) {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 && /^[03]/.test(d)) d = '39' + d
  return d.length >= 8 ? d : null
}

export function EventTab({ event, ingredients, orders, me, onGoHome, ...c }: Common & {
  event: EventRow | null; ingredients: Ingredient[]; orders: Order[]; me: Player | null; onGoHome: () => void
}) {
  const now = useNow()
  const phase = event ? eventPhase(event, now) : null
  const [history, setHistory] = useState<EventRow[]>([])
  const [showNext, setShowNext] = useState(false)

  useEffect(() => { fetchEvents().then(setHistory).catch(() => {}) }, [event?.id, event?.event_date, phase])
  useEffect(() => { setShowNext(false) }, [event?.id])

  const others = history.filter((e) => e.id !== event?.id)
  const latest = history[0] ?? event

  return (
    <div className="event-tab">
      {event && phase !== 'concluded' && (
        <CurrentEvent {...c} event={event} phase={phase!} now={now} ingredients={ingredients} orders={orders}
          me={me} onGoHome={onGoHome} />
      )}

      {event && phase === 'closed' && (
        showNext ? (
          <NewEvent {...c} lastEvent={latest ?? null} title="Prossima serata" onCancel={() => setShowNext(false)} />
        ) : (
          <motion.button className="next-event-btn" onClick={() => setShowNext(true)} whileTap={{ scale: 0.98 }}>
            <span className="next-event-plus">+</span>
            <span>
              <strong>Crea la prossima serata</strong>
              <small>Gli ordini di questa sono chiusi: puoi già aprire la successiva</small>
            </span>
          </motion.button>
        )
      )}

      {(!event || phase === 'concluded') && <NewEvent {...c} lastEvent={latest ?? null} />}

      {others.length > 0 && (
        <section className="card">
          <h3>Altre serate</h3>
          {others.map((e) => <HistoryItem key={e.id} event={e} players={c.players} flash={c.flash} phone={c.phone} />)}
        </section>
      )}
    </div>
  )
}

/* ---------------- serata in corso ---------------- */

function CurrentEvent({ pin, event, phase, now, ingredients, orders, players, catalog, run, flash, onError, reload, phone,
  onOpenSettings, me, onGoHome }: Common & {
  event: EventRow; phase: 'open' | 'closed'; now: number; ingredients: Ingredient[]; orders: Order[]
  me: Player | null; onGoHome: () => void
}) {
  const [editIngr, setEditIngr] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [date, setDate] = useState(event.event_date)
  const [deadline, setDeadline] = useState(toLocalInput(event.deadline))
  useEffect(() => { setDate(event.event_date); setDeadline(toLocalInput(event.deadline)) }, [event.event_date, event.deadline])
  const left = timeLeft(event.deadline, now)
  const dirty = date !== event.event_date || deadline !== toLocalInput(event.deadline)
  const myOrder = me ? orders.find((o) => o.player_id === me.id) : null
  const total = Math.max(players.length, orders.length)
  const pct = total ? Math.round((orders.length / total) * 100) : 0

  const closeOrders = () => {
    if (confirm(`Chiudere gli ordini di ${formatEventDate(event.event_date)}?\n\nNessuno potrà più ordinare o modificare la piadina.`)) {
      run(() => adminUpdateEvent(pin, event, event.event_date, event.deadline, true), 'Ordini chiusi')
    }
  }

  return (
    <>
      {/* riepilogo serata */}
      <section className={'card event-hero event-hero--' + phase}>
        <div className="event-hero-top">
          <div>
            <span className="eyebrow">{phase === 'open' ? 'Serata in corso' : 'Ordini chiusi'}</span>
            <h2>{formatEventDate(event.event_date)}</h2>
            <p className="small">
              {phase === 'open'
                ? <>Si ordina fino a {formatDeadline(event.deadline)}</>
                : <>Scadenza: {formatDeadline(event.deadline)}{event.closed && ' · chiusi a mano'}</>}
            </p>
          </div>
          {phase === 'open' && left && (
            <div className="event-hero-stat"><strong>{left}</strong><span>alla chiusura</span></div>
          )}
        </div>
        <div className="hero-progress">
          <div className="hero-progress-text">
            <strong>{orders.length}</strong> su {total} {total === 1 ? 'giocatore ha' : 'giocatori hanno'} ordinato
          </div>
          <div className="hero-progress-bar"><motion.span initial={false} animate={{ width: `${pct}%` }} /></div>
        </div>
        {me && (
          <button className="hero-me" onClick={onGoHome}>
            {myOrder
              ? <>La tua piadina: <strong>{orderLabel(myOrder)}</strong>{phase === 'open' && ' · modifica →'}</>
              : phase === 'open' ? <><strong>Non hai ancora ordinato la tua piadina</strong> · ordina →</> : <>Non hai ordinato la tua piadina</>}
          </button>
        )}
      </section>

      {/* a ordini chiusi l'azione principale è mandare l'ordine */}
      {phase === 'closed' && (
        <SendToAsinella orders={orders} players={players} flash={flash} phone={phone} onOpenSettings={onOpenSettings} highlight />
      )}

      <OrdersList orders={orders} players={players}
        onDelete={(o, name) => { if (confirm(`Eliminare l'ordine di ${name}?`)) run(() => adminDeleteOrder(pin, o.id), 'Ordine eliminato') }} />

      {phase === 'open' && orders.length > 0 && (
        <SendToAsinella orders={orders} players={players} flash={flash} phone={phone} onOpenSettings={onOpenSettings} collapsible />
      )}

      {/* ingredienti: una riga compatta */}
      <section className="card ingr-row-card">
        {!editIngr ? (
          <button className="ingr-row" onClick={() => {
            setSel(ingredients.map((i) => i.catalog_id).filter(Boolean) as string[])
            setEditIngr(true)
          }}>
            <span className="ingr-row-icons">
              {ingredients.slice(0, 6).map((i) => <IngredientIcon key={i.id} name={i.name} category={i.category} />)}
            </span>
            <span className="ingr-row-text"><strong>{ingredients.length} ingredienti</strong><small>Tocca per modificare</small></span>
            <span className="ingr-row-go">›</span>
          </button>
        ) : (
          <>
            <div className="card-head"><h3>Ingredienti della serata</h3><span className="muted small">{sel.length} scelti</span></div>
            <IngredientPicker pin={pin} catalog={catalog} selected={sel} onChange={setSel} onError={onError} reload={reload} />
            <div className="row sticky-actions">
              <button className="btn" onClick={() => setEditIngr(false)}>Annulla</button>
              <button className="btn btn--primary" onClick={async () => {
                await run(() => adminSetEventIngredients(pin, event.id, sel), 'Ingredienti aggiornati')
                setEditIngr(false)
              }}>Salva ({sel.length})</button>
            </div>
          </>
        )}
      </section>

      <details className="card">
        <summary><strong>Modifica serata</strong></summary>
        <div className="form" style={{ marginTop: 12 }}>
          <label>
            Giorno della serata
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Ordini aperti fino a
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          {dirty && (
            <button className="btn btn--primary" onClick={() => run(() => adminUpdateEvent(pin, event, date, fromLocalInput(deadline), event.closed), 'Serata aggiornata')}>
              Salva
            </button>
          )}
          <div className="row">
            {event.closed ? (
              <button className="btn" onClick={() => run(() => adminUpdateEvent(pin, event, event.event_date, event.deadline, false), 'Ordini riaperti')}>
                Riapri ordini
              </button>
            ) : phase === 'open' && (
              <button className="btn" onClick={closeOrders}>Chiudi ordini ora</button>
            )}
            <button className="btn btn--danger" onClick={() => {
              if (confirm('Eliminare questa serata con tutti i suoi ordini?')) run(() => adminDeleteEvent(pin, event.id), 'Serata eliminata')
            }}>Elimina serata</button>
          </div>
          {!event.closed && phase === 'closed' && (
            <p className="muted small">La scadenza è passata: per riaprire gli ordini sposta più avanti la scadenza.</p>
          )}
        </div>
      </details>
    </>
  )
}

/* ---------------- nuova serata ---------------- */

function NewEvent({ pin, catalog, lastEvent, run, onError, reload, title = 'Nuova serata', onCancel }: Common & {
  lastEvent: EventRow | null; title?: string; onCancel?: () => void
}) {
  // proposta: il giovedì dopo l'ultima serata (o il prossimo, se l'ultima è già passata)
  const firstDate = useMemo(() => {
    const today = new Date()
    if (!lastEvent) return ymd(nextThursday(today))
    const [y, m, d] = lastEvent.event_date.split('-').map(Number)
    const after = new Date(y, m - 1, d + 1)
    return ymd(nextThursday(after > today ? after : today))
  }, [lastEvent])
  const [date, setDate] = useState(firstDate)
  const [deadline, setDeadline] = useState(toLocalInput(defaultDeadline(firstDate)))
  const [sel, setSel] = useState<string[]>([])
  const [last, setLast] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!lastEvent) return
    fetchIngredients(lastEvent.id).then((ings) => setLast(ings.map((i) => i.catalog_id).filter(Boolean) as string[])).catch(() => {})
  }, [lastEvent?.id])

  return (
    <section className="card new-event">
      <div className="card-head">
        <div>
          <span className="eyebrow">{onCancel ? 'Ordini chiusi' : 'Nessuna serata in corso'}</span>
          <h2>{title}</h2>
        </div>
        {onCancel && <button className="iconbtn" aria-label="Chiudi" onClick={onCancel}>×</button>}
      </div>
      <div className="form">
        <label>
          Giorno della serata
          <input type="date" value={date} onChange={(e) => {
            setDate(e.target.value)
            if (e.target.value) setDeadline(toLocalInput(defaultDeadline(e.target.value)))
          }} />
        </label>
        <label>
          Ordini aperti fino a
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
      <h3 style={{ marginTop: 16 }}>Ingredienti <span className="muted small">{sel.length} scelti</span></h3>
      <p className="muted small">Tocca per scegliere dalla dispensa. Se manca qualcosa, aggiungilo: resterà in dispensa per le prossime serate.</p>
      <IngredientPicker pin={pin} catalog={catalog} selected={sel} onChange={setSel} lastSelection={last} onError={onError} reload={reload} />
      <div className="sticky-actions">
        <button className="btn btn--primary btn--block" disabled={busy || !sel.length || !date || !deadline} onClick={async () => {
          setBusy(true)
          await run(() => adminCreateEvent(pin, date, fromLocalInput(deadline), sel), 'Serata creata! Gli ordini sono aperti')
          setBusy(false)
        }}>
          {sel.length ? `Crea serata con ${sel.length} ingredienti` : 'Scegli almeno un ingrediente'}
        </button>
      </div>
    </section>
  )
}

/* ---------------- ordini e invio ad Asinella ---------------- */

function SendToAsinella({ orders, players, flash, phone, onOpenSettings, highlight = false, collapsible = false }: {
  orders: Order[]; players: Player[]; flash: (t: string) => void; phone: string | null; onOpenSettings?: () => void
  highlight?: boolean; collapsible?: boolean
}) {
  const [open, setOpen] = useState(!collapsible)
  const text = asinellaText(orders, players)
  const wa = waNumber(phone)
  if (!orders.length) {
    return highlight ? <section className="card send-card"><h3>Nessun ordine per questa serata</h3></section> : null
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash('Testo copiato: incollalo dove vuoi') } catch { flash('Copia non riuscita, seleziona il testo a mano') }
  }
  return (
    <section className={'card send-card' + (highlight ? ' send-card--hl' : '')}>
      <button className="send-head" onClick={() => collapsible && setOpen((v) => !v)} aria-expanded={open}>
        <h3>{highlight ? "Manda l'ordine ad Asinella" : 'Anteprima ordine per Asinella'}</h3>
        {collapsible && <span className="send-chev">{open ? '−' : '+'}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <pre className="summary">{text}</pre>
            <div className="row">
              {wa ? (
                <a className="btn btn--wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                  Invia ad Asinella su WhatsApp
                </a>
              ) : null}
              <button className={'btn' + (wa ? '' : ' btn--primary')} onClick={copy}>Copia testo</button>
            </div>
            {!wa && onOpenSettings && (
              <button className="linkbtn small" onClick={onOpenSettings}>
                Salva il numero di Asinella per inviarlo con un tocco su WhatsApp
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function OrdersList({ orders, players, onDelete }: {
  orders: Order[]; players: Player[]; onDelete?: (o: Order, name: string) => void
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const ordered = new Set(orders.map((o) => o.player_id))
  const missing = players.filter((p) => !ordered.has(p.id))
  return (
    <section className="card">
      <div className="card-head"><h3>Ordini</h3><span className="pill">{orders.length} 🫓</span></div>
      <ul className="order-list">
        {orders.map((o) => {
          const p = byId.get(o.player_id)
          const name = p ? `${p.first_name} ${p.last_name}` : '?'
          return (
            <li key={o.id} className="order">
              <div className="order-avatar">{p ? p.first_name[0] + p.last_name[0] : '?'}</div>
              <div className="order-body">
                <div className="order-name">{name}</div>
                <div className="order-items">{orderLabel(o)}</div>
                {o.notes && <div className="order-notes">📝 {o.notes}</div>}
              </div>
              {onDelete && <button className="iconbtn" aria-label="Elimina ordine" onClick={() => onDelete(o, name)}>×</button>}
            </li>
          )
        })}
        {!orders.length && <li className="muted small">Ancora nessun ordine.</li>}
      </ul>
      {missing.length > 0 && (
        <details className="missing">
          <summary>Non hanno ancora ordinato ({missing.length})</summary>
          <p>{missing.map((p) => `${p.first_name} ${p.last_name}`).join(', ')}</p>
        </details>
      )}
    </section>
  )
}

function HistoryItem({ event, players, flash, phone }: { event: EventRow; players: Player[]; flash: (t: string) => void; phone: string | null }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const ph = eventPhase(event)
  return (
    <details className="history" onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && !orders) fetchOrders(event.id).then(setOrders).catch(() => setOrders([]))
    }}>
      <summary>
        {formatEventDate(event.event_date)}
        <span className={'pill pill--' + ph}>{({ open: 'Aperta', closed: 'Ordini chiusi', concluded: 'Conclusa' } as const)[ph]}</span>
      </summary>
      {!orders ? <div className="spinner spinner--sm" /> : (
        <>
          <SendToAsinella orders={orders} players={players} flash={flash} phone={phone} />
          {!orders.length && <p className="muted small">Nessun ordine.</p>}
        </>
      )}
    </details>
  )
}
