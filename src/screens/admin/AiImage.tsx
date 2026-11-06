import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { IngredientIcon } from '../../piadina/IngredientIcon'
import { nameKey, useIngredientImage } from '../../piadina/images'
import type { Category } from '../../types'
import { useGen } from './gen'

const phrases = (name: string) => [
  `Gemini sta studiando ${name.toLowerCase()}…`,
  'Sceglie luce e colori…',
  'Sta disegnando…',
  'Toglie lo sfondo…',
  'Ultimi ritocchi…',
]

/** Immagine dell'ingrediente con stato AI: in coda, in generazione (animazione), appena pronta (reveal) */
export function AiImage({ name, category, size = 'tile' }: { name: string; category: Category; size?: 'tile' | 'big' | 'chip' }) {
  const { status, justDone } = useGen()
  const st = status(name)
  const img = useIngredientImage(name)
  const fresh = justDone.has(nameKey(name))

  return (
    <div className={`ai-img ai-img--${size}`} data-status={st}>
      {st === 'generating' ? (
        <AiGenerating name={name} size={size} />
      ) : (
        <motion.div
          key={(img?.image_url ?? '') + (img?.color ?? '')}
          className="ai-img-inner"
          initial={fresh ? { opacity: 0, scale: 0.8, filter: 'blur(14px)' } : false}
          animate={{ opacity: st === 'queued' ? 0.45 : 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <IngredientIcon name={name} category={category} />
          {fresh && <span className="ai-glint" aria-hidden="true" />}
        </motion.div>
      )}
      {st === 'queued' && <span className="ai-badge ai-badge--queued">In coda</span>}
      {st === 'generating' && size !== 'chip' && <span className="ai-badge">✨ AI</span>}
      {st === 'idle' && img?.status === 'error' && <span className="ai-badge ai-badge--err" title={img.error ?? ''}>!</span>}
      {st === 'idle' && img?.status === 'ok' && size === 'big' && <span className="ai-badge ai-badge--ok">✨ AI</span>}
    </div>
  )
}

function AiGenerating({ name, size }: { name: string; size: string }) {
  const list = phrases(name)
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => Math.min(x + 1, list.length - 1)), 3600)
    return () => window.clearInterval(t)
  }, [list.length])
  return (
    <div className="ai-gen" role="status" aria-label={`Gemini sta generando l'immagine di ${name}`}>
      <div className="ai-gen-blob" />
      <div className="ai-gen-shimmer" />
      {[0, 1, 2, 3].map((k) => <span key={k} className={`ai-spark ai-spark--${k}`}>✦</span>)}
      {size === 'big' && (
        <div className="ai-gen-caption">
          <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>{list[i]}</motion.p>
          <div className="ai-progress"><span /></div>
        </div>
      )}
    </div>
  )
}

/** Banner in alto quando Gemini sta lavorando su più immagini */
export function AiBanner() {
  const { batch } = useGen()
  if (!batch.total) return null
  const pct = Math.round((batch.done / batch.total) * 100)
  return (
    <motion.div className="ai-banner" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <span className="ai-banner-spark">✨</span>
      <div className="ai-banner-text">
        <strong>Gemini sta disegnando {batch.current ?? '…'}</strong>
        <span>
          {batch.total > 1 ? `Immagine ${Math.min(batch.done + 1, batch.total)} di ${batch.total}` : 'Ci vogliono circa 15 secondi'}
        </span>
        <div className="ai-banner-bar"><span style={{ width: `${Math.max(pct, 4)}%` }} /></div>
      </div>
    </motion.div>
  )
}
