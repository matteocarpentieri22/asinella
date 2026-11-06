import { useEffect, useRef, useState } from 'react'
import {
  adminAddIngredient, adminChangePin, adminDeleteIngredientImage, generateIngredientImage, adminCheck, adminDeleteEvent, adminDeleteIngredient, adminDeleteOrder, adminSaveEvent,
} from '../api'
import { formatEventDate, fromLocalInput, isOpen, nextThursday, toLocalInput, ymd } from '../format'
import { IngredientIcon } from '../piadina/IngredientIcon'
import { PIADINA_KEY, nameKey, type IngredientImage, type ImageMap } from '../piadina/images'
import { Dough } from '../piadina/Piadina'
import { asinellaText, orderLabel } from '../summary'
import type { Category, EventRow, Ingredient, Order, Player } from '../types'

const PIN_KEY = 'asinella.adminPin'
const CATS: { key: Category; label: string; placeholder: string }[] = [
  { key: 'salumi', label: 'Salumi', placeholder: 'es. cotto, speck, pancetta' },
  { key: 'formaggi', label: 'Formaggi', placeholder: 'es. dobbiaco, provola, brie' },
  { key: 'verdure', label: 'Verdure', placeholder: 'es. zucchine, melanzane, insalata' },
  { key: 'salse', label: 'Salse', placeholder: 'es. salsa rosa, senape, ketchup' },
]

function defaultDeadline(eventDate: string) {
  const [y, m, d] = eventDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1, 22, 0)
  return dt.toISOString()
}

export default function Admin({
  event, ingredients, orders, players, images, reload,
}: {
  event: EventRow | null; ingredients: Ingredient[]; orders: Order[]; players: Player[]; images: ImageMap
  reload: () => Promise<void>
}) {
  const [pin, setPin] = useState(() => sessionStorage.getItem(PIN_KEY) || '')
  const [authed, setAuthed] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [generating, setGenerating] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Ingredient | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  /** Generazione in coda, una alla volta: ogni immagine usa le precedenti come riferimento di stile */
  const gen = (name: string, category: string, key = nameKey(name)) => {
    setGenerating((g) => new Set(g).add(key))
    queue.current = queue.current.then(async () => {
      try {
        await generateIngredientImage(pin, name, category)
      } catch (e) {
        setErr(`${name}: ${(e as Error).message}`)
      } finally {
        setGenerating((g) => { const n = new Set(g); n.delete(key); return n })
        await reload()
      }
    })
  }
  const missing = ingredients.filter((i) => images.get(nameKey(i.name))?.status !== 'ok' && !generating.has(nameKey(i.name)))

  useEffect(() => {
    if (pin) adminCheck(pin).then(setAuthed).catch(() => setAuthed(false))
  }, [pin])

  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(null), 2200) }
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setErr(null)
    try {
      await fn()
      await reload()
      if (ok) flash(ok)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (!authed) {
    return (
      <form className="card form admin-login" onSubmit={async (e) => {
        e.preventDefault()
        setErr(null)
        const ok = await adminCheck(pinInput).catch(() => false)
        if (ok) { sessionStorage.setItem(PIN_KEY, pinInput); setPin(pinInput); setAuthed(true) }
        else setErr('PIN errato')
      }}>
        <h2>Area admin</h2>
        <label>
          PIN
          <input type="password" inputMode="numeric" autoComplete="current-password" value={pinInput}
            onChange={(e) => setPinInput(e.target.value)} autoFocus />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn--primary btn--block">Entra</button>
      </form>
    )
  }

  return (
    <div className="admin">
      {msg && <div className="toast">{msg}</div>}
      {err && <div className="toast toast--error" onClick={() => setErr(null)}>{err}</div>}

      <EventEditor pin={pin} event={event} run={run} />

      <PiadinaCard image={images.get(PIADINA_KEY)} busy={generating.has(PIADINA_KEY)}
        onGenerate={() => gen('piadina', 'piadina', PIADINA_KEY)}
        onUseDrawing={() => run(() => adminDeleteIngredientImage(pin, PIADINA_KEY), 'Torno al disegno')} />

      {event && (
        <>
          <section className="card">
            <div className="card-head">
              <h3>Ingredienti della settimana</h3>
              {missing.length > 0 && (
                <button className="btn btn--accent btn--sm" onClick={() => {
                  const seen = new Set<string>()
                  for (const i of missing) {
                    const k = nameKey(i.name)
                    if (!seen.has(k)) { seen.add(k); gen(i.name, i.category) }
                  }
                }}>Genera immagini ({missing.length})</button>
              )}
            </div>
            {CATS.map((c) => (
              <CategoryEditor key={c.key} pin={pin} event={event} cat={c} images={images} generating={generating}
                onPreview={setPreview}
                onAdded={(names) => names.forEach((n) => { if (images.get(nameKey(n))?.status !== 'ok') gen(n, c.key) })}
                items={ingredients.filter((i) => i.category === c.key)} run={run} />
            ))}
            {generating.size > 0 && (
              <p className="muted small">Gemini sta preparando {generating.size} {generating.size === 1 ? 'immagine' : 'immagini'}…</p>
            )}
            <p className="muted small">La voce "Altro" (testo libero) è sempre disponibile per i giocatori.</p>
          </section>

          <OrdersAdmin pin={pin} event={event} orders={orders} players={players} run={run} flash={flash} />
        </>
      )}

      {preview && (
        <ImagePreview ingredient={preview} image={images.get(nameKey(preview.name))}
          busy={generating.has(nameKey(preview.name))}
          onClose={() => setPreview(null)}
          onRegenerate={() => gen(preview.name, preview.category)}
          onUseDrawing={() => run(() => adminDeleteIngredientImage(pin, nameKey(preview.name)), 'Torno al disegno')} />
      )}

      <PinChanger pin={pin} onChanged={(p) => { sessionStorage.setItem(PIN_KEY, p); setPin(p) }} run={run} />

      <button className="linkbtn" onClick={() => { sessionStorage.removeItem(PIN_KEY); setAuthed(false); setPin('') }}>
        Esci dall'area admin
      </button>
    </div>
  )
}

