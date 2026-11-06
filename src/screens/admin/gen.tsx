import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { generateIngredientImage } from '../../api'
import { nameKey } from '../../piadina/images'

/* Coda di generazione immagini: una alla volta, così ogni immagine usa
   le precedenti (e la piadina) come riferimento di stile. */

export type GenStatus = 'idle' | 'generating' | 'queued'

interface Job { key: string; name: string; category: string }

interface GenCtx {
  status: (name: string) => GenStatus
  gen: (name: string, category: string) => void
  batch: { total: number; done: number; current: string | null }
  justDone: Set<string>
}

const Ctx = createContext<GenCtx>({
  status: () => 'idle', gen: () => {}, batch: { total: 0, done: 0, current: null }, justDone: new Set(),
})
export const useGen = () => useContext(Ctx)

export function GenProvider({ pin, reload, onError, children }: {
  pin: string; reload: () => Promise<void>; onError: (msg: string) => void; children: ReactNode
}) {
  const queue = useRef<Job[]>([])
  const running = useRef(false)
  const [keys, setKeys] = useState<string[]>([])
  const [batch, setBatch] = useState({ total: 0, done: 0, current: null as string | null })
  const [justDone, setJustDone] = useState<Set<string>>(new Set())

  const sync = () => setKeys(queue.current.map((j) => j.key))

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    while (queue.current.length) {
      const job = queue.current[0]
      setBatch((b) => ({ ...b, current: job.name }))
      try {
        await generateIngredientImage(pin, job.name, job.category)
        setJustDone((s) => new Set(s).add(job.key))
        window.setTimeout(() => setJustDone((s) => { const n = new Set(s); n.delete(job.key); return n }), 2500)
      } catch (e) {
        onError(`${job.name}: ${(e as Error).message}`)
      }
      queue.current.shift()
      sync()
      setBatch((b) => ({ ...b, done: b.done + 1 }))
      await reload()
    }
    running.current = false
    setBatch({ total: 0, done: 0, current: null })
  }, [pin, reload, onError])

  const gen = useCallback((name: string, category: string) => {
    const key = nameKey(name)
    if (queue.current.some((j) => j.key === key)) return
    queue.current.push({ key, name, category })
    sync()
    setBatch((b) => ({ ...b, total: b.total + 1 }))
    run()
  }, [run])

  const status = useCallback((name: string): GenStatus => {
    const k = nameKey(name)
    if (keys[0] === k) return 'generating'
    return keys.includes(k) ? 'queued' : 'idle'
  }, [keys])

  const value = useMemo(() => ({ status, gen, batch, justDone }), [status, gen, batch, justDone])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
