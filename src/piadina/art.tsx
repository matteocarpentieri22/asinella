import type { ReactNode } from 'react'
import type { Category } from '../types'
import { blob, range, smoothClosed, smoothOpen, type Rng } from './rng'

/* =====================================================================
   Illustrazioni SVG degli ingredienti.
   Ogni "pezzo" è disegnato attorno a (0,0) in unità del viewBox 300x300
   della piadina (raggio piadina = 140).
   ===================================================================== */

export type Kind =
  | 'cotto' | 'crudo' | 'speck' | 'bresaola' | 'pancetta' | 'salame' | 'mortadella' | 'arrosto' | 'salsiccia' | 'tonno'
  | 'fetta' | 'provola' | 'brie' | 'molle' | 'squacquerone' | 'gorgonzola' | 'grana'
  | 'zucchine' | 'melanzane' | 'insalata' | 'rucola' | 'pomodoro' | 'peperoni' | 'cipolla' | 'funghi' | 'patate' | 'olive' | 'verdura'
  | 'salsa'

const RULES: [RegExp, Kind][] = [
  // salumi
  [/cott|prosciutto cotto|wurst|w[uü]rstel/, 'cotto'],
  [/speck/, 'speck'],
  [/bresaola|coppa|culatello/, 'bresaola'],
  [/crud|parma|san daniele|prosciutto/, 'crudo'],
  [/pancett|bacon|guanciale/, 'pancetta'],
  [/salam|spianat|chorizo|ventricina|nduja|'nduja|pepperoni/, 'salame'],
  [/mortadell/, 'mortadella'],
  [/porchett|arrost|tacchin|pollo|kebab|roast/, 'arrosto'],
  [/salsicc|luganeg/, 'salsiccia'],
  [/tonno|salmon|acciug/, 'tonno'],
  // formaggi
  [/squacquer|stracchin|crescenz|ricott|philadelph|spalmabil/, 'squacquerone'],
  [/mozzarell|burrat|bufal|fior di latte|stracciatell/, 'molle'],
  [/provol|scamorz|caciocaval|affumicat/, 'provola'],
  [/brie|camembert|taleggio/, 'brie'],
  [/gorgonzol|blu|roquefort/, 'gorgonzola'],
  [/grana|parmigian|pecorin|scaglie/, 'grana'],
  [/dobbiac|fontin|emmental|asiago|edamer|edam|sottilett|cheddar|latteria|montasio|svizzer|formagg/, 'fetta'],
  // verdure
  [/zucchin/, 'zucchine'],
  [/melanzan/, 'melanzane'],
  [/rucol/, 'rucola'],
  [/insalat|lattug|iceberg|radicchio|valeriana|songino|spinac/, 'insalata'],
  [/pomodor|pachino|ciliegin|datterin/, 'pomodoro'],
  [/peperon/, 'peperoni'],
  [/cipoll/, 'cipolla'],
  [/fungh|champignon|porcin/, 'funghi'],
  [/patat/, 'patate'],
  [/oliv/, 'olive'],
]

const CATEGORY_FALLBACK: Record<Category, Kind> = {
  salumi: 'cotto',
  formaggi: 'fetta',
  verdure: 'verdura',
  salse: 'salsa',
}

export function kindFor(name: string, category: Category): Kind {
  if (category === 'salse') return 'salsa'
  const n = name.toLowerCase()
  for (const [re, k] of RULES) if (re.test(n)) return k
  return CATEGORY_FALLBACK[category]
}

/** Colore della salsa dal nome */
export function sauceColor(name: string): [string, string] {
  const n = name.toLowerCase()
  if (/rosa|cocktail/.test(n)) return ['#f2a07e', '#e07f5c']
  if (/senap|mostard|honey/.test(n)) return ['#e7b21c', '#c48f0b']
  if (/ketch/.test(n)) return ['#c8231b', '#9c160f']
  if (/maion|maio|aioli|yogurt|tzatz/.test(n)) return ['#fbf3cf', '#e9dba4']
  if (/bbq|barbec/.test(n)) return ['#6e2c17', '#4b1b0c']
  if (/pesto|basilic/.test(n)) return ['#5c8f2b', '#41701b']
  if (/piccant|chili|sriracha|diavol|harissa/.test(n)) return ['#d23a12', '#a32705']
  if (/tartar/.test(n)) return ['#f1ecd2', '#d8d0a6']
  if (/balsam|aceto/.test(n)) return ['#3a1d14', '#24100a']
  if (/olio/.test(n)) return ['#d8c043', '#b9a12a']
  return ['#e98b3d', '#c66d22']
}

/* ---------------- defs globali (montati una volta) ---------------- */

export function GlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* impasto */}
        <radialGradient id="dough-top" cx="48%" cy="46%" r="60%">
          <stop offset="0%" stopColor="#fae9bf" />
          <stop offset="50%" stopColor="#f2d89e" />
          <stop offset="84%" stopColor="#e6bd76" />
          <stop offset="96%" stopColor="#d29a50" />
          <stop offset="100%" stopColor="#b97a35" />
        </radialGradient>
        <radialGradient id="dough-under" cx="52%" cy="46%" r="62%">
          <stop offset="0%" stopColor="#f3d9a0" />
          <stop offset="60%" stopColor="#ebc985" />
          <stop offset="88%" stopColor="#dcae64" />
          <stop offset="100%" stopColor="#c48a43" />
        </radialGradient>
        {/* luce dall'alto a sinistra: dà volume alla piadina */}
        <radialGradient id="dough-light" cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#fff8e6" stopOpacity="0.38" />
          <stop offset="45%" stopColor="#fff8e6" stopOpacity="0" />
          <stop offset="80%" stopColor="#4a2408" stopOpacity="0" />
          <stop offset="100%" stopColor="#4a2408" stopOpacity="0.22" />
        </radialGradient>
        <filter id="dough-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="dough-blur-s" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <filter id="dough-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.45  0 0 0 0 0.28  0 0 0 0 0.08  0 0 0 -1.6 1.05"
          />
        </filter>
        <filter id="ig-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.8" dy="1.6" stdDeviation="1.3" floodColor="#5a3510" floodOpacity="0.38" />
        </filter>
        <filter id="ig-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>

        {/* salumi */}
        <radialGradient id="ig-ham" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#f9c3b8" />
          <stop offset="70%" stopColor="#ef9f95" />
          <stop offset="100%" stopColor="#e48b84" />
        </radialGradient>
        <linearGradient id="ig-crudo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ec9a98" />
          <stop offset="35%" stopColor="#d9666d" />
          <stop offset="100%" stopColor="#c24a55" />
        </linearGradient>
        <linearGradient id="ig-speck" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a7392f" />
          <stop offset="100%" stopColor="#7a2219" />
        </linearGradient>
        <linearGradient id="ig-bresaola" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#962234" />
          <stop offset="100%" stopColor="#5f1220" />
        </linearGradient>
        <radialGradient id="ig-salame" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#c43c4a" />
          <stop offset="100%" stopColor="#8c1d2c" />
        </radialGradient>
        <radialGradient id="ig-mortadella" cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#f7b9c0" />
          <stop offset="100%" stopColor="#e996a1" />
        </radialGradient>
        <radialGradient id="ig-arrosto" cx="45%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#f2d5b5" />
          <stop offset="75%" stopColor="#e2b48a" />
          <stop offset="100%" stopColor="#b9773f" />
        </radialGradient>

        {/* formaggi */}
        <linearGradient id="ig-cheese" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff0b8" />
          <stop offset="60%" stopColor="#f7da7c" />
          <stop offset="100%" stopColor="#efc85a" />
        </linearGradient>
        <radialGradient id="ig-provola" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff8e2" />
          <stop offset="100%" stopColor="#f5e3b4" />
        </radialGradient>
        <radialGradient id="ig-cream" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#fffefa" />
          <stop offset="70%" stopColor="#fbf5e8" />
          <stop offset="100%" stopColor="#efe4cb" />
        </radialGradient>
        <radialGradient id="ig-mozz" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="80%" stopColor="#f8f4ea" />
          <stop offset="100%" stopColor="#e9e1cf" />
        </radialGradient>

        {/* verdure */}
        <radialGradient id="ig-zucchina" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#f0eec4" />
          <stop offset="75%" stopColor="#d9dc97" />
          <stop offset="100%" stopColor="#a6b55e" />
        </radialGradient>
        <radialGradient id="ig-melanzana" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#efdcab" />
          <stop offset="80%" stopColor="#d9bd82" />
          <stop offset="100%" stopColor="#a98654" />
        </radialGradient>
        <linearGradient id="ig-lettuce" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#eef8c6" />
          <stop offset="30%" stopColor="#c3e483" />
          <stop offset="70%" stopColor="#86c24f" />
          <stop offset="100%" stopColor="#4f962c" />
        </linearGradient>
        <radialGradient id="ig-tomato" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#f46a55" />
          <stop offset="100%" stopColor="#cf2c20" />
        </radialGradient>
        <radialGradient id="ig-potato" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#fbe7a4" />
          <stop offset="100%" stopColor="#e8bf5c" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/* ---------------- pezzi ---------------- */