function EventEditor({ pin, event, run }: {
  pin: string; event: EventRow | null; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(!event)
  const [date, setDate] = useState(event?.event_date ?? ymd(nextThursday()))
  const [deadline, setDeadline] = useState(toLocalInput(event?.deadline ?? defaultDeadline(ymd(nextThursday()))))
  const [copy, setCopy] = useState(true)

  useEffect(() => {
    if (event && !creating) {
      setDate(event.event_date)
      setDeadline(toLocalInput(event.deadline))
    }
  }, [event, creating])

  const startNew = () => {
    const base = event ? new Date(event.event_date + 'T12:00') : new Date()
    const next = nextThursday(new Date(base.getTime() + (event ? 86400000 : 0)))
    const d = ymd(next)
    setDate(d)
    setDeadline(toLocalInput(defaultDeadline(d)))
    setCreating(true)
  }

  if (creating) {
    return (
      <section className="card">
        <h3>Nuova serata</h3>
        <div className="form">
          <label>
            Giorno della piadina
            <input type="date" value={date} onChange={(e) => {
              setDate(e.target.value)
              if (e.target.value) setDeadline(toLocalInput(defaultDeadline(e.target.value)))
            }} />
          </label>
          <label>
            Ordini aperti fino a
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          {event && (
            <label className="check">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
              Copia gli ingredienti di {formatEventDate(event.event_date)}
            </label>
          )}
          <div className="row">
            {event && <button className="btn" onClick={() => setCreating(false)}>Annulla</button>}
            <button className="btn btn--primary" onClick={() => run(async () => {
              await adminSaveEvent(pin, null, date, fromLocalInput(deadline), false, copy && event ? event.id : null)
              setCreating(false)
            }, 'Serata creata')}>Crea serata</button>
          </div>
        </div>
      </section>
    )
  }

  if (!event) return null
  const open = isOpen(event)
  return (
    <section className="card">
      <div className="card-head">
        <h3>Serata di {formatEventDate(event.event_date)}</h3>
        <span className={'pill ' + (open ? 'pill--ok' : 'pill--off')}>{open ? 'Aperta' : 'Chiusa'}</span>
      </div>
      <div className="form">
        <label>
          Giorno
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Ordini aperti fino a
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn btn--primary" onClick={() => run(
            () => adminSaveEvent(pin, event.id, date, fromLocalInput(deadline), event.closed), 'Salvato')}>
            Salva
          </button>
          <button className="btn" onClick={() => run(
            () => adminSaveEvent(pin, event.id, event.event_date, event.deadline, !event.closed),
            event.closed ? 'Ordini riaperti' : 'Ordini chiusi')}>
            {event.closed ? 'Riapri ordini' : 'Chiudi ordini ora'}
          </button>
        </div>
        <div className="row">
          <button className="btn btn--accent" onClick={startNew}>+ Nuova serata</button>
          <button className="btn btn--danger" onClick={() => {
            if (confirm('Eliminare questa serata con ingredienti e ordini?')) run(() => adminDeleteEvent(pin, event.id), 'Serata eliminata')
          }}>Elimina</button>
        </div>
      </div>
    </section>
  )
}

