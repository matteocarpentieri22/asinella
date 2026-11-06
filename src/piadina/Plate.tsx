import { AnimatePresence, motion } from 'framer-motion'
import { animate, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion'
import { memo, useContext, useEffect, useRef } from 'react'
import { ImagesContext, resolveSauceColor } from './images'
import { smoothOpen } from './rng'
import type { FillingItem } from './Piadina'

/* Piatto ovale "Asinella" (viewBox 500x400). La piadina sta a sinistra,
   le ciotoline delle salse a destra sul piatto. */

export const Plate = memo(function Plate() {
  return (
    <svg className="plate" viewBox="0 0 500 400" aria-hidden="true">
      <defs>
        {/* ceramica: tesa del piatto con piega verso il fondo, bordo arrotondato */}
        <radialGradient id="plate-rim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbf9f5" />
          <stop offset="80%" stopColor="#f3efe7" />
          <stop offset="83%" stopColor="#e2dbcd" />
          <stop offset="85.5%" stopColor="#fdfcf9" />
          <stop offset="93%" stopColor="#ffffff" />
          <stop offset="97.5%" stopColor="#efe9de" />
          <stop offset="100%" stopColor="#cfc5b3" />
        </radialGradient>
        <radialGradient id="plate-well" cx="46%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f8f5ef" />
          <stop offset="100%" stopColor="#e9e2d4" />
        </radialGradient>
        {/* ramekin */}
        <radialGradient id="plate-body" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f7f4ee" />
          <stop offset="92%" stopColor="#e8e1d5" />
          <stop offset="100%" stopColor="#cdc3b2" />
        </radialGradient>
        <radialGradient id="ram-wall" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6f2eb" />
          <stop offset="78%" stopColor="#eee8de" />
          <stop offset="100%" stopColor="#cfc6b6" />
        </radialGradient>
        <filter id="plate-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="plate-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        {/* stampa sotto smalto: inchiostro leggermente sfumato e desaturato */}
        <filter id="plate-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feColorMatrix type="saturate" values="0.82" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        <filter id="plate-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.32  0 0 0 -2.2 1.25" />
        </filter>
        <clipPath id="plate-clip">
          <ellipse cx="250" cy="200" rx="246" ry="195" />
        </clipPath>
        <clipPath id="plate-well-clip">
          <ellipse cx="250" cy="201" rx="204" ry="160" />
        </clipPath>
        <path id="plate-arc-top" d="M 30,206 A 222 174 0 0 1 470,206" />
      </defs>

      {/* ombra sul tavolo */}
      <ellipse cx="256" cy="216" rx="238" ry="186" fill="#4a2e10" opacity="0.32" filter="url(#plate-shadow)" />
      <ellipse cx="252" cy="206" rx="244" ry="192" fill="#4a2e10" opacity="0.18" filter="url(#plate-soft)" />

      {/* corpo */}
      <ellipse cx="250" cy="200" rx="246" ry="195" fill="url(#plate-rim)" />
      <g clipPath="url(#plate-well-clip)">
        <ellipse cx="250" cy="201" rx="204" ry="160" fill="url(#plate-well)" />
        {/* ombra interna del fondo (profondità) */}
        <ellipse cx="250" cy="196" rx="204" ry="160" fill="none" stroke="#6b5530" strokeOpacity="0.12" strokeWidth="14" filter="url(#plate-soft)" />
      </g>

      {/* decori stampati sotto lo smalto */}
      <g style={{ mixBlendMode: 'multiply' }} filter="url(#plate-ink)" opacity="0.92">
        <ellipse cx="250" cy="200" rx="235" ry="185.5" fill="none" stroke="#e8822a" strokeWidth="2.2" />
        <ellipse cx="250" cy="200" rx="229.5" ry="181" fill="none" stroke="#24607a" strokeWidth="1" />
        <text fontFamily="Fredoka, Nunito, sans-serif" fontWeight="700" fontSize="18" fill="#24607a" letterSpacing="6">
          <textPath href="#plate-arc-top" startOffset="63%" textAnchor="middle">ASINELLA</textPath>
        </text>
        <image href="/logo-256.png" x="223" y="354" width="54" height="44" opacity="0.95" />
      </g>

      {/* grana della ceramica */}
      <rect x="0" y="0" width="500" height="400" filter="url(#plate-grain)" clipPath="url(#plate-clip)" opacity="0.12" />

      {/* smalto lucido: riflessi sopra la stampa */}
      <g clipPath="url(#plate-clip)">
        <path d="M 58,150 A 230 180 0 0 1 300,22" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.85" filter="url(#plate-soft)" />
        <path d="M 440,300 A 230 180 0 0 1 330,372" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.6" filter="url(#plate-soft)" />
        <path d="M 196,382 Q 250,392 300,382" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.45" filter="url(#plate-soft)" />
        <ellipse cx="200" cy="120" rx="110" ry="40" fill="#fff" opacity="0.28" filter="url(#plate-shadow)" />
      </g>
      <ellipse cx="250" cy="200" rx="245.5" ry="194.5" fill="none" stroke="#bfb4a0" strokeWidth="1" opacity="0.8" />
    </svg>
  )
})

function slots(n: number) {
  if (n <= 4) {
    const R = n === 4 ? 30 : 36
    const gap = 2 * R + 10
    return Array.from({ length: n }, (_, i) => ({ x: 420, y: 202 + (i - (n - 1) / 2) * gap, R }))
  }
  const R = 25
  const rows = Math.ceil(n / 2)
  return Array.from({ length: n }, (_, i) => ({
    x: i % 2 ? 448 : 394,
    y: 202 + (Math.floor(i / 2) - (rows - 1) / 2) * (2 * R + 8) + (i % 2 ? 12 : 0),
    R,
  }))
}

/** Spirale (dall'esterno verso il centro) come la salsa spruzzata dal dosatore */
function spiral(R: number) {
  const pts: [number, number][] = []
  const turns = 2.6, steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = t * turns * Math.PI * 2 - Math.PI / 2
    const rr = R * 0.58 * (1 - t * 0.92)
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr])
  }
  return smoothOpen(pts)
}

const T = 1.9 // durata totale dello spruzzo (s)

function Ramekin({ x, y, R, name, instant }: { x: number; y: number; R: number; name: string; instant: boolean }) {
  const p = useMotionValue(instant ? 1 : 0)
  useEffect(() => {
    if (!instant) animate(p, 1, { duration: T + 0.3, ease: 'linear' })
  }, [instant, p])
  const kt = [0, 0.16, 0.5, 0.78, 1]
  const bx = useTransform(p, kt, [R * 0.78, R * 0.18, R * 0.18, R * 0.18, R * 1.1])
  const by = useTransform(p, kt, [-R * 2.8, -R * 1.15, -R * 1.15, -R * 1.15, -R * 3.4])
  const br = useTransform(p, kt, [150, 168, 168, 168, 140])
  const st = [0, 0.2, 0.3, 0.38, 0.47, 0.56, 0.65, 0.76, 1]
  const sx = useTransform(p, st, [1, 1, 0.82, 0.96, 0.8, 0.95, 0.82, 1, 1])
  const bottleO = useTransform(p, kt, [0, 1, 1, 1, 0])
  const bottleRef = useRef<SVGGElement>(null)
  const bottleT = useTransform(() => `translate(${bx.get()} ${by.get()}) rotate(${br.get()}) scale(${sx.get()} 1)`)
  useMotionValueEvent(bottleT, 'change', (v) => bottleRef.current?.setAttribute('transform', v))
  useMotionValueEvent(bottleO, 'change', (v) => bottleRef.current?.setAttribute('opacity', String(v)))
  const [c1, c2] = resolveSauceColor(name, useContext(ImagesContext))
  const sp = spiral(R)
  // punta del dosatore, sopra la ciotola
  const nx = R * 0.18, ny = -R * 1.15
  const stream = `M${nx},${ny} Q${nx * 0.6},${ny * 0.5} 0,${-R * 0.05}`
  const drops = [[-0.45, -0.2], [0.5, -0.35], [0.35, 0.45], [-0.3, 0.5]] as const
  return (
    <motion.g
      initial={{ x, y: y - 120, opacity: 0, scale: 1.2 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      exit={{ y: y - 40, opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      {/* ciotolina */}
      <ellipse cx={3} cy={6} rx={R * 1.02} ry={R * 0.98} fill="#5a3a14" opacity={0.25} filter="url(#ig-soft)" />
      <circle r={R} fill="url(#plate-body)" stroke="#c9bfae" strokeWidth={0.8} />
      <g style={{ mixBlendMode: 'multiply' }} filter="url(#plate-ink)">
        <circle r={R - 2.2} fill="none" stroke="#e8822a" strokeWidth={1.3} />
        <circle r={R - 4.2} fill="none" stroke="#24607a" strokeWidth={0.7} />
      </g>
      <circle r={R * 0.8} fill="url(#ram-wall)" />
      <path d={`M${-R * 0.8},${-R * 0.1} A${R * 0.85},${R * 0.85} 0 0 1 ${R * 0.2},${-R * 0.85}`} fill="none" stroke="#fff" strokeWidth={R * 0.09} strokeLinecap="round" opacity={0.9} />

      {/* salsa che si deposita: fondo + spirale disegnata in sincrono con lo spruzzo */}
      <motion.circle r={R * 0.7} fill={c1} stroke={c2} strokeWidth={R * 0.1}
        initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: T * 0.62, duration: 0.5, ease: 'easeOut' }} />
      <motion.path d={sp} fill="none" stroke={c2} strokeWidth={R * 0.32} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: T * 0.3, duration: T * 0.42, ease: 'linear' }} />
      <motion.path d={sp} fill="none" stroke={c1} strokeWidth={R * 0.24} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: T * 0.3, duration: T * 0.42, ease: 'linear' }} />
      <motion.path d={sp} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={R * 0.06} strokeLinecap="round"
        transform={`translate(${-R * 0.04} ${-R * 0.05})`}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: T * 0.3, duration: T * 0.42, ease: 'linear' }} />
      <motion.ellipse cx={-R * 0.25} cy={-R * 0.3} rx={R * 0.26} ry={R * 0.1} fill="#fff"
        transform={`rotate(-25 ${-R * 0.25} ${-R * 0.3})`}
        initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: T * 0.8 }} />

      {/* schizzi */}
      {drops.map(([dx, dy], i) => (
        <motion.circle key={i} r={R * 0.06} fill={c1}
          initial={{ cx: 0, cy: 0, opacity: 0 }}
          animate={{ cx: dx * R * 0.9, cy: dy * R * 0.9, opacity: [0, 1, 1, 0] }}
          transition={{ delay: T * 0.36 + i * 0.08, duration: 0.45, ease: 'easeOut' }} />
      ))}

      {/* getto */}
      <motion.path d={stream} fill="none" stroke={c1} strokeWidth={R * 0.13} strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 1 }}
        animate={{ pathLength: [0, 1, 1, 1], opacity: [1, 1, 1, 0] }}
        transition={{ delay: T * 0.24, duration: T * 0.56, times: [0, 0.12, 0.85, 1] }} />

      {/* dosatore capovolto: arriva, viene spremuto, se ne va */}
      <g ref={bottleRef} transform={bottleT.get()} opacity={bottleO.get()}>
          {/* disegnato dritto con la punta in (0,0) verso l'alto; la rotazione lo capovolge */}
          <path d={`M${-R * 0.05},0 L${R * 0.05},0 L${R * 0.13},${R * 0.38} L${-R * 0.13},${R * 0.38} Z`} fill="#f4f1ea" stroke="#bdb5a6" strokeWidth={0.8} />
          <rect x={-R * 0.3} y={R * 0.36} width={R * 0.6} height={R * 0.28} rx={R * 0.06} fill="#ffffff" stroke="#bdb5a6" strokeWidth={0.8} />
          <rect x={-R * 0.48} y={R * 0.6} width={R * 0.96} height={R * 1.75} rx={R * 0.3} fill={c1} stroke={c2} strokeWidth={1.2} />
          <rect x={-R * 0.48} y={R * 1.1} width={R * 0.96} height={R * 0.6} fill="#fffaf0" opacity={0.92} />
          <rect x={-R * 0.48} y={R * 1.1} width={R * 0.96} height={R * 0.08} fill="#f28c28" />
          <rect x={-R * 0.48} y={R * 1.62} width={R * 0.96} height={R * 0.08} fill="#1f5f7a" />
          <rect x={-R * 0.34} y={R * 0.72} width={R * 0.12} height={R * 1.45} rx={R * 0.06} fill="#fff" opacity={0.35} />
      </g>
    </motion.g>
  )
}

export function Ramekins({ sauces }: { sauces: FillingItem[] }) {
  const pos = slots(sauces.length)
  // le salse già presenti al primo render (ordine esistente) non rifanno lo spruzzo
  const seen = useRef<Set<string> | null>(null)
  if (!seen.current) seen.current = new Set(sauces.map((s) => s.id))
  const first = seen.current
  for (const id of [...first]) if (!sauces.some((s) => s.id === id)) first.delete(id)
  return (
    <svg className="ramekins" viewBox="0 0 500 400" aria-hidden="true">
      <AnimatePresence initial={false}>
        {sauces.map((s, i) => (
          <Ramekin key={s.id} {...pos[i]} name={s.name} instant={first.has(s.id)} />
        ))}
      </AnimatePresence>
    </svg>
  )
}
