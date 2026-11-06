import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { adminCatalogAdd, adminCatalogUpdate, adminDeleteIngredientImage } from '../../api'
import { nameKey, type ImageMap } from '../../piadina/images'
import type { CatalogItem, Category } from '../../types'
import { AiImage } from './AiImage'
import { AddRow, CATS } from './IngredientPicker'
import { useGen } from './gen'

/** Dispensa: tutti gli ingredienti disponibili, con la loro immagine */
export function PantryTab({ pin, catalog, images, run, onError, reload }: {
  pin: string; catalog: CatalogItem[]; images: ImageMap
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>
  onError: (m: string) => void; reload: () => Promise<void>
}) {
  const { gen, status } = useGen()
  const [showArchived, setShowArchived] = useState(false)
  const [edit, setEdit] = useState<CatalogItem | null>(null)
  const active = catalog.filter((c) => !c.archived)
  const archived = catalog.filter((c) => c.archived)
  const missing = active.filter((c) => images.get(nameKey(c.name))?.status !== 'ok' && status(c.name) === 'idle')

  return (
    <div className="pantry">
      <section className="card">
        <div className="card-head">
          <div>
            <h3>Dispensa</h3>
            <p className="muted small">{active.length} ingredienti sempre disponibili per le serate</p>
          </div>
          {missing.length > 0 && (
            <button className="btn btn--accent btn--sm" onClick={() => missing.forEach((c) => gen(c.name, c.category))}>
              ✨ Genera {missing.length} {missing.length === 1 ? 'immagine' : 'immagini'}
            </button>
          )}
        </div>
      </section>

      {CATS.map((cat) => {
        const items = (showArchived ? catalog : active).filter((c) => c.category === cat.key)
        return (
          <section key={cat.key} className="card">
            <h3 className="pantry-cat">{cat.label} <span className="muted small">{items.length}</span></h3>
            <div className="tiles">
              <AnimatePresence initial={false}>
                {items.map((c) => (
                  <motion.button layout key={c.id} className={'tile' + (c.archived ? ' is-archived' : '')} onClick={() => setEdit(c)}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <AiImage name={c.name} category={c.category} />
                    <span className="tile-name">{c.name}</span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
            <AddRow placeholder={`Aggiungi ${cat.label.toLowerCase()}: ${cat.placeholder}`} onAdd={async (names) => {
              try {
                for (const n of names) {
                  const c = await adminCatalogAdd(pin, n, cat.key)
                  if (images.get(nameKey(c.name))?.status !== 'ok') gen(c.name, c.category)
                }
                await reload()
              } catch (e) {
                onError((e as Error).message)
              }
            }} />
          </section>
        )
      })}

      {archived.length > 0 && (
        <button className="linkbtn" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Nascondi archiviati' : `Mostra archiviati (${archived.length})`}
        </button>
      )}

      {edit && (
        <EditIngredient item={catalog.find((c) => c.id === edit.id) ?? edit} images={images} onClose={() => setEdit(null)}
          onSave={(name, category, arch) => run(() => adminCatalogUpdate(pin, edit.id, name, category, arch), 'Salvato')}
          onUseDrawing={(n) => run(() => adminDeleteIngredientImage(pin, nameKey(n)), 'Torno al disegno')} />
      )}
    </div>
  )
}

function EditIngredient({ item, images, onClose, onSave, onUseDrawing }: {
  item: CatalogItem; images: ImageMap; onClose: () => void
  onSave: (name: string, category: Category, archived: boolean) => Promise<void>
  onUseDrawing: (name: string) => Promise<void>
}) {
  const { gen, status } = useGen()
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState<Category>(item.category)
  const img = images.get(nameKey(item.name))
  const st = status(item.name)
  const has = !!img && !!(img.image_url || img.color)
  const dirty = name.trim() !== item.name || category !== item.category
  const isSauce = item.category === 'salse'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div className="card modal" onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="preview-box">
          <AiImage name={item.name} category={item.category} size="big" />
        </div>
        {img?.status === 'error' && st === 'idle' && <p className="error small">Errore AI: {img.error}</p>}
        <div className="row">
          <button className="btn btn--accent" disabled={st !== 'idle'} onClick={() => gen(item.name, item.category)}>
            {st === 'generating' ? 'Gemini al lavoro…' : st === 'queued' ? 'In coda…' : has ? '✨ Rigenera' : isSauce ? '✨ Chiedi il colore' : '✨ Genera immagine'}
          </button>
          {has && st === 'idle' && <button className="btn" onClick={() => onUseDrawing(item.name)}>Usa il disegno</button>}
        </div>

        <div className="form">
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="seg">
            {CATS.map((c) => (
              <button key={c.key} type="button" className={'seg-btn' + (category === c.key ? ' is-on' : '')} onClick={() => setCategory(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          {dirty && (
            <button className="btn btn--primary" onClick={async () => { await onSave(name, category, item.archived); onClose() }}>
              Salva modifiche
            </button>
          )}
        </div>
        <button className="linkbtn" onClick={async () => { await onSave(item.name, item.category, !item.archived); onClose() }}>
          {item.archived ? 'Ripristina nella dispensa' : 'Archivia (non comparirà più nelle nuove serate)'}
        </button>
        <button className="linkbtn" onClick={onClose}>Chiudi</button>
      </motion.div>
    </div>
  )
}