const grill = (r: Rng, w: number, h: number, n = 3) => {
  const out: ReactNode[] = []
  const step = (w * 2) / (n + 1)
  for (let i = 1; i <= n; i++) {
    const x = -w + step * i + range(r, -2, 2)
    out.push(
      <line
        key={i}
        x1={x - h * 0.45}
        y1={-h * 0.62}
        x2={x + h * 0.45}
        y2={h * 0.62}
        stroke="#4a2c12"
        strokeOpacity={0.55}
        strokeWidth={2.6}
        strokeLinecap="round"
      />,
    )
  }
  return out
}

function dots(r: Rng, n: number, radius: number, color: string, min = 0.6, max = 1.6, opacity = 1) {
  return Array.from({ length: n }, (_, i) => {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * radius
    return (
      <ellipse
        key={i}
        cx={Math.cos(a) * d}
        cy={Math.sin(a) * d}
        rx={range(r, min, max)}
        ry={range(r, min, max) * 0.8}
        fill={color}
        opacity={opacity}
      />
    )
  })
}

const highlight = (rx: number, ry: number, x = -rx * 0.3, y = -ry * 0.35, o = 0.35) => (
  <ellipse cx={x} cy={y} rx={rx * 0.45} ry={ry * 0.22} fill="#fff" opacity={o} filter="url(#ig-soft)" />
)

