import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cancelOrder, submitOrder } from '../api'
import { eventPhase, formatDeadline, formatEventDate, isOpen, timeLeft } from '../format'
import { orderLabel } from '../summary'
import { IngredientIcon } from '../piadina/IngredientIcon'
import { PiadinaStage, usePiadinaMotion, type FillingItem } from '../piadina/Piadina'
import { CATEGORIES, type EventRow, type Ingredient, type Order, type Player, type Tab } from '../types'

type Phase = 'compose' | 'sending' | 'done'

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

const buzz = (ms: number | number[] = 8) => { try { navigator.vibrate?.(ms) } catch { /* noop */ } }

export default function Composer({
  player, event, ingredients, orders, onShowOrders, reload,
}: {
  player: Player
  event: EventRow | null
  ingredients: Ingredient[]
  orders: Order[]
  onShowOrders: () => void
  reload: () => Promise<void>
}) {
  const myOrder = orders.find((o) => o.player_id === player.id) ?? null
  const now = useNow()
  const open = isOpen(event, now)
  const evPhase = event ? eventPhase(event, now) : null

  const [selected, setSelected] = useState<string[]>(() =>
    myOrder ? myOrder.items.map((i) => i.id).filter((id) => ingredients.some((g) => g.id === id)) : [],
  )
  const [extra, setExtra] = useState(myOrder?.extra ?? '')
  const [notes, setNotes] = useState(myOrder?.notes ?? '')
  const [tab, setTab] = useState<Tab>('salumi')
  const [phase, setPhase] = useState<Phase>(myOrder ? 'done' : 'compose')
  const [error, setError] = useState<string | null>(null)
  const m = usePiadinaMotion(!!myOrder)
  const tabsRef = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])

  // ingredienti mostrati sulla piadina
  const items: FillingItem[] = useMemo(() => {
    if (phase === 'done' && myOrder) return myOrder.items
    return selected.map((id) => byId.get(id)).filter(Boolean) as FillingItem[]
  }, [phase, myOrder, selected, byId])
  const shownExtra = phase === 'done' && myOrder ? myOrder.extra ?? '' : extra

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const id of selected) {
      const g = byId.get(id)
      if (g) c[g.category] = (c[g.category] ?? 0) + 1
    }
    if (extra.trim()) c.altro = 1
    return c
  }, [selected, byId, extra])

  const tabIngredients = ingredients.filter((i) => i.category === tab)
  const visibleTabs = CATEGORIES.filter((c) => c.key === 'altro' || ingredients.some((i) => i.category === c.key))

  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === tab) && visibleTabs[0]) setTab(visibleTabs[0].key)
  }, [visibleTabs, tab])

  const toggle = (id: string) => {
    buzz()
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const send = async () => {
    if (!event) return
    if (!selected.length && !extra.trim()) {
      setError('La piadina è vuota! Aggiungi almeno un ingrediente.')
      return
    }
    setError(null)
    setPhase('sending')
    buzz(15)
    const req = submitOrder(player.id, event.id, selected, extra, notes)
    const anim = m.close()
    try {
      await Promise.all([req, anim])
      buzz([20, 60, 20])
      await reload()
      setPhase('done')
    } catch (e) {
      setError((e as Error).message)
      await anim.catch(() => {})
      await m.open()
      setPhase('compose')
    }
  }

  const edit = async () => {
    if (myOrder) {
      setSelected(myOrder.items.map((i) => i.id).filter((id) => byId.has(id)))
      setExtra(myOrder.extra ?? '')
      setNotes(myOrder.notes ?? '')
    }
    setPhase('compose')
    await m.open()
  }

  const cancel = async () => {
    if (!event || !confirm('Vuoi annullare il tuo ordine?')) return
    try {
      await cancelOrder(player.id, event.id)
      setSelected([])
      setExtra('')
      setNotes('')
      await m.open()
      setPhase('compose')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (!open && phase === 'compose' && myOrder) {
      m.set(true)
      setPhase('done')
    }
  }, [open, phase, myOrder, m])

  /* ---------- stati vuoti ---------- */
  if (!event) {
    return (
      <div className="empty">
        <img src="/logo-256.png" alt="" width={140} height={115} />
        <h2>Nessuna serata in programma</h2>
        <p className="muted">Quando l'admin carica gli ingredienti della settimana li trovi qui.</p>
      </div>
    )
  }

  if (evPhase === 'concluded') {
    return (
      <div className="concluded">
        <img src="/logo-256.png" alt="" width={150} height={124} />
        <h2>Serata conclusa</h2>
        <p className="muted">
          Quella di {formatEventDate(event.event_date)} è andata! Ci vediamo al prossimo giovedì:
          appena l'admin apre la nuova serata la trovi qui.
        </p>
        {myOrder && <p className="small muted">La tua ultima piadina: {orderLabel(myOrder)}</p>}
      </div>
    )
  }

  const left = timeLeft(event.deadline, now)
  const seed = event.id + player.id

  return (
    <div className={'composer phase-' + phase}>
      <div className={'eventbar' + (open ? '' : ' eventbar--closed')}>
        <div>
          <div className="eventbar-title">Ciao {player.first_name}! · {formatEventDate(event.event_date)}</div>
          <div className="eventbar-sub">
            {open ? <>Ordini aperti fino a {formatDeadline(event.deadline)}</> : <>Ordini chiusi · ci vediamo {formatEventDate(event.event_date)}</>}
          </div>
        </div>
        {open && left && <div className="countdown">{left}</div>}
        {!open && <div className="closed-badge">Chiusi</div>}
      </div>

      <PiadinaStage seed={seed} items={items} extra={shownExtra} m={m} />

      <AnimatePresence mode="wait">
        {phase === 'compose' && open && (
          <motion.div key="compose" className="picker"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
            <div className="tabs" ref={tabsRef} role="tablist">
              {visibleTabs.map((c) => (
                <button key={c.key} role="tab" aria-selected={tab === c.key}
                  className={'tab' + (tab === c.key ? ' is-active' : '')} onClick={() => setTab(c.key)}>
                  {c.label}
                  {counts[c.key] ? <span className="badge">{counts[c.key]}</span> : null}
                </button>
              ))}
            </div>

            {tab === 'altro' ? (
              <div className="altro">
                <label>
                  Vuoi aggiungere qualcos'altro?
                  <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={80}
                    placeholder="es. doppio formaggio, rucola…" />
                </label>
                <label>
                  Note per la cucina
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={120}
                    placeholder="es. ben cotta, tagliata a metà…" />
                </label>
              </div>
            ) : (
              <div className="grid">
                {tabIngredients.map((g) => {
                  const on = selected.includes(g.id)
                  return (
                    <motion.button key={g.id} className={'ing' + (on ? ' is-on' : '')} onClick={() => toggle(g.id)}
                      whileTap={{ scale: 0.94 }} aria-pressed={on}>
                      <IngredientIcon name={g.name} category={g.category} />
                      <span className="ing-name">{g.name}</span>
                      <span className="ing-check" aria-hidden="true">{on ? '✓' : '+'}</span>
                    </motion.button>
                  )
                })}
                {!tabIngredients.length && <p className="muted">Niente in questa categoria stavolta.</p>}
              </div>
            )}

            {error && <p className="error">{error}</p>}

            <div className="sendbar">
              <div className="sendbar-summary">
                {selected.length + (extra.trim() ? 1 : 0) === 0
                  ? 'Tocca gli ingredienti per farcirla'
                  : `${selected.length + (extra.trim() ? 1 : 0)} ingredienti`}
              </div>
              <button className="btn btn--primary" onClick={send}
                disabled={selected.length === 0 && !extra.trim()}>
                {myOrder ? 'Chiudi e aggiorna' : 'Chiudi e invia'}
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'sending' && (
          <motion.p key="sending" className="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Te la stiamo chiudendo…
          </motion.p>
        )}

        {phase === 'done' && myOrder && (
          <motion.div key="done" className="card done"
            initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <h2>{open ? 'Ordine inviato!' : 'La tua piadina è confermata'}</h2>
            {!open && <p className="muted small">Gli ordini sono chiusi: la trovi {formatEventDate(event.event_date)} dopo l'allenamento.</p>}
            <p className="done-items">
              {orderLabel(myOrder)}
            </p>
            {myOrder.notes && <p className="muted">Note: {myOrder.notes}</p>}
            {error && <p className="error">{error}</p>}
            <div className="done-actions">
              {open && <button className="btn" onClick={edit}>Modifica</button>}
              <button className="btn btn--primary" onClick={onShowOrders}>Vedi tutti gli ordini</button>
            </div>
            {open && <button className="linkbtn" onClick={cancel}>Annulla ordine</button>}
          </motion.div>
        )}

        {phase !== 'sending' && !open && !myOrder && (
          <motion.div key="closed" className="card done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2>Questa settimana non hai ordinato</h2>
            <p className="muted">Gli ordini per {formatEventDate(event.event_date)} sono chiusi. Se è un'emergenza, scrivi all'admin.</p>
            <button className="btn btn--primary" onClick={onShowOrders}>Vedi gli ordini</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
