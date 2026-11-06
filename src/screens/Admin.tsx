import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { ask } from '../confirm'
import { adminChangePin, adminCheck, adminGetSettings, adminSetSetting } from '../api'
import type { ImageMap } from '../piadina/images'
import type { CatalogItem, EventRow, Ingredient, Order, Player } from '../types'
import { AiBanner } from './admin/AiImage'
import { EventTab } from './admin/EventTab'
import { GenProvider } from './admin/gen'
import { PantryTab } from './admin/PantryTab'

export const PIN_KEY = 'asinella.adminPin'
type Tab = 'serata' | 'dispensa' | 'impostazioni'

export default function Admin({
  event, ingredients, orders, players, images, catalog, reload, me, onGoHome, onLogin,
}: {
  event: EventRow | null; ingredients: Ingredient[]; orders: Order[]; players: Player[]; images: ImageMap
  catalog: CatalogItem[]; reload: () => Promise<void>; me: Player | null; onGoHome: () => void; onLogin: (p: Player) => void
}) {
  // il PIN resta salvato su questo telefono: niente PIN a ogni apertura
  const [pin, setPin] = useState(() => localStorage.getItem(PIN_KEY) || sessionStorage.getItem(PIN_KEY) || '')
  const [phone, setPhone] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('serata')

  useEffect(() => {
    if (pin) adminCheck(pin).then(setAuthed).catch(() => setAuthed(false))
  }, [pin])
  useEffect(() => {
    if (authed) adminGetSettings(pin).then((s) => setPhone(s.asinella_phone ?? null)).catch(() => {})
  }, [authed, pin])

  const flash = useCallback((t: string) => { setMsg(t); window.setTimeout(() => setMsg(null), 2400) }, [])
  const onError = useCallback((m: string) => setErr(m), [])
  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    setErr(null)
    try {
      await fn()
      await reload()
      if (ok) flash(ok)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [reload, flash])

  if (!authed) {
    return (
      <form className="card form admin-login" onSubmit={async (e) => {
        e.preventDefault()
        setErr(null)
        const ok = await adminCheck(pinInput).catch(() => false)
        if (ok) { localStorage.setItem(PIN_KEY, pinInput); setPin(pinInput); setAuthed(true) }
        else setErr('PIN errato')
      }}>
        <h2>Area admin</h2>
        <label>
          PIN
          <input type="password" autoCapitalize="none" autoCorrect="off" autoComplete="current-password" value={pinInput}
            onChange={(e) => setPinInput(e.target.value)} autoFocus />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn--primary btn--block">Entra</button>
      </form>
    )
  }

  return (
    <GenProvider pin={pin} reload={reload} onError={onError}>
      <div className="admin">
        <AnimatePresence>
          {msg && <motion.div key="msg" className="toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{msg}</motion.div>}
          {err && (
            <motion.div key="err" className="toast toast--error" onClick={() => setErr(null)}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {err} <span className="toast-x">×</span>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="admin-tabs" role="tablist">
          {([['serata', 'Serata'], ['dispensa', 'Dispensa'], ['impostazioni', 'Impostazioni']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={'admin-tab' + (tab === k ? ' is-active' : '')} onClick={() => setTab(k)}>
              <span className="admin-tab-label">{l}</span>
              {tab === k && <motion.span layoutId="admin-tab-pill" className="admin-tab-pill" />}
            </button>
          ))}
        </nav>

        <AiBanner />

        {tab === 'serata' && (
          <EventTab pin={pin} event={event} ingredients={ingredients} orders={orders} players={players} catalog={catalog}
            run={run} flash={flash} onError={onError} reload={reload} phone={phone} onOpenSettings={() => setTab('impostazioni')}
            me={me} onGoHome={onGoHome} onLogin={onLogin} />
        )}
        {tab === 'dispensa' && (
          <PantryTab pin={pin} catalog={catalog} images={images} run={run} onError={onError} reload={reload} />
        )}
        {tab === 'impostazioni' && (
          <>
            <PhoneSetting phone={phone} onSave={(v) => run(async () => { await adminSetSetting(pin, 'asinella_phone', v); setPhone(v.trim() || null) }, 'Numero salvato')} />
            <PinChanger pin={pin} onChanged={(p) => { localStorage.setItem(PIN_KEY, p); setPin(p) }} run={run} />
            <button className="btn btn--block" onClick={async () => {
              if (!await ask({ title: "Uscire dall'area admin?", message: 'Su questo telefono dovrai reinserire il PIN.', confirm: 'Esci', icon: '🔒' })) return
              localStorage.removeItem(PIN_KEY); sessionStorage.removeItem(PIN_KEY); setAuthed(false); setPin('')
            }}>
              Esci dall'area admin su questo telefono
            </button>
          </>
        )}
      </div>
    </GenProvider>
  )
}

function PinChanger({ pin, onChanged, run }: {
  pin: string; onChanged: (p: string) => void; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>
}) {
  const [np, setNp] = useState('')
  return (
    <section className="card">
      <h3>Cambia PIN admin</h3>
      <form className="add-row" onSubmit={(e) => {
        e.preventDefault()
        run(async () => { await adminChangePin(pin, np); onChanged(np); setNp('') }, 'PIN aggiornato')
      }}>
        <input type="password" value={np} onChange={(e) => setNp(e.target.value)} placeholder="Nuovo PIN (min 4)" autoComplete="new-password" />
        <button className="btn btn--primary btn--sm" disabled={np.length < 4}>Salva</button>
      </form>
    </section>
  )
}

function PhoneSetting({ phone, onSave }: { phone: string | null; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(phone ?? '')
  useEffect(() => { setV(phone ?? '') }, [phone])
  return (
    <section className="card">
      <h3>WhatsApp di Asinella</h3>
      <p className="muted small">Con il numero salvato, a ordini chiusi mandi l'ordine con un tocco. Puoi sempre anche copiare il testo.</p>
      <form className="add-row" onSubmit={(e) => { e.preventDefault(); onSave(v) }}>
        <input type="tel" inputMode="tel" value={v} onChange={(e) => setV(e.target.value)} placeholder="es. 333 123 4567" autoComplete="off" />
        <button className="btn btn--primary btn--sm" disabled={v.trim() === (phone ?? '')}>Salva</button>
      </form>
    </section>
  )
}
