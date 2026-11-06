import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { memo, useContext, useId, useMemo } from 'react'
import { ImagesContext, PIADINA_IMAGE, nameKey } from './images'
import type { Category } from '../types'
import { Piece, kindFor, pieceCount, pieceSize } from './art'
import { Plate, Ramekins } from './Plate'
import { range, rngFrom, smoothClosed } from './rng'

const C = 150 // centro
const R = 140 // raggio piadina

/* ---------------- impasto ---------------- */

export const Dough = memo(function Dough({
  seed, side, viewBox,
}: { seed: string; side: 'top' | 'under'; viewBox: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const piadinaImg = PIADINA_IMAGE
  const { edge, spots, specks, blisters } = useMemo(() => {
    const r = rngFrom(seed + side)
    // bordo irregolare
    const pts: [number, number][] = []
    const n = 48
    let wob = 0
    for (let i = 0; i < n; i++) {
      wob = wob * 0.6 + range(r, -1, 1) * 0.4
      const a = (i / n) * Math.PI * 2
      const rr = R * (1 + wob * 0.022)
      pts.push([C + Math.cos(a) * rr, C + Math.sin(a) * rr])
    }
    // chiazze di cottura
    // chiazze dorate grandi + macchie bruciacchiate a grappolo (tipico della piastra)
    const nSpots = side === 'under' ? 70 : 56
    const spots: { x: number; y: number; rx: number; ry: number; rot: number; o: number; c: string }[] = []
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * R * 0.8
      spots.push({
        x: C + Math.cos(a) * d, y: C + Math.sin(a) * d,
        rx: range(r, 18, 34), ry: range(r, 12, 24), rot: range(r, 0, 180), o: range(r, 0.18, 0.32), c: '#c98a3e',
      })
    }
    const clusters = Array.from({ length: 10 }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * R * 0.88
      return [C + Math.cos(a) * d, C + Math.sin(a) * d] as const
    })
    for (let i = 0; i < nSpots; i++) {
      const [cx, cy] = clusters[i % clusters.length]
      const a = r() * Math.PI * 2
      const d = r() * 22
      spots.push({
        x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
        rx: range(r, 1.6, 6), ry: range(r, 1.2, 4), rot: range(r, 0, 180),
        o: range(r, 0.25, side === 'under' ? 0.6 : 0.55),
        c: r() > 0.5 ? '#7c3d0f' : '#a45a1c',
      })
    }
    const specks = Array.from({ length: 70 }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * R * 0.95
      return { x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, s: range(r, 0.4, 1.4), o: range(r, 0.3, 0.8) }
    })
    // bolle d'aria dorate (blister)
    const blisters = Array.from({ length: 14 }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * R * 0.85
      return { x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, rx: range(r, 2.5, 6), ry: range(r, 2, 4.5), rot: range(r, 0, 180) }
    })
    return { edge: smoothClosed(pts), spots, specks, blisters }
  }, [seed, side])

  // piadina generata da Gemini: stessa immagine per tutte e due le facce (sotto = specchiata, un filo più scura)
  if (piadinaImg) {
    const P = R + 1
    return (
      <svg viewBox={viewBox} className="dough" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <image href={piadinaImg} x={C - P} y={C - P} width={P * 2} height={P * 2} preserveAspectRatio="xMidYMid meet"
          transform={side === 'under' ? `translate(${C * 2} 0) scale(-1 1)` : undefined}
          style={side === 'under' ? { filter: 'brightness(0.93) saturate(1.05)' } : undefined} />
      </svg>
    )
  }

  return (
    <svg viewBox={viewBox} className="dough" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <clipPath id={`clip${uid}`}>
          <path d={edge} />
        </clipPath>
      </defs>
      <path d={edge} fill={`url(#dough-${side})`} />
      <g clipPath={`url(#clip${uid})`}>
        <g filter="url(#dough-blur)">
          {spots.slice(0, 9).map((s, i) => (
            <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={s.c} opacity={s.o}
              transform={`rotate(${s.rot} ${s.x} ${s.y})`} />
          ))}
        </g>
        <g filter="url(#dough-blur-s)">
          {spots.slice(9).map((s, i) => (
            <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={s.c} opacity={s.o}
              transform={`rotate(${s.rot} ${s.x} ${s.y})`} />
          ))}
        </g>
        <g filter="url(#dough-blur-s)">
          {blisters.map((b, i) => (
            <g key={i} transform={`rotate(${b.rot} ${b.x} ${b.y})`}>
              <ellipse cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} fill="#7a3c10" opacity={0.55} />
              <ellipse cx={b.x - b.rx * 0.25} cy={b.y - b.ry * 0.3} rx={b.rx * 0.45} ry={b.ry * 0.35} fill="#fff4d6" opacity={0.5} />
            </g>
          ))}
        </g>
        {specks.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#5b2c0b" opacity={s.o} />
        ))}
        <rect x="0" y="0" width="300" height="300" filter="url(#dough-grain)" opacity={0.3} />
      </g>
      <path d={edge} fill="url(#dough-light)" />
      <path d={edge} fill="none" stroke="#a86a2c" strokeOpacity={0.5} strokeWidth={1.4} />
    </svg>
  )
})

