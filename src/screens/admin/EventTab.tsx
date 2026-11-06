import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  adminCreateEvent, adminDeleteEvent, adminDeleteOrder, adminSetEventIngredients, adminUpdateEvent,
  fetchEvents, fetchIngredients, fetchOrders, loginPlayer,
} from '../../api'
import {
  eventPhase, formatDeadline, formatEventDate, fromLocalInput, nextThursday, timeLeft, toLocalInput, ymd,
} from '../../format'
import { IngredientIcon } from '../../piadina/IngredientIcon'
import { asinellaText, orderLabel } from '../../summary'
import type { CatalogItem, EventRow, Ingredient, Order, Player } from '../../types'
import { IngredientPicker } from './IngredientPicker'
import { ask } from '../../confirm'
import { fullName, initials } from '../../names'

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

export function EventTab({ event, ingredients, orders, me, onGoHome, onLogin, ...c }: Common & {
  event: EventRow | null; ingredients: Ingredient[]; orders: Order[]; me: Player | null; onGoHome: () => void
  onLogin: (p: Player) => void
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
          me={me} onGoHome={onGoHome} onLogin={onLogin}
          nextSlot={phase === 'closed' && (
            showNext ? (
              <NewEvent {...c} lastEvent={latest ?? null} title="Prossima serata" onCancel={() => setShowNext(false)} />
            ) : (
              <motion.button className="next-event-btn" onClick={() => setShowNext(true)} whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                <span className="next-event-plus">+</span>
                <span>
                  <strong>Crea la prossima serata</strong>
                  <small>Gli ordini di questa sono chiusi: puoi già aprire la successiva</small>
                </span>
              </motion.button>
            )
          )} />
      )}

      {(!event || phase === 'concluded') && <NewEvent {...c} lastEvent={latest ?? null} />}

      {others.length > 0 && (
        <details className="card others">
          <summary><strong>Altre serate</strong> <span className="muted small">{others.length}</span></summary>
          {others.map((e) => <HistoryItem key={e.id} event={e} players={c.players} flash={c.flash} phone={c.phone} />)}
        </details>
      )}
    </div>
  )
}

/* ---------------- serata in corso: un unico riquadro ---------------- */

