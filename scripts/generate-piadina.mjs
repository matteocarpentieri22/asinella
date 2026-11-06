// Genera con Gemini la piadina di default dell'app (una volta sola, in locale).
//
//   node scripts/generate-piadina.mjs [quante]      (default 3 varianti)
//
// Legge GEMINI_API_KEY dall'ambiente o da .env.local (mai su GitHub).
// Salva le varianti scontornate in scripts/out/piadina-N.png:
// la migliore si copia in public/piadina.png.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const OUT = path.join(ROOT, 'scripts', 'out')

function readKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const f = path.join(ROOT, '.env.local')
  if (fs.existsSync(f)) {
    const m = fs.readFileSync(f, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1].trim()
  }
  throw new Error('GEMINI_API_KEY mancante: aggiungila in .env.local')
}

const KEY = readKey()
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1'
const API = 'https://generativelanguage.googleapis.com/v1beta'

// Stessa guida di stile della Edge Function degli ingredienti
const PROMPT = [
  'Draw one single empty Italian "piadina romagnola" flatbread, freshly cooked on the griddle, with nothing on it.',
  'View: exactly top-down (flat lay, camera directly above). The piadina is a perfect circle, centered, fully visible, filling about 92% of the frame.',
  'Look: pale cream-golden dough, thin and slightly irregular, with many realistic golden-brown and darker toasted spots and small blisters from the griddle, a slightly darker toasted rim, fine flour texture.',
  'Style: realistic, appetizing hand-painted food illustration with fine detail and natural texture, soft natural light from the top-left, gentle soft shading, no black outlines, no cartoon look.',
  'Background: a perfectly flat, uniform, solid pure magenta color (#FF00FF) everywhere around the piadina. No shadow on the background, no gradient, no plate, no board, no props, no text, no watermark.',
].join('\n')

async function gemini() {
  const errors = []
  const r1 = await fetch(`${API}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: 'text', text: PROMPT }],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '1:1', image_size: '2K' },
    }),
  })
  if (r1.ok) return r1.json()
  errors.push(`interactions ${r1.status}: ${(await r1.text()).slice(0, 400)}`)
  const r2 = await fetch(`${API}/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  })
  if (r2.ok) return r2.json()
  errors.push(`generateContent ${r2.status}: ${(await r2.text()).slice(0, 400)}`)
  throw new Error(errors.join('\n'))
}

function findImage(node) {
  if (!node || typeof node !== 'object') return null
  const inline = node.inlineData ?? node.inline_data
  if (inline && typeof inline.data === 'string') return Buffer.from(inline.data, 'base64')
  if (node.type === 'image' && typeof node.data === 'string') return Buffer.from(node.data, 'base64')
  if (node.output_image?.data) return Buffer.from(node.output_image.data, 'base64')
  for (const v of Object.values(node)) {
    const f = findImage(v)
    if (f) return f
  }
  return null
}

/** Toglie lo sfondo magenta, ritaglia e ridimensiona a 900px */
async function cutout(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  let br = 0, bg = 0, bb = 0, n = 0
  for (const [cx, cy] of [[0, 0], [w - 10, 0], [0, h - 10], [w - 10, h - 10]]) {
    for (let y = cy; y < cy + 10; y++) for (let x = cx; x < cx + 10; x++) {
      const i = (y * w + x) * 4
      br += data[i]; bg += data[i + 1]; bb += data[i + 2]; n++
    }
  }
  br /= n; bg /= n; bb /= n
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const d = Math.hypot(r - br, g - bg, b - bb)
    const a = d < 70 ? 0 : d > 150 ? 255 : Math.round(((d - 70) / 80) * 255)
    const spill = Math.min(r, b) - g
    if (spill > 0 && a < 255) { data[i] = Math.max(0, r - spill * 0.6); data[i + 2] = Math.max(0, b - spill * 0.6) }
    data[i + 3] = a
    if (a > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  }
  if (maxX <= minX) throw new Error("Scontorno fallito: l'immagine sembra vuota")
  const side = Math.max(maxX - minX, maxY - minY) + 1
  const cx = Math.round((minX + maxX) / 2), cy = Math.round((minY + maxY) / 2)
  // ritaglio quadrato centrato sulla piadina (serve per la piega a metà)
  const left = Math.max(0, cx - Math.floor(side / 2)), top = Math.max(0, cy - Math.floor(side / 2))
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: Math.min(side, w - left), height: Math.min(side, h - top) })
    .resize(900, 900, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const count = Math.max(1, Math.min(5, Number(process.argv[2] ?? 3)))
fs.mkdirSync(OUT, { recursive: true })
for (let k = 1; k <= count; k++) {
  process.stdout.write(`Variante ${k}/${count}… `)
  try {
    const res = await gemini()
    const raw = findImage(res)
    if (!raw) throw new Error('Nessuna immagine nella risposta: ' + JSON.stringify(res).slice(0, 300))
    fs.writeFileSync(path.join(OUT, `piadina-${k}-raw.jpg`), raw)
    const png = await cutout(raw)
    fs.writeFileSync(path.join(OUT, `piadina-${k}.png`), png)
    console.log(`ok → scripts/out/piadina-${k}.png (${Math.round(png.length / 1024)} KB)`)
  } catch (e) {
    console.log('ERRORE\n' + e.message)
  }
}