export function Piece({ kind, r, label, uid = 'x' }: { kind: Kind; r: Rng; label?: string; uid?: string }): ReactNode {
  switch (kind) {
    case 'cotto': {
      // fetta di prosciutto cotto drappeggiata: pieghe con ombra/luce, bordo di grasso
      const d = blob(r, 31, 13, 0.24, range(r, 1.05, 1.3), range(r, 0.72, 0.92))
      const cid = 'c' + uid
      const folds = Array.from({ length: 3 }, (_, k) => {
        const y = -18 + k * 16 + range(r, -4, 4)
        return smoothOpen([[-40, y + range(r, -6, 6)], [-14, y + range(r, -7, 7)], [12, y + range(r, -7, 7)], [40, y + range(r, -6, 6)]])
      })
      return (
        <g>
          <clipPath id={cid}><path d={d} /></clipPath>
          <path d={d} fill="url(#ig-ham)" />
          <g clipPath={`url(#${cid})`}>
            {folds.map((f, k) => (
              <g key={k}>
                <path d={f} fill="none" stroke="#c4675f" strokeOpacity={0.32} strokeWidth={7} filter="url(#ig-soft)" />
                <path d={f} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={2.2} transform="translate(0 -4.5)" filter="url(#ig-soft)" />
              </g>
            ))}
            {Array.from({ length: 4 }, (_, k) => (
              <path key={'m' + k} d={blob(r, range(r, 6, 16), 7, 0.5)} transform={`translate(${range(r, -16, 16)} ${range(r, -16, 16)})`}
                fill="none" stroke="#e48a82" strokeOpacity={0.3} strokeWidth={0.8} />
            ))}
          </g>
          <path d={d} fill="none" stroke="#fdf1ea" strokeWidth={3.6} />
          <path d={d} fill="none" stroke="#e7b2a6" strokeWidth={0.8} />
        </g>
      )
    }
    case 'crudo':
    case 'speck':
    case 'bresaola': {
      // fetta sottile, ovale irregolare, con il grasso solo su un lato e venature
      const rad = kind === 'bresaola' ? 22 : 30
      const d = blob(r, rad, 14, 0.18, range(r, 1.3, 1.5), range(r, 0.72, 0.86))
      const cid = 'r' + uid
      const fill = kind === 'crudo' ? 'url(#ig-crudo)' : kind === 'speck' ? 'url(#ig-speck)' : 'url(#ig-bresaola)'
      const fold = range(r, -8, 8)
      return (
        <g>
          <clipPath id={cid}><path d={d} /></clipPath>
          <path d={d} fill={fill} opacity={kind === 'bresaola' ? 0.94 : 0.97} />
          <g clipPath={`url(#${cid})`}>
            {/* piega morbida */}
            <path d={smoothOpen([[fold - 10, -30], [fold + 2, -5], [fold - 4, 30]])} fill="none" stroke="#3a0a10" strokeOpacity={0.14} strokeWidth={9} filter="url(#ig-soft)" />
            <path d={smoothOpen([[fold - 4, -30], [fold + 8, -5], [fold + 2, 30]])} fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={4} filter="url(#ig-soft)" />
            {/* venature di grasso */}
            {kind !== 'bresaola' && Array.from({ length: 3 }, (_, k) => (
              <path key={k} d={smoothOpen([[range(r, -36, -20), range(r, -10, 10)], [range(r, -8, 8), range(r, -12, 12)], [range(r, 20, 36), range(r, -10, 10)]])}
                fill="none" stroke="#fff3ee" strokeOpacity={0.4} strokeWidth={range(r, 0.6, 1.3)} />
            ))}
            {/* grasso sul bordo superiore */}
            {kind !== 'bresaola' && (
              <path d={d} fill="none" stroke={kind === 'speck' ? '#f1e2d6' : '#fdf3ee'} strokeWidth={kind === 'speck' ? 5 : 6.5}
                transform={`translate(${rad * 0.08} ${rad * 0.34})`} />
            )}
          </g>
          {kind === 'speck' && <path d={d} fill="none" stroke="#4a1d0e" strokeWidth={1.6} strokeOpacity={0.8} />}
          {kind !== 'speck' && <path d={d} fill="none" stroke="#b8414c" strokeOpacity={0.35} strokeWidth={0.6} />}
        </g>
      )
    }

    case 'pancetta': {
      // fetta di pancetta: magro rosato con bande di grasso irregolari
      const L = 36, n = 9
      const ph = r() * 6.28
      const top: [number, number][] = [], bot: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const x = -L + (2 * L * i) / (n - 1)
        const yc = Math.sin(ph + i * 0.7) * 3
        const w = 15 + range(r, -1.5, 1.5)
        top.push([x, yc - w / 2]); bot.push([x, yc + w / 2])
      }
      const lerp = (f: number, j: number) => [top[j][0], top[j][1] + (bot[j][1] - top[j][1]) * f] as [number, number]
      const band = (f0: number, f1: number) => {
        const up: [number, number][] = [], dn: [number, number][] = []
        for (let j = 0; j < n; j++) {
          up.push(lerp(Math.max(0, f0 + range(r, -0.06, 0.06)), j))
          dn.push(lerp(Math.min(1, f1 + range(r, -0.06, 0.06)), j))
        }
        return smoothClosed([...up, ...dn.reverse()])
      }
      const d = smoothClosed([...top, ...[...bot].reverse()])
      const cid = 'pa' + uid
      return (
        <g>
          <clipPath id={cid}><path d={d} /></clipPath>
          <path d={d} fill="#d97479" />
          <g clipPath={`url(#${cid})`}>
            <path d={band(0.3, 0.48)} fill="#bf4f59" opacity={0.8} />
            <path d={band(-0.1, 0.2)} fill="#fbeee6" />
            <path d={band(0.52, 0.66)} fill="#f8e4da" opacity={0.95} />
            <path d={band(0.86, 1.1)} fill="#f6ddd2" />
            <path d={smoothOpen(top.map(([x, y]) => [x, y + 4] as [number, number]))} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.4} filter="url(#ig-soft)" />
          </g>
          <path d={d} fill="none" stroke="#b5525b" strokeOpacity={0.4} strokeWidth={0.6} />
        </g>
      )
    }

    case 'salame': {
      const rad = range(r, 13, 16)
      const d = blob(r, rad, 12, 0.06)
      return (
        <g>
          <path d={d} fill="url(#ig-salame)" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = r() * Math.PI * 2, dd = Math.sqrt(r()) * (rad - 2.5)
            return (
              <path key={i} transform={`translate(${Math.cos(a) * dd} ${Math.sin(a) * dd})`}
                d={blob(r, range(r, 0.7, 2.1), 6, 0.5)} fill="#fbece6" opacity={range(r, 0.8, 1)} />
            )
          })}
          {Array.from({ length: 3 }, (_, i) => (
            <circle key={'p' + i} cx={range(r, -rad * 0.6, rad * 0.6)} cy={range(r, -rad * 0.6, rad * 0.6)} r={0.75} fill="#2a1712" />
          ))}
          <path d={d} fill="none" stroke="#5a1220" strokeWidth={1.3} />
          <path d={d} fill="none" stroke="#c45a63" strokeOpacity={0.35} strokeWidth={0.6} transform="scale(0.9)" />
          <path d={`M${-rad * 0.6},${-rad * 0.35} A${rad * 0.75},${rad * 0.75} 0 0 1 ${rad * 0.2},${-rad * 0.7}`} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={1.4} strokeLinecap="round" filter="url(#ig-soft)" />
        </g>
      )
    }
    case 'mortadella': {
      const d = blob(r, 32, 14, 0.08)
      return (
        <g>
          <path d={d} fill="url(#ig-mortadella)" stroke="#f9d6da" strokeWidth={1.5} />
          {dots(r, 14, 26, '#fff6f4', 1, 2.6, 0.9)}
          {dots(r, 4, 22, '#7aa33f', 0.9, 1.6, 0.85)}
          {highlight(32, 32)}
        </g>
      )
    }
    case 'arrosto': {
      const d = blob(r, 26, 11, 0.2, 1.2, 0.9)
      return (
        <g>
          <path d={d} fill="url(#ig-arrosto)" stroke="#9c5b25" strokeWidth={3.4} />
          <path d={blob(r, 12, 7, 0.4)} fill="none" stroke="#c98f5c" strokeOpacity={0.5} strokeWidth={1.2} />
          {highlight(28, 22)}
        </g>
      )
    }
    case 'salsiccia': {
      return (
        <g>
          {Array.from({ length: 5 }, (_, i) => (
            <path
              key={i}
              transform={`translate(${range(r, -14, 14)} ${range(r, -14, 14)})`}
              d={blob(r, range(r, 4.5, 7), 7, 0.45)}
              fill="#c57a63" stroke="#8f4b36" strokeWidth={1}
            />
          ))}
        </g>
      )
    }
    case 'tonno': {
      return (
        <g>
          {Array.from({ length: 6 }, (_, i) => (
            <path
              key={i}
              transform={`translate(${range(r, -15, 15)} ${range(r, -15, 15)})`}
              d={blob(r, range(r, 4, 7), 6, 0.5)}
              fill="#d9b08a" stroke="#b78a63" strokeWidth={0.8}
            />
          ))}
        </g>
      )
    }


    case 'fetta': {
      // fetta di formaggio che si sta sciogliendo: bordi colanti e lucidi
      const s0 = 23
      const pts: [number, number][] = []
      const N = 32
      const drips = [Math.floor(r() * N), Math.floor(r() * N), Math.floor(r() * N)]
      for (let i = 0; i < N; i++) {
        const t = i / N
        const side = Math.floor(t * 4), u = t * 4 - side
        const c = [[-s0, -s0], [s0, -s0], [s0, s0], [-s0, s0]]
        const [ax, ay] = c[side], [bx, by] = c[(side + 1) % 4]
        let x = ax + (bx - ax) * u, y = ay + (by - ay) * u
        if (u < 0.12 || u > 0.88) { x *= 0.84; y *= 0.84 } // angoli smussati
        const len = Math.hypot(x, y) || 1
        let push = range(r, -0.4, 0.6)
        for (const dI of drips) {
          const dist = Math.min(Math.abs(dI - i), N - Math.abs(dI - i))
          push += 4.5 * Math.exp(-(dist * dist) / 2.2)
        }
        x += (x / len) * push; y += (y / len) * push
        pts.push([x * 0.95, y * 0.95])
      }
      const d = smoothClosed(pts)
      const cid = 'fe' + uid
      return (
        <g>
          <clipPath id={cid}><path d={d} /></clipPath>
          <path d={d} fill="url(#ig-cheese)" opacity={0.97} />
          <g clipPath={`url(#${cid})`}>
            <path d={d} fill="none" stroke="#d9992f" strokeOpacity={0.45} strokeWidth={6} filter="url(#ig-soft)" />
            <path d={`M${-s0},${-s0 * 0.2} Q0,${-s0 * 0.5} ${s0},${-s0 * 0.1}`} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={2.4} filter="url(#ig-soft)" />
            <path d={`M${-s0 * 0.6},${s0 * 0.5} Q0,${s0 * 0.3} ${s0 * 0.7},${s0 * 0.55}`} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1.4} filter="url(#ig-soft)" />
            {Array.from({ length: 3 }, (_, i) => (
              <ellipse key={i} cx={range(r, -14, 14)} cy={range(r, -14, 14)} rx={range(r, 1.2, 2.6)} ry={range(r, 1, 2)} fill="#e0aa3e" opacity={0.6} />
            ))}
          </g>
          <path d={d} fill="none" stroke="#dca540" strokeOpacity={0.6} strokeWidth={0.7} />
        </g>
      )
    }
    case 'provola': {
      const rad = range(r, 19, 22)
      return (
        <g>
          <path d={blob(r, rad, 12, 0.06)} fill="url(#ig-provola)" stroke="#c4843d" strokeWidth={4.2} />
          <path d={blob(r, rad - 6, 10, 0.1)} fill="none" stroke="#ead6a3" strokeWidth={1} />
          {highlight(rad, rad, -rad * 0.3, -rad * 0.3, 0.5)}
        </g>
      )
    }
    case 'brie': {
      const R = 36
      const a = 0.42
      const x1 = Math.cos(-a) * R, y1 = Math.sin(-a) * R
      const x2 = Math.cos(a) * R, y2 = Math.sin(a) * R
      return (
        <g transform="translate(-16 0)">
          <path d={`M0,0 L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`} fill="#f6e5ae" stroke="#f3e9d6" strokeWidth={1.2} />
          <path d={`M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`} fill="none" stroke="#fbf8f1" strokeWidth={5} />
          <path d={`M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`} fill="none" stroke="#e7dcc5" strokeWidth={1} transform="translate(-2.4 0)" />
          <path d="M3,0 L24,-6 L24,6 Z" fill="#fff6d0" opacity={0.6} />
        </g>
      )
    }

    case 'molle': {
      // fette di mozzarella: bianco latte, bordo più grigio, lucida e umida
      return (
        <g>
          {Array.from({ length: 2 }, (_, i) => {
            const x = range(r, -12, 12), y = range(r, -12, 12), rad = range(r, 12, 15)
            const d = blob(r, rad, 12, 0.12, 1, range(r, 0.85, 1))
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <path d={d} fill="url(#ig-mozz)" />
                <path d={d} fill="none" stroke="#ddd5c4" strokeWidth={1.6} opacity={0.8} />
                {Array.from({ length: 4 }, (_, k) => (
                  <ellipse key={k} cx={range(r, -rad * 0.6, rad * 0.6)} cy={range(r, -rad * 0.6, rad * 0.6)} rx={range(r, 0.5, 1.2)} ry={range(r, 0.4, 0.9)} fill="#e9e2d3" />
                ))}
                <path d={`M${-rad * 0.6},${-rad * 0.2} A${rad * 0.7},${rad * 0.7} 0 0 1 ${rad * 0.1},${-rad * 0.65}`} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
                <circle cx={rad * 0.3} cy={-rad * 0.35} r={0.9} fill="#fff" />
              </g>
            )
          })}
        </g>
      )
    }

    case 'squacquerone': {
      // crema spalmata col cucchiaio: bordi morbidi, creste lucide a spirale
      const d = blob(r, 28, 18, 0.28, 1.25, 0.85)
      const cid = 'sq' + uid
      const arcs = [9, 16, 23].map((rr, k) => {
        const a0 = r() * 6.28, a1 = a0 + range(r, 2.2, 3.6)
        const p = (a: number) => `${(Math.cos(a) * rr * 1.2).toFixed(1)},${(Math.sin(a) * rr * 0.8).toFixed(1)}`
        return { d: `M${p(a0)} A${rr * 1.2},${rr * 0.8} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`, k }
      })
      return (
        <g>
          <clipPath id={cid}><path d={d} /></clipPath>
          <path d={d} fill="url(#ig-cream)" />
          <g clipPath={`url(#${cid})`}>
            {arcs.map((a) => (
              <g key={a.k}>
                <path d={a.d} fill="none" stroke="#d6c8aa" strokeOpacity={0.55} strokeWidth={3} filter="url(#ig-soft)" transform="translate(0.8 1.2)" />
                <path d={a.d} fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
              </g>
            ))}
            <path d={d} fill="none" stroke="#e6d9bd" strokeWidth={5} opacity={0.6} filter="url(#ig-soft)" />
          </g>
          <ellipse cx={-8} cy={-8} rx={4} ry={1.6} fill="#fff" transform="rotate(-25 -8 -8)" />
        </g>
      )
    }
    case 'gorgonzola': {
      return (
        <g>
          <path d={blob(r, 15, 9, 0.35)} fill="#f8f1dc" stroke="#e5d9b6" strokeWidth={1} />
          {dots(r, 9, 11, '#4f8a86', 0.8, 2.2, 0.85)}
          {dots(r, 4, 11, '#2f6a68', 0.5, 1, 0.9)}
        </g>
      )
    }
    case 'grana': {
      return (
        <g>
          {Array.from({ length: 4 }, (_, i) => (
            <path
              key={i}
              transform={`translate(${range(r, -14, 14)} ${range(r, -14, 14)}) rotate(${range(r, 0, 180)})`}
              d={`M-8,-2 L${range(r, 2, 8)},-4 L9,2 L-2,${range(r, 3, 5)} Z`}
              fill="#f4df9c" stroke="#ddc06c" strokeWidth={0.8}
            />
          ))}
        </g>
      )
    }

    case 'zucchine': {
      const rx = range(r, 27, 32), ry = range(r, 8.5, 10)
      return (
        <g>
          <ellipse rx={rx} ry={ry} fill="url(#ig-zucchina)" stroke="#3c6a1e" strokeWidth={2.6} />
          {grill(r, rx * 0.8, ry, 4)}
          {highlight(rx, ry, -rx * 0.3, -ry * 0.3, 0.3)}
        </g>
      )
    }
    case 'melanzane': {
      const rx = range(r, 21, 25), ry = range(r, 15, 18)
      return (
        <g>
          <path d={blob(r, rx, 12, 0.08, 1, ry / rx)} fill="url(#ig-melanzana)" stroke="#3b1c45" strokeWidth={3} />
          {dots(r, 10, ry * 0.7, '#a07b45', 0.5, 1.1, 0.8)}
          {grill(r, rx * 0.75, ry, 3)}
        </g>
      )
    }

    case 'insalata': {
      // foglia di lattuga: bordo arricciato, base chiara, costola e venature, pieghe
      const L = range(r, 27, 32)
      const N = 44
      const ph = r() * 6.28
      const pts: [number, number][] = []
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2
        const ruffle = 1 + 0.06 * Math.sin(i * 2.6 + ph) + 0.04 * Math.sin(i * 5.3) + range(r, -0.035, 0.035)
        const x = Math.cos(a) * L
        const y = Math.sin(a) * L * 0.58 * (1 + 0.28 * Math.cos(a))
        pts.push([x * ruffle, y * ruffle])
      }
      const d = smoothClosed(pts)
      const cid = 'le' + uid
      const bend = range(r, -4, 4)
      return (
        <g>
          <clipPath id={cid}><path d={d} /></clipPath>
          <path d={d} fill="url(#ig-lettuce)" opacity={0.97} />
          <g clipPath={`url(#${cid})`}>
            <path d={d} fill="none" stroke="#4d8f2b" strokeOpacity={0.55} strokeWidth={7} filter="url(#ig-soft)" />
            {Array.from({ length: 7 }, (_, k) => {
              const cx = range(r, -L * 0.6, L * 0.7), cy = range(r, -L * 0.35, L * 0.35)
              const c = smoothOpen([[cx - 6, cy + range(r, -2, 2)], [cx, cy + range(r, -3, 3)], [cx + 6, cy + range(r, -2, 2)]])
              return (
                <g key={k}>
                  <path d={c} fill="none" stroke="#3f7a22" strokeOpacity={0.25} strokeWidth={2.6} filter="url(#ig-soft)" />
                  <path d={c} fill="none" stroke="#f4ffd8" strokeOpacity={0.45} strokeWidth={1} transform="translate(-0.6 -1)" />
                </g>
              )
            })}
            {Array.from({ length: 5 }, (_, k) => {
              const x0 = -L * 0.6 + k * L * 0.32
              const side = k % 2 ? 1 : -1
              return (
                <path key={'v' + k} d={`M${x0},${bend * 0.5} Q${x0 + L * 0.18},${side * L * 0.15} ${x0 + L * 0.3},${side * L * 0.38}`}
                  fill="none" stroke="#eaf8c8" strokeOpacity={0.75} strokeWidth={0.9} />
              )
            })}
          </g>
          <path d={`M${-L * 0.98},0 Q0,${bend} ${L * 0.75},${bend * 0.4}`} fill="none" stroke="#eef9d2" strokeWidth={3.2} strokeLinecap="round" />
          <path d={`M${-L * 0.98},0 Q0,${bend} ${L * 0.75},${bend * 0.4}`} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.1} strokeLinecap="round" transform="translate(0 -0.8)" />
        </g>
      )
    }

    case 'rucola': {
      // foglie di rucola con lobi profondi, verde scuro e costola chiara
      const leaf = (k: number) => {
        const len = range(r, 23, 28)
        const rot = range(r, 0, 360)
        const lobes: ReactNode[] = []
        for (let j = 0; j < 5; j++) {
          const t = 0.14 + j * 0.17
          const sz = 2 + j * 0.75
          for (const sgn of [-1, 1]) {
            const x = t * len + sz * 0.4, y = sgn * sz * 1.15
            const e = <ellipse key={j + '' + sgn} cx={x} cy={y} rx={sz * 1.25} ry={sz * 0.42} transform={`rotate(${sgn * -52} ${x} ${y})`} />
            lobes.push(e)
          }
        }
        const tip = <ellipse key="tip" cx={len * 0.98} cy={0} rx={5.6} ry={3.4} />
        return (
          <g key={k} transform={`translate(${range(r, -6, 4)} ${range(r, -6, 6)}) rotate(${rot}) translate(-10 0)`}>
            <g fill="#244d17" opacity={0.5} transform="translate(0.8 1.2)">{lobes}{tip}</g>
            <g fill="#3e7c2a">{lobes}{tip}</g>
            <g fill="#6aa346" opacity={0.35} transform="translate(-0.4 -0.6) scale(0.92)">{lobes}{tip}</g>
            <path d={`M-4,0 L${len * 1.02},0`} stroke="#3e7c2a" strokeWidth={2.4} strokeLinecap="round" />
            <path d={`M-4,0 L${len * 1.02},0`} stroke="#a9d07e" strokeWidth={1} strokeLinecap="round" />
          </g>
        )
      }
      return <g>{[0, 1, 2].map(leaf)}</g>
    }
    case 'pomodoro': {
      const rad = range(r, 13, 16)
      return (
        <g>
          <circle r={rad} fill="url(#ig-tomato)" stroke="#b5241b" strokeWidth={1.4} />
          <circle r={rad * 0.32} fill="#f78d72" opacity={0.85} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + 0.4
            return (
              <g key={i} transform={`translate(${Math.cos(a) * rad * 0.58} ${Math.sin(a) * rad * 0.58}) rotate(${(a * 180) / Math.PI})`}>
                <ellipse rx={rad * 0.3} ry={rad * 0.2} fill="#f6a183" />
                <ellipse cx={-1.2} rx={1} ry={0.6} fill="#fbe3a2" />
                <ellipse cx={1.6} rx={1} ry={0.6} fill="#fbe3a2" />
              </g>
            )
          })}
          {highlight(rad, rad)}
        </g>
      )
    }
    case 'peperoni': {
      const col = r() > 0.5 ? ['#d9331f', '#a8200f'] : ['#f3b51d', '#c98c09']
      const d = smoothOpen([[-24, 4], [-10, range(r, -8, -2)], [8, range(r, -6, 0)], [24, range(r, 2, 8)]])
      return (
        <g>
          <path d={d} fill="none" stroke={col[1]} strokeWidth={10} strokeLinecap="round" />
          <path d={d} fill="none" stroke={col[0]} strokeWidth={7.5} strokeLinecap="round" />
          <path d={d} fill="none" stroke="#fff" strokeOpacity={0.4} strokeWidth={1.6} strokeLinecap="round" transform="translate(0 -2)" />
          <path d={d} fill="none" stroke="#3a1a0a" strokeOpacity={0.35} strokeWidth={6} strokeDasharray="2 9" />
        </g>
      )
    }
    case 'cipolla': {
      return (
        <g fill="none">
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${range(r, -10, 10)} ${range(r, -10, 10)})`}>
              <ellipse rx={13} ry={11} stroke="#c592bf" strokeWidth={2.4} />
              <ellipse rx={8.5} ry={7} stroke="#e9d4e6" strokeWidth={2} />
            </g>
          ))}
        </g>
      )
    }
    case 'funghi': {
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${range(r, -14, 14)} ${range(r, -12, 12)}) rotate(${range(r, -40, 40)})`}>
              <path d="M-11,0 C-11,-11 11,-11 11,0 L4,0 L4,9 C4,11 -4,11 -4,9 L-4,0 Z" fill="#d6b48c" stroke="#8b6340" strokeWidth={1.1} />
              <path d="M-8,-2 C-6,-7 6,-7 8,-2" fill="none" stroke="#a57e55" strokeWidth={0.8} />
            </g>
          ))}
        </g>
      )
    }
    case 'patate': {
      return (
        <g>
          {[0, 1].map((i) => {
            const rad = range(r, 10, 13)
            return (
              <g key={i} transform={`translate(${range(r, -10, 10)} ${range(r, -10, 10)})`}>
                <path d={blob(r, rad, 9, 0.12)} fill="url(#ig-potato)" stroke="#c9963b" strokeWidth={1.4} />
                {highlight(rad, rad)}
              </g>
            )
          })}
        </g>
      )
    }
    case 'olive': {
      return (
        <g>
          {Array.from({ length: 5 }, (_, i) => (
            <g key={i} transform={`translate(${range(r, -16, 16)} ${range(r, -16, 16)})`}>
              <ellipse rx={5} ry={4.2} fill="#2c2a1f" />
              <ellipse rx={2} ry={1.6} fill="#5a5340" />
              <ellipse cx={-1.8} cy={-1.8} rx={1.2} ry={0.6} fill="#fff" opacity={0.4} />
            </g>
          ))}
        </g>
      )
    }
    case 'verdura': {
      const rx = range(r, 20, 26), ry = range(r, 12, 15)
      return (
        <g>
          <path d={blob(r, rx, 10, 0.18, 1, ry / rx)} fill="#9cbf5a" stroke="#4d7a25" strokeWidth={2.4} />
          {grill(r, rx * 0.7, ry, 3)}
          {highlight(rx, ry)}
        </g>
      )
    }
    case 'salsa':
    default:
      return label ? <text>{label}</text> : null
  }
}

/** Quanti pezzi per tipo: porzioni realistiche che coprono la metà della piadina */
const COUNTS: Partial<Record<Kind, number>> = {
  cotto: 7, crudo: 8, speck: 8, bresaola: 10, pancetta: 9, salame: 12, mortadella: 5, arrosto: 7, salsiccia: 6, tonno: 6,
  fetta: 6, provola: 7, brie: 5, molle: 6, squacquerone: 5, gorgonzola: 8, grana: 7,
  zucchine: 9, melanzane: 7, insalata: 9, rucola: 9, pomodoro: 8, peperoni: 8, cipolla: 6, funghi: 6, patate: 7, olive: 5, verdura: 7,
}
export function pieceCount(kind: Kind): number {
  return COUNTS[kind] ?? 6
}

/** Raggio indicativo del pezzo (per tenerlo dentro la piadina) */
export function pieceSize(kind: Kind): number {
  switch (kind) {
    case 'cotto': case 'crudo': case 'speck': case 'mortadella': case 'squacquerone': case 'insalata': case 'pancetta': return 36
    case 'rucola': return 30
    case 'salame': case 'pomodoro': case 'olive': return 16
    default: return 26
  }
}