function Row({ title, count, children, open, onToggle }: {
  title: string; count?: number; children: ReactNode; open: boolean; onToggle: () => void
}) {
  return (
    <div className={'ev-row' + (open ? ' is-open' : '')}>
      <button className="ev-row-head" onClick={onToggle} aria-expanded={open}>
        <span>{title}{count !== undefined && <span className="ev-row-count">{count}</span>}</span>
        <span className="ev-row-chev" aria-hidden="true">›</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="ev-row-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
            <div className="ev-row-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CurrentEvent({ pin, event, phase, now, ingredients, orders, players, catalog, run, flash, onError, reload, phone,
  onOpenSettings, me, onGoHome, onLogin, nextSlot }: Common & {
  event: EventRow; phase: 'open' | 'closed'; now: number; ingredients: Ingredient[]; orders: Order[]
  me: Player | null; onGoHome: () => void; onLogin: (p: Player) => void; nextSlot?: ReactNode
}) {
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editIngr, setEditIngr] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [date, setDate] = useState(event.event_date)
  const [deadline, setDeadline] = useState(toLocalInput(event.deadline))
  useEffect(() => { setDate(event.event_date); setDeadline(toLocalInput(event.deadline)) }, [event.event_date, event.deadline])
  useEffect(() => { setEditing(false) }, [event.id])
  const left = timeLeft(event.deadline, now)
  const myOrder = me ? orders.find((o) => o.player_id === me.id) : null
  const toggle = (k: string) => setOpenRow((v) => (v === k ? null : k))
  const text = asinellaText(orders, players)
  const wa = waNumber(phone)
  const n = orders.length

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash('Testo copiato: incollalo dove vuoi') } catch { flash('Copia non riuscita, seleziona il testo a mano') }
  }
  const closeOrders = async () => {
    if (await ask({ title: 'Chiudere gli ordini?', message: 'Nessuno potrà più ordinare o modificare la piadina. Potrai riaprirli.', confirm: 'Chiudi ordini', icon: '🔒' })) {
      run(() => adminUpdateEvent(pin, event, event.event_date, event.deadline, true), 'Ordini chiusi')
    }
  }
  const reopen = async () => {
    // se la scadenza è già passata, riapriamo per 2 ore (modificabile con "Modifica")
    let dl = event.deadline
    if (new Date(dl).getTime() <= Date.now()) dl = new Date(Date.now() + 2 * 3600e3).toISOString()
    if (await ask({ title: 'Riaprire gli ordini?', message: `Si potrà ordinare fino a ${formatDeadline(dl)}.`, confirm: 'Riapri', icon: '🔓' })) {
      run(() => adminUpdateEvent(pin, event, event.event_date, dl, false), 'Ordini riaperti')
    }
  }
  const remove = async () => {
    if (await ask({
      title: 'Eliminare la serata?',
      message: n
        ? `Verranno cancellati per sempre anche ${n === 1 ? "l'ordine fatto" : `i ${n} ordini fatti`}. Per fermare gli ordini usa invece "Chiudi ordini".`
        : 'La serata sparirà del tutto.',
      confirm: 'Elimina', danger: true,
    })) {
      run(() => adminDeleteEvent(pin, event.id), 'Serata eliminata')
    }
  }

  return (
    <>
      <section className={'card ev-card ev-card--' + phase}>
        {/* testata colorata */}
        <div className="ev-top">
          <div className="event-hero-top">
            <div>
              <span className="eyebrow">{phase === 'open' ? 'Ordini aperti' : 'Ordini chiusi'}</span>
              <h2>{formatEventDate(event.event_date)}</h2>
              <p className="small">
                {phase === 'open' ? <>Si ordina fino a {formatDeadline(event.deadline)}</> : <>Scadenza: {formatDeadline(event.deadline)}</>}
              </p>
            </div>
            {phase === 'open' && left && (
              <div className="event-hero-stat"><strong>{left}</strong><span>alla chiusura</span></div>
            )}
          </div>
          <p className="ev-count"><strong>{n}</strong> {n === 1 ? 'piadina ordinata' : 'piadine ordinate'}</p>
          {me && (myOrder || phase === 'closed') && (
            <button className="hero-me" onClick={onGoHome}>
              {myOrder
                ? <>La tua: <strong>{orderLabel(myOrder)}</strong>{phase === 'open' && ' · modifica →'}</>
                : <>Non hai ordinato la tua piadina</>}
            </button>
          )}
          {/* azioni sulla serata */}
          <div className="ev-top-actions">
            {phase === 'open'
              ? <button className="ev-pill" onClick={closeOrders}>🔒 Chiudi ordini</button>
              : <button className="ev-pill" onClick={reopen}>🔓 Riapri</button>}
            <button className={'ev-pill' + (editing ? ' is-on' : '')} onClick={() => setEditing((v) => !v)}>✏️ Modifica</button>
            <button className="ev-pill ev-pill--danger" onClick={remove}>🗑 Elimina</button>
          </div>
        </div>

        {/* modifica giorno e scadenza */}
        <AnimatePresence initial={false}>
          {editing && (
            <motion.div className="ev-edit" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className="form">
                <label>
                  Giorno della serata
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label>
                  Ordini aperti fino a
                  <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </label>
                <div className="row">
                  <button className="btn" onClick={() => setEditing(false)}>Annulla</button>
                  <button className="btn btn--primary" onClick={async () => {
                    await run(() => adminUpdateEvent(pin, event, date, fromLocalInput(deadline), event.closed), 'Serata aggiornata')
                    setEditing(false)
                  }}>Salva</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* azioni principali */}
        {phase === 'open' && !myOrder && (
          <div className="ev-actions">
            <MyPiadinaButton me={me} onGoHome={onGoHome} onLogin={onLogin} onError={onError} />
          </div>
        )}
        {phase === 'closed' && (
          <div className="ev-actions">
            {n ? (
              <>
                {wa && (
                  <a className="btn btn--wa btn--block" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                    Invia ad Asinella su WhatsApp
                  </a>
                )}
                <button className={'btn btn--block' + (wa ? '' : ' btn--primary')} onClick={copy}>Copia testo per Asinella</button>
                {!wa && <button className="linkbtn small" onClick={onOpenSettings}>Salva il numero di Asinella per inviarlo con un tocco</button>}
              </>
            ) : <p className="muted small">Nessuno ha ordinato per questa serata.</p>}
          </div>
        )}

        {/* dettagli che si aprono */}
        <div className="ev-rows">
          <Row title="Ordini" count={n} open={openRow === 'ordini'} onToggle={() => toggle('ordini')}>
            <OrdersList orders={orders} players={players}
              onDelete={async (o, name) => { if (await ask({ title: `Eliminare l'ordine di ${name}?`, confirm: 'Elimina', danger: true })) run(() => adminDeleteOrder(pin, o.id), 'Ordine eliminato') }} />
          </Row>

          {phase === 'open' && (
            <Row title="Testo per Asinella" open={openRow === 'testo'} onToggle={() => toggle('testo')}>
              {n ? (
                <>
                  <pre className="summary">{text}</pre>
                  <button className="btn btn--sm" onClick={copy}>Copia testo</button>
                </>
              ) : <p className="muted small">Ancora nessun ordine.</p>}
            </Row>
          )}

          <Row title="Ingredienti" count={ingredients.length} open={openRow === 'ingredienti'} onToggle={() => { toggle('ingredienti'); setEditIngr(false) }}>
            {!editIngr ? (
              <>
                <div className="chips">
                  {ingredients.map((i) => (
                    <span key={i.id} className="chip chip--static"><IngredientIcon name={i.name} category={i.category} />{i.name}</span>
                  ))}
                  {!ingredients.length && <span className="muted small">Nessun ingrediente</span>}
                </div>
                <button className="btn btn--sm" onClick={() => {
                  setSel(ingredients.map((i) => i.catalog_id).filter(Boolean) as string[])
                  setEditIngr(true)
                }}>Modifica ingredienti</button>
              </>
            ) : (
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
            )}
          </Row>
        </div>
      </section>

      {nextSlot}
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
  // le salse ci sono sempre: partono già selezionate (si possono togliere)
  const saucesInit = useRef(false)
  useEffect(() => {
    if (saucesInit.current || !catalog.length) return
    saucesInit.current = true
    const sauces = catalog.filter((c) => c.category === 'salse').map((c) => c.id)
    setSel((cur) => [...new Set([...cur, ...sauces])])
  }, [catalog])
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
          await run(() => adminCreateEvent(pin, date, fromLocalInput(deadline), sel), 'Serata creata! Ora ordina anche la tua piadina')
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
  if (!orders.length) return <p className="muted small">Ancora nessun ordine.</p>
  return (
    <ul className="order-list">
      {orders.map((o) => {
        const p = byId.get(o.player_id)
        const name = p ? fullName(p) : '?'
        return (
          <li key={o.id} className="order">
            <div className="order-avatar">{p ? initials(p) : '?'}</div>
            <div className="order-body">
              <div className="order-name">{name}</div>
              <div className="order-items">{orderLabel(o)}</div>
              {o.notes && <div className="order-notes">📝 {o.notes}</div>}
            </div>
            {onDelete && <button className="iconbtn" aria-label="Elimina ordine" onClick={() => onDelete(o, name)}>×</button>}
          </li>
        )
      })}
    </ul>
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

/** Bottone ben visibile per l'admin: ordina la tua piadina (chiede nome e cognome se su questo telefono mancano) */
function MyPiadinaButton({ me, onGoHome, onLogin, onError }: {
  me: Player | null; onGoHome: () => void; onLogin: (p: Player) => void; onError: (m: string) => void
}) {
  const [asking, setAsking] = useState(false)
  const [first, setFirst] = useState('')
  const [busy, setBusy] = useState(false)

  if (!asking) {
    return (
      <motion.button className="btn btn--primary btn--block btn--big" whileTap={{ scale: 0.97 }}
        onClick={() => (me ? onGoHome() : setAsking(true))}>
        🫓 Ordina la tua piadina
      </motion.button>
    )
  }
  return (
    <form className="form my-name" onSubmit={async (e) => {
      e.preventDefault()
      if (first.trim().length < 2) return onError('Scrivi il tuo nome')
      setBusy(true)
      try {
        const p = await loginPlayer(first, '')
        onLogin(p)
        onGoHome()
      } catch (err) {
        onError((err as Error).message)
      } finally {
        setBusy(false)
      }
    }}>
      <div className="my-name-row">
        <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Nome" autoComplete="given-name" autoCapitalize="words" autoFocus />
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => setAsking(false)}>Annulla</button>
        <button className="btn btn--primary" disabled={busy}>{busy ? '…' : 'Continua'}</button>
      </div>
    </form>
  )
}
