import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/* Finestra di conferma nello stile dell'app, al posto di window.confirm.
   Uso: if (await ask({ title: 'Uscire?', confirm: 'Esci' })) { ... } */

export interface AskOptions {
  title: string
  message?: string
  confirm?: string
  cancel?: string
  danger?: boolean
  icon?: string
}

type Pending = AskOptions & { resolve: (v: boolean) => void }
let push: ((p: Pending) => void) | null = null

export function ask(opts: AskOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (push) push({ ...opts, resolve })
    else resolve(window.confirm(opts.title + (opts.message ? '\n\n' + opts.message : '')))
  })
}

export function ConfirmHost() {
  const [cur, setCur] = useState<Pending | null>(null)
  useEffect(() => {
    push = (p) => setCur(p)
    return () => { push = null }
  }, [])

  const done = (v: boolean) => {
    cur?.resolve(v)
    setCur(null)
  }

  useEffect(() => {
    if (!cur) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') done(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <AnimatePresence>
      {cur && (
        <motion.div className="ask-backdrop" key="ask" onClick={() => done(false)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="ask" role="alertdialog" aria-modal="true" aria-labelledby="ask-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <div className={'ask-icon' + (cur.danger ? ' ask-icon--danger' : '')}>
              {cur.icon ? <span>{cur.icon}</span> : <img src="/logo-128.png" alt="" />}
            </div>
            <h2 id="ask-title">{cur.title}</h2>
            {cur.message && <p>{cur.message}</p>}
            <div className="ask-actions">
              <button className="btn" onClick={() => done(false)}>{cur.cancel ?? 'Annulla'}</button>
              <button className={'btn ' + (cur.danger ? 'btn--danger-solid' : 'btn--primary')} onClick={() => done(true)} autoFocus>
                {cur.confirm ?? 'Conferma'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