function CategoryEditor({ pin, event, cat, items, run, images, generating, onPreview, onAdded }: {
  pin: string; event: EventRow; cat: { key: Category; label: string; placeholder: string }; items: Ingredient[]
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>
  images: ImageMap; generating: Set<string>; onPreview: (i: Ingredient) => void; onAdded: (names: string[]) => void
}) {
  const [name, setName] = useState('')
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const names = name.split(',').map((s) => s.trim()).filter(Boolean)
    if (!names.length) return
    await run(async () => {
      for (const n of names) await adminAddIngredient(pin, event.id, cat.key, n)
    })
    onAdded(names)
    setName('')
  }
  return (
    <div className="cat-editor">
      <h4>{cat.label}</h4>
      <div className="chips">
        {items.map((i) => (
          <span key={i.id} className="chip">
            <button className="chip-main" onClick={() => onPreview(i)} aria-label={`Immagine di ${i.name}`}>
              <span className="chip-icon">
                <IngredientIcon name={i.name} category={i.category} />
                {(generating.has(nameKey(i.name)) || images.get(nameKey(i.name))?.status === 'pending') && <span className="chip-spin" />}
                {images.get(nameKey(i.name))?.status === 'error' && !generating.has(nameKey(i.name)) && <span className="chip-err">!</span>}
              </span>
              {i.name}
            </button>
            <button aria-label={`Rimuovi ${i.name}`} onClick={() => run(() => adminDeleteIngredient(pin, i.id))}>×</button>
          </span>
        ))}
        {!items.length && <span className="muted small">Nessuno</span>}
      </div>
      <form className="add-row" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={cat.placeholder} enterKeyHint="done" />
        <button className="btn btn--primary" disabled={!name.trim()}>Aggiungi</button>
      </form>
    </div>
  )
}