/* ---------------- farcitura ---------------- */

export interface FillingItem {
  id: string
  name: string
  category: Category
}

/** Distribuzione 'a girasole' sulla metà sinistra: copertura uniforme come
 *  quando la farciscono davvero, con jitter e rotazione diversi per ingrediente. */
function placements(id: string, count: number, size: number) {
  const r = rngFrom(id)
  const out: { x: number; y: number; rot: number; s: number }[] = []
  const off = r() * Math.PI * 2
  const rMax = 120 - size * 0.45
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const rad = Math.sqrt(t) * rMax + range(r, -6, 6)
    const g = (off + i * 2.39996) % (Math.PI * 2)
    const a = Math.PI / 2 + (g / (Math.PI * 2)) * Math.PI
    let x = C + Math.cos(a) * rad + range(r, -7, 7)
    const y = C + Math.sin(a) * rad + range(r, -7, 7)
    x = Math.min(x, C - 2)
    out.push({ x, y, rot: range(r, 0, 360), s: range(r, 0.9, 1.06) })
  }
  return out
}

const pieceTransition = { type: 'spring', stiffness: 320, damping: 22, mass: 0.8 } as const

export function Fillings({ items, extra }: { items: FillingItem[]; extra: string }) {
  const trimmed = extra.trim()
  const images = useContext(ImagesContext)
  return (
    <svg viewBox="0 0 300 300" className="fillings" aria-hidden="true">
      <AnimatePresence>
        {items.filter((it) => it.category !== 'salse').map((it) => {
          const kind = kindFor(it.name, it.category)
          const img = images.get(nameKey(it.name))?.image_url
          const S = pieceSize(kind) * 2.15
          const pl = placements(it.id, pieceCount(kind), pieceSize(kind))
          return (
            <motion.g key={it.id} filter="url(#ig-shadow)" exit={{ opacity: 0, transition: { duration: 0.22 } }}>
              {pl.map((p, i) => (
                <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${p.s.toFixed(2)})`}>
                  <motion.g
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    initial={{ opacity: 0, scale: 1.9, y: -60 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...pieceTransition, delay: i * 0.045 }}
                  >
                    {img ? (
                      <image href={img} x={-S / 2} y={-S / 2} width={S} height={S} preserveAspectRatio="xMidYMid meet" />
                    ) : (
                      <Piece kind={kind} r={rngFrom(it.id + ':' + i)} uid={'p' + it.id.replace(/[^a-zA-Z0-9]/g, '') + i} />
                    )}
                  </motion.g>
                </g>
              ))}
            </motion.g>
          )
        })}
        {trimmed && (
          <motion.g key="extra" initial={{ opacity: 0, scale: 1.6 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={pieceTransition} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            <g transform="translate(84 150) rotate(-9)" filter="url(#ig-shadow)">
              <rect x={-44} y={-11} width={88} height={22} rx={4} fill="#fffdf6" stroke="#e6d9bb" />
              <circle cx={-36} cy={0} r={2.4} fill="#e2571e" />
              <text x={-30} y={4} fontSize={10.5} fontFamily="Nunito, sans-serif" fontWeight={800} fill="#3b2b20">
                + {trimmed.length > 15 ? trimmed.slice(0, 14) + '…' : trimmed}
              </text>
            </g>
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  )
}

/* ---------------- motion del fold ---------------- */

export function usePiadinaMotion(initiallyFolded = false) {
  const fold = useMotionValue(initiallyFolded ? -180 : 0)
  const shift = useMotionValue(initiallyFolded ? 25 : 0)
  const tilt = useMotionValue(initiallyFolded ? -10 : 0)
  const squash = useMotionValue(1)
  const lift = useMotionValue(0)
  const steam = useMotionValue(0)

  async function close() {
    // 1. il lembo si solleva e si chiude
    await animate(fold, -180, { duration: 1.05, ease: [0.55, 0.05, 0.3, 1] })
    // 2. pressione (come quando la schiacciano sulla piastra)
    animate(fold, [-180, -174, -180], { duration: 0.35 })
    await animate(squash, [1, 0.95, 1.02, 1], { duration: 0.45 })
    // 3. vapore + servita al tavolo
    animate(steam, [0, 1, 1, 0], { duration: 2.4, times: [0, 0.2, 0.7, 1] })
    animate(lift, [0, -14, 0], { duration: 0.7, ease: 'easeInOut' })
    animate(tilt, -10, { duration: 0.7, ease: 'easeInOut' })
    await animate(shift, 25, { duration: 0.7, ease: 'easeInOut' })
  }

  async function open() {
    animate(tilt, 0, { duration: 0.45 })
    await animate(shift, 0, { duration: 0.45, ease: 'easeInOut' })
    await animate(fold, 0, { duration: 0.8, ease: [0.4, 0, 0.2, 1] })
  }

  function set(folded: boolean) {
    fold.set(folded ? -180 : 0)
    shift.set(folded ? 25 : 0)
    tilt.set(folded ? -10 : 0)
  }

  return { fold, shift, tilt, squash, lift, steam, close, open, set }
}

export type PiadinaMotion = ReturnType<typeof usePiadinaMotion>

/* ---------------- stage ---------------- */

export function PiadinaStage({
  seed, items, extra, m, small = false,
}: { seed: string; items: FillingItem[]; extra: string; m: PiadinaMotion; small?: boolean }) {
  const frontLight = useTransform(m.fold, [0, -60, -90], [1, 1.12, 0.8])
  const backLight = useTransform(m.fold, [-90, -140, -180], [0.75, 0.92, 1])
  const baseLight = useTransform(m.fold, [0, -95, -160, -180], [1, 0.8, 0.86, 1])
  const frontFilter = useTransform(frontLight, (v) => `brightness(${v})`)
  const backFilter = useTransform(backLight, (v) => `brightness(${v})`)
  const baseFilter = useTransform(baseLight, (v) => `brightness(${v})`)
  const flapShadow = useTransform(m.fold, [0, -90, -170, -180], [0, 0.0, 0.25, 0.35])
  const x = useTransform(m.shift, (v) => `${v}%`)
  // aperta: la farcitura può sbordare sopra la metà destra; chiusa: sta sotto il lembo
  const baseZ = useTransform(m.fold, (v) => (v > -90 ? 3 : 1))
  const fillClip = useTransform(m.fold, (v) => (v > -90 ? 'inset(-20% -20% -20% -20%)' : 'inset(-20% 50% -20% -20%)'))

  return (
    <div className={'stage' + (small ? ' stage--small' : '')}>
      <Plate />
      <div className="pbox">
      <motion.div className="stage-inner" style={{ x, y: m.lift, rotate: m.tilt, scaleY: m.squash }}>
        <div className="piadina-shadow" />
        <motion.div className="base" style={{ filter: baseFilter, zIndex: baseZ }}>
          <div className="half half--left">
            <Dough seed={seed} side="top" viewBox="0 0 150 300" />
          </div>
          <motion.div className="fill-wrap" style={{ clipPath: fillClip }}>
            <Fillings items={items} extra={extra} />
          </motion.div>
        </motion.div>
        <motion.div className="flap" style={{ rotateY: m.fold }}>
          <motion.div className="face face--front" style={{ filter: frontFilter }}>
            <Dough seed={seed} side="top" viewBox="150 0 150 300" />
          </motion.div>
          <motion.div className="face face--back" style={{ filter: backFilter }}>
            <motion.div className="flap-shadow" style={{ opacity: flapShadow }} />
            <Dough seed={seed} side="under" viewBox="0 0 150 300" />
          </motion.div>
        </motion.div>
        <motion.svg className="steam" viewBox="0 0 150 120" style={{ opacity: m.steam }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M${45 + i * 28},110 C${30 + i * 28},85 ${62 + i * 28},70 ${45 + i * 28},45 C${32 + i * 28},28 ${55 + i * 28},18 ${48 + i * 28},4`}
              fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round"
              animate={{ y: [8, -10], opacity: [0, 0.75, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.35, ease: 'easeOut' }}
            />
          ))}
        </motion.svg>
      </motion.div>
      </div>
      <Ramekins sauces={items.filter((i) => i.category === 'salse')} />
    </div>
  )
}
