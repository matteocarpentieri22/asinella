import { useState } from 'react'
import { adminCatalogAdd } from '../../api'
import type { CatalogItem, Category } from '../../types'
import { AiImage } from './AiImage'
import { useGen } from './gen'

export const CATS: { key: Category; label: string; placeholder: string }[] = [
  { key: 'salumi', label: 'Salumi', placeholder: 'es. porchetta' },
  { key: 'formaggi', label: 'Formaggi', placeholder: 'es. scamorza' },
  { key: 'verdure', label: 'Verdure', placeholder: 'es. carciofi' },
  { key: 'salse', label: 'Salse', placeholder: 'es. salsa tonnata' },
]

/** Scelta degli ingredienti della serata dalla dispensa (+ aggiunta di nuovi) */
export function IngredientPicker({ pin, catalog, selected, onChange, lastSelection, onError, reload }: {
  pin: string
  catalog: CatalogItem[]
  selected: string[]
  onChange: (ids: string[]) => void
  lastSelection?: string[]
  onError: (m: string) => void
  reload: () => Promise<void>
}) {
  const [q, setQ] = useState('')
  const { gen } = useGen()
  const query = q.trim().toLowerCase()
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="picker-admin">
      <div className="picker-tools">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nella dispensa…" />
        {lastSelection && lastSelection.length > 0 && (
          <button type="button" className="btn btn--sm" onClick={() => onChange(lastSelection.filter((id) => catalog.some((c) => c.id === id && !c.archived)))}>
            Come l'ultima volta
          </button>
        )}
      </div>
      {CATS.map((cat) => {
        const items = catalog
          .filter((c) => c.category === cat.key && (!c.archived || selected.includes(c.id)))
          .filter((c) => !query || c.name.toLowerCase().includes(query))
        const ids = items.map((c) => c.id)
        const n = selected.filter((id) => ids.includes(id)).length
        return (
          <div key={cat.key} className="pick-cat">
            <div className="pick-cat-head">
              <h4>{cat.label} <span className="muted small">{n}/{items.length}</span></h4>
              <div className="pick-cat-actions">
                <button type="button" className="linkbtn small" onClick={() => onChange([...new Set([...selected, ...ids])])}>Tutti</button>
                <button type="button" className="linkbtn small" onClick={() => onChange(selected.filter((id) => !ids.includes(id)))}>Nessuno</button>
              </div>
            </div>
            <div className="pick-chips">
              {items.map((c) => {
                const on = selected.includes(c.id)
                return (
                  <button type="button" key={c.id} className={'pick-chip' + (on ? ' is-on' : '')} onClick={() => toggle(c.id)} aria-pressed={on}>
                    <AiImage name={c.name} category={c.category} size="chip" />
                    <span>{c.name}</span>
                    <span className="pick-check" aria-hidden="true">{on ? '✓' : '+'}</span>
                  </button>
                )
              })}
              {!items.length && <span className="muted small">{query ? 'Nessun risultato' : 'Dispensa vuota'}</span>}
            </div>
            <AddRow placeholder={`Nuovo: ${cat.placeholder}`} onAdd={async (names) => {
              try {
                const added: string[] = []
                for (const name of names) {
                  const c = await adminCatalogAdd(pin, name, cat.key)
                  added.push(c.id)
                  gen(c.name, c.category)
                }
                await reload()
                onChange([...new Set([...selected, ...added])])
              } catch (e) {
                onError((e as Error).message)
              }
            }} />
          </div>
        )
      })}
    </div>
  )
}

export function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (names: string[]) => Promise<void> }) {
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form className="add-row" onSubmit={async (e) => {
      e.preventDefault()
      const names = v.split(',').map((s) => s.trim()).filter((s) => s.length >= 2)
      if (!names.length) return
      setBusy(true)
      await onAdd(names)
      setBusy(false)
      setV('')
    }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} enterKeyHint="done" />
      <button className="btn btn--primary btn--sm" disabled={busy || v.trim().length < 2}>{busy ? '…' : 'Aggiungi'}</button>
    </form>
  )
}