function OrdersAdmin({ pin, event, orders, players, run, flash }: {
  pin: string; event: EventRow; orders: Order[]; players: Player[]
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>; flash: (t: string) => void
}) {
  const byId = new Map(players.map((p) => [p.id, p]))
  const ordered = new Set(orders.map((o) => o.player_id))
  const missing = players.filter((p) => !ordered.has(p.id))
  const text = asinellaText(orders, players)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      flash('Copiato! Incollalo su WhatsApp')
    } catch {
      flash('Copia non riuscita, seleziona il testo a mano')
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>Ordini</h3>
        <span className="pill">{orders.length} 🫓</span>
      </div>
      {orders.length > 0 && (
        <>
          <pre className="summary">{text}</pre>
          <div className="row">
            <button className="btn btn--primary" onClick={copy}>Copia per Asinella</button>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
              Apri WhatsApp
            </a>
          </div>
        </>
      )}
      <ul className="order-list">
        {orders.map((o) => {
          const p = byId.get(o.player_id)
          return (
            <li key={o.id} className="order">
              <div className="order-avatar">{p ? p.first_name[0] + p.last_name[0] : '?'}</div>
              <div className="order-body">
                <div className="order-name">{p ? `${p.first_name} ${p.last_name}` : '?'}</div>
                <div className="order-items">{orderLabel(o)}</div>
                {o.notes && <div className="order-notes">📝 {o.notes}</div>}
              </div>
              <button className="iconbtn" aria-label="Elimina ordine" onClick={() => {
                if (confirm(`Eliminare l'ordine di ${p?.first_name ?? '?'}?`)) run(() => adminDeleteOrder(pin, o.id), 'Ordine eliminato')
              }}>×</button>
            </li>
          )
        })}
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

function PinChanger({ pin, onChanged, run }: {
  pin: string; onChanged: (p: string) => void; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>
}) {
  const [np, setNp] = useState('')
  return (
    <details className="card">
      <summary><strong>Cambia PIN admin</strong></summary>
      <form className="add-row" onSubmit={(e) => {
        e.preventDefault()
        run(async () => { await adminChangePin(pin, np); onChanged(np); setNp('') }, 'PIN aggiornato')
      }}>
        <input type="password" value={np} onChange={(e) => setNp(e.target.value)} placeholder="Nuovo PIN (min 4)" autoComplete="new-password" />
        <button className="btn btn--primary" disabled={np.length < 4}>Salva</button>
      </form>
    </details>
  )
}

function ImagePreview({ ingredient, image, busy, onClose, onRegenerate, onUseDrawing }: {
  ingredient: Ingredient; image: IngredientImage | undefined
  busy: boolean; onClose: () => void; onRegenerate: () => void; onUseDrawing: () => void
}) {
  const isSauce = ingredient.category === 'salse'
  const hasGenerated = !!image && !!(image.image_url || image.color)
  const pending = busy || image?.status === 'pending'
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>{ingredient.name}</h3>
        <div className="preview-box">
          {pending ? (
            <div className="preview-busy"><div className="spinner" /><p className="muted small">Gemini sta disegnando…</p></div>
          ) : (
            <div className="preview-icon"><IngredientIcon name={ingredient.name} category={ingredient.category} /></div>
          )}
        </div>
        <p className="muted small">
          {image?.status === 'error' && <span className="error">Errore: {image.error}</span>}
          {!image && (isSauce ? 'Colore scelto in automatico dal nome.' : 'Per ora usa il disegno di riserva.')}
          {image?.status === 'ok' && (isSauce ? 'Colore suggerito da Gemini.' : 'Immagine generata da Gemini.')}
        </p>
        <div className="row">
          <button className="btn btn--primary" disabled={pending} onClick={onRegenerate}>
            {hasGenerated ? 'Rigenera' : isSauce ? 'Chiedi il colore' : 'Genera immagine'}
          </button>
          {hasGenerated && !pending && (
            <button className="btn" onClick={() => { onUseDrawing(); onClose() }}>Usa il disegno</button>
          )}
        </div>
        <button className="linkbtn" onClick={onClose}>Chiudi</button>
      </div>
    </div>
  )
}

function PiadinaCard({ image, busy, onGenerate, onUseDrawing }: {
  image: IngredientImage | undefined; busy: boolean; onGenerate: () => void; onUseDrawing: () => void
}) {
  const pending = busy || image?.status === 'pending'
  const has = !!image?.image_url
  return (
    <section className="card piadina-card">
      <div className="piadina-thumb">
        {pending ? <div className="spinner" /> : <Dough seed="admin-preview" side="top" viewBox="0 0 300 300" />}
      </div>
      <div className="piadina-card-body">
        <h3>Piadina</h3>
        <p className="muted small">
          {image?.status === 'error'
            ? <span className="error">Errore: {image.error}</span>
            : has ? 'Generata da Gemini, nello stesso stile degli ingredienti.' : 'Ora usa il disegno di riserva.'}
        </p>
        <div className="row">
          <button className="btn btn--primary btn--sm" disabled={pending} onClick={onGenerate}>
            {has ? 'Rigenera' : 'Genera con Gemini'}
          </button>
          {has && !pending && <button className="btn btn--sm" onClick={onUseDrawing}>Usa il disegno</button>}
        </div>
      </div>
    </section>
  )
}
