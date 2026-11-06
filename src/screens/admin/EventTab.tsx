import { motion } from 'framer-motion'
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

export function EventTab({ pin, event, ingredients, orders, players, catalog, run, flash, onError, reload }: {
  pin: string; event: EventRow | null; ingredients: Ingredient[]; orders: Order[]; players: Player[]; catalog: CatalogItem[]
  run: Run; flash: (t: string) => void; onError: (m: string) => void; reload: () => Promise<void>
}) {
  const now = useNow()
  const phase = event ? eventPhase(event, now) : null
  const [history, setHistory] = useState<EventRow[]>([])

  useEffect(() => {
    fetchEvents().then(setHistory).catch(() => {})
  }, [event?.id, event?.event_date, phase])

  const [showNext, setShowNext] = useState(false)
  useEffect(() => { setShowNext(false) }, [event?.id])
  const others = history.filter((e) => e.id !== event?.id)
  const latest = history[0] ?? event

  return (
    <div className="event-tab">
      {event && phase !== 'concluded' && (
        <CurrentEvent pin={pin} event={event} phase={phase!} now={now} ingredients={ingredients} orders={orders}
          players={players} catalog={catalog} run={run} flash={flash} onError={onError} reload={reload} />
      )}

      {(!event || phase === 'concluded') && (
        <NewEvent pin={pin} catalog={catalog} lastEvent={latest ?? null} run={run} onError={onError} reload={reload} />
      )}

      {event && phase === 'closed' && (
        showNext ? (
          <NewEvent pin={pin} catalog={catalog} lastEvent={latest ?? null} run={run} onError={onError} reload={reload}
            title="Prossima serata" onCancel={() => setShowNext(false)} />
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

      {others.length > 0 && (
        <section className="card">
          <h3>Altre serate</h3>
          {others.map((e) => <HistoryItem key={e.id} event={e} players={players} flash={flash} />)}
        </section>
      )}
    </div>
  )
}

/* ---------------- serata in corso ---------------- */

function CurrentEvent({ pin, event, phase, now, ingredients, orders, players, catalog, run, flash, onError, reload }: {
  pin: string; event: EventRow; phase: 'open' | 'closed'; now: number; ingredients: Ingredient[]; orders: Order[]
  players: Player[]; catalog: CatalogItem[]; run: Run; flash: (t: string) => void; onError: (m: string) => void; reload: () => Promise<void>
}) {
  const [editIngr, setEditIngr] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [date, setDate] = useState(event.event_date)
  const [deadline, setDeadline] = useState(toLocalInput(event.deadline))
  useEffect(() => { setDate(event.event_date); setDeadline(toLocalInput(event.deadline)) }, [event.event_date, event.deadline])
  const left = timeLeft(event.deadline, now)
  const dirty = date !== event.event_date || deadline !== toLocalInput(event.deadline)

  return (
    <>
      <motion.section layout className={'card event-hero event-hero--' + phase}>
        <div className="event-hero-top">
          <div>
            <span className="eyebrow">{phase === 'open' ? 'Serata in corso' : 'Ordini chiusi'}</span>
            <h2>{formatEventDate(event.event_date)}</h2>
            <p className="small">
              {phase === 'open' ? <>Si ordina fino a {formatDeadline(event.deadline)}</> : <>Scadenza: {formatDeadline(event.deadline)}{event.closed && ' (chiusi a mano)'}</>}
            </p>
          </div>
          <div className="event-hero-stat">
            {phase === 'open' && left ? <><strong>{left}</strong><span>alla chiusura</span></> : <><strong>{orders.length}</strong><span>piadine</span></>}
          </div>
        </div>
        {phase === 'open' && <p className="small event-hero-count">{orders.length} {orders.length === 1 ? 'piadina ordinata' : 'piadine ordinate'} finora</p>}
      </motion.section>

      {phase === 'closed' && (
        <SendToAsinella event={event} orders={orders} players={players} flash={flash} highlight />
      )}

      <section className="card">
        <div className="card-head">
          <h3>Ingredienti della serata <span className="muted small">{ingredients.length}</span></h3>
          {!editIngr && (
            <button className="btn btn--sm" onClick={() => {
              setSel(ingredients.map((i) => i.catalog_id).filter(Boolean) as string[])
              setEditIngr(true)
            }}>Modifica</button>
          )}
        </div>
        {editIngr ? (
          <>
            <IngredientPicker pin={pin} catalog={catalog} selected={sel} onChange={setSel} onError={onError} reload={reload} />
            <div className="row sticky-actions">
              <button className="btn" onClick={() => setEditIngr(false)}>Annulla</button>
              <button className="btn btn--primary" onClick={async () => {
                await run(() => adminSetEventIngredients(pin, event.id, sel), 'Ingredienti aggiornati')
                setEditIngr(false)
              }}>Salva ({sel.length})</button>
            </div>
          </>
        ) : (
          <div className="chips">
            {ingredients.map((i) => (
              <span key={i.id} className="chip chip--static"><IngredientIcon name={i.name} category={i.category} />{i.name}</span>
            ))}
            {!ingredients.length && <span className="muted small">Nessun ingrediente: tocca Modifica</span>}
          </div>
        )}
      </section>

      {phase === 'open' && <SendToAsinella event={event} orders={orders} players={players} flash={flash} />}

      <OrdersList orders={orders} players={players}
        onDelete={(o, name) => { if (confirm(`Eliminare l'ordine di ${name}?`)) run(() => adminDeleteOrder(pin, o.id), 'Ordine eliminato') }} />

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
            <button className="btn" onClick={() => run(
              () => adminUpdateEvent(pin, event, event.event_date, event.deadline, !event.closed),
              event.closed ? 'Ordini riaperti' : 'Ordini chiusi')}>
              {event.closed ? 'Riapri ordini' : 'Chiudi ordini ora'}
            </button>
            <button className="btn btn--danger" onClick={() => {
              if (confirm('Eliminare questa serata con tutti i suoi ordini?')) run(() => adminDeleteEvent(pin, event.id), 'Serata eliminata')
            }}>Elimina serata</button>
          </div>
          {!event.closed && phase === 'closed' && (
            <p className="muted small">La scadenza è passata: per riaprire sposta più avanti la data di scadenza.</p>
          )}
        </div>
      </details>
    </>
  )
}

/* ---------------- nuova serata ---------------- */

function NewEvent({ pin, catalog, lastEvent, run, onError, reload, title = 'Nuova serata', onCancel }: {
  pin: string; catalog: CatalogItem[]; lastEvent: EventRow | null; run: Run; onError: (m: string) => void; reload: () => Promise<void>
  title?: string; onCancel?: () => void
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

function SendToAsinella({ event, orders, players, flash, highlight = false }: {
  event: EventRow; orders: Order[]; players: Player[]; flash: (t: string) => void; highlight?: boolean
}) {
  const text = asinellaText(orders, players)
  if (!orders.length) {
    return highlight ? <section className="card send-card"><h3>Nessun ordine per {formatEventDate(event.event_date)}</h3></section> : null
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash('Copiato! Incollalo su WhatsApp') } catch { flash('Copia non riuscita, seleziona il testo a mano') }
  }
  return (
    <section className={'card send-card' + (highlight ? ' send-card--hl' : '')}>
      <h3>{highlight ? "Manda l'ordine ad Asinella" : 'Riepilogo per Asinella'}</h3>
      <pre className="summary">{text}</pre>
      <div className="row">
        <button className="btn btn--primary" onClick={copy}>Copia per Asinella</button>
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Apri WhatsApp</a>
      </div>
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

function HistoryItem({ event, players, flash }: { event: EventRow; players: Player[]; flash: (t: string) => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  return (
    <details className="history" onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && !orders) fetchOrders(event.id).then(setOrders).catch(() => setOrders([]))
    }}>
      <summary>
        {formatEventDate(event.event_date)}
        <span className={'pill pill--' + eventPhase(event)}>{({ open: 'Aperta', closed: 'Ordini chiusi', concluded: 'Conclusa' } as const)[eventPhase(event)]}</span>
      </summary>
      {!orders ? <div className="spinner spinner--sm" /> : (
        <>
          <SendToAsinella event={event} orders={orders} players={players} flash={flash} />
          {!orders.length && <p className="muted small">Nessun ordine.</p>}
        </>
      )}
    </details>
  )
}
