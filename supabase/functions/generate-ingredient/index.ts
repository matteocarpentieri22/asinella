// Supabase Edge Function: genera l'immagine di un ingrediente con Gemini.
//
// POST { pin, name, category }
//  - verifica il PIN admin
//  - salse: chiede a Gemini solo il colore (le ciotoline restano disegnate)
//  - altri ingredienti: genera un singolo pezzo visto dall'alto, su sfondo magenta pieno,
//    con lo stesso stile delle immagini già generate (passate come riferimento),
//    scontorna lo sfondo, ritaglia e salva un PNG trasparente su Storage.
//
// Segreti richiesti: GEMINI_API_KEY
// Opzionali: GEMINI_IMAGE_MODEL, GEMINI_TEXT_MODEL

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const IMAGE_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'gemini-nano-banana-2.1'
const TEXT_MODEL = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-3.1-flash-lite'
const API = 'https://generativelanguage.googleapis.com/v1beta'
const BUCKET = 'ingredient-images'
const CATEGORIES = ['salumi', 'formaggi', 'verdure', 'salse']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* ------------------------------------------------------------------ */
/*  Prompt di stile: identico per ogni ingrediente → set coerente      */
/* ------------------------------------------------------------------ */

const PIECE_HINT: Record<string, string> = {
  salumi: 'one thin slice, gently draped and folded as it would lie inside a piadina',
  formaggi: 'one slice or one piece of the cheese as it is put inside a piadina (soft cheeses as a creamy spoonful, sliced cheeses slightly melted)',
  verdure: 'one single piece as it is put inside a piadina (one leaf for salads, one grilled slice for grilled vegetables, one round slice for tomatoes, etc.)',
}

function stylePrompt(name: string, category: string, hasRefs: boolean) {
  return [
    `Ingredient: "${name}" (Italian name, category: ${category}).`,
    `Draw ${PIECE_HINT[category]}.`,
    'View: exactly top-down (flat lay, camera directly above).',
    'Style: realistic, appetizing hand-painted food illustration with fine detail and natural texture, soft natural light from the top-left, gentle soft shading, no black outlines, no cartoon look.',
    hasRefs ? 'Match EXACTLY the illustration style, lighting, level of detail and color treatment of the reference images.' : '',
    'Composition: a single piece only, centered, fully visible and not cut off, filling about 75% of the frame.',
    'Background: a perfectly flat, uniform, solid pure magenta color (#FF00FF) everywhere around the piece. No shadow on the background, no gradient, no texture, no plate, no board, no props, no text, no watermark.',
  ].filter(Boolean).join('\n')
}

/* ------------------------------------------------------------------ */
/*  Chiamate Gemini (Interactions API, con ripiego su generateContent) */
/* ------------------------------------------------------------------ */

type Ref = { mime: string; data: string }

async function gemini(model: string, text: string, refs: Ref[], wantImage: boolean): Promise<unknown> {
  const errors: string[] = []

  // 1) Interactions API (documentazione attuale)
  const input: unknown[] = [{ type: 'text', text }]
  for (const r of refs) input.push({ type: 'image', mime_type: r.mime, data: r.data })
  const body1: Record<string, unknown> = { model, input }
  if (wantImage) body1.response_format = { type: 'image', mime_type: 'image/png', aspect_ratio: '1:1', image_size: '1K' }
  const r1 = await fetch(`${API}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
    body: JSON.stringify(body1),
  })
  if (r1.ok) return await r1.json()
  errors.push(`interactions ${r1.status}: ${(await r1.text()).slice(0, 300)}`)

  // 2) generateContent (API classica)
  const parts: unknown[] = [{ text }]
  for (const r of refs) parts.push({ inlineData: { mimeType: r.mime, data: r.data } })
  const body2 = {
    contents: [{ role: 'user', parts }],
    generationConfig: wantImage
      ? { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } }
      : { responseMimeType: 'application/json' },
  }
  const r2 = await fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body2),
  })
  if (r2.ok) return await r2.json()
  errors.push(`generateContent ${r2.status}: ${(await r2.text()).slice(0, 300)}`)
  throw new Error('Gemini non ha risposto: ' + errors.join(' | '))
}

/** Cerca la prima immagine base64 nella risposta, qualunque sia il formato. */
function findImage(node: unknown): Uint8Array | null {
  if (!node || typeof node !== 'object') return null
  const o = node as Record<string, unknown>
  const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined
  if (inline && typeof inline.data === 'string') return b64decode(inline.data)
  if (o.type === 'image' && typeof o.data === 'string') return b64decode(o.data)
  if (o.output_image && typeof (o.output_image as Record<string, unknown>).data === 'string') {
    return b64decode((o.output_image as Record<string, string>).data)
  }
  for (const v of Object.values(o)) {
    const f = findImage(v)
    if (f) return f
  }
  return null
}

function findText(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  const o = node as Record<string, unknown>
  for (const [k, v] of Object.entries(o)) {
    if ((k === 'text' || k === 'output_text') && typeof v === 'string') out.push(v)
    else findText(v, out)
  }
  return out
}

function b64decode(s: string) {
  const bin = atob(s)
  const a = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i)
  return a
}
function b64encode(a: Uint8Array) {
  let s = ''
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000))
  return btoa(s)
}

/* ------------------------------------------------------------------ */
/*  Scontorno dello sfondo magenta                                     */
/* ------------------------------------------------------------------ */

async function cutout(bytes: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(bytes)
  const { width: w, height: h } = img
  const px = img.bitmap // RGBA

  // colore di sfondo medio dagli angoli
  let br = 0, bg = 0, bb = 0, n = 0
  for (const [cx, cy] of [[0, 0], [w - 10, 0], [0, h - 10], [w - 10, h - 10]]) {
    for (let y = cy; y < cy + 10; y++) for (let x = cx; x < cx + 10; x++) {
      const i = (y * w + x) * 4
      br += px[i]; bg += px[i + 1]; bb += px[i + 2]; n++
    }
  }
  br /= n; bg /= n; bb /= n

  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = px[i], g = px[i + 1], b = px[i + 2]
      const d = Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2)
      let a = d < 70 ? 0 : d > 150 ? 255 : Math.round(((d - 70) / 80) * 255)
      // togli l'alone magenta sui bordi
      const spill = Math.min(r, b) - g
      if (spill > 0 && a < 255) {
        px[i] = Math.max(0, r - spill * 0.6)
        px[i + 2] = Math.max(0, b - spill * 0.6)
      }
      px[i + 3] = a
      if (a > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX || maxY <= minY) throw new Error("Scontorno fallito: l'immagine sembra vuota")
  const pad = 6
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad)
  const cropped = img.crop(minX, minY, maxX - minX + 1, maxY - minY + 1)
  const side = Math.max(cropped.width, cropped.height)
  if (side > 384) {
    if (cropped.width >= cropped.height) cropped.resize(384, Image.RESIZE_AUTO)
    else cropped.resize(Image.RESIZE_AUTO, 384)
  }
  return await cropped.encode()
}

/* ------------------------------------------------------------------ */

async function sauceColor(name: string): Promise<string> {
  const res = await gemini(
    TEXT_MODEL,
    `Return ONLY a JSON object {"fill":"#rrggbb","edge":"#rrggbb"} with the typical color of the sauce "${name}" (Italian name) as it looks in a small white bowl. "edge" is a slightly darker shade of "fill".`,
    [],
    false,
  )
  const text = findText(res).join('\n')
  const m = text.match(/\{[\s\S]*?\}/)
  if (!m) throw new Error('Colore non trovato nella risposta')
  const c = JSON.parse(m[0])
  const ok = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
  if (!ok(c.fill) || !ok(c.edge)) throw new Error('Colore non valido')
  return `${c.fill},${c.edge}`
}

async function loadRefs(sb: ReturnType<typeof createClient>, exclude: string): Promise<Ref[]> {
  const { data } = await sb
    .from('ingredient_images')
    .select('name_key, image_url')
    .eq('status', 'ok')
    .not('image_url', 'is', null)
    .neq('name_key', exclude)
    .order('created_at')
    .limit(3)
  const refs: Ref[] = []
  for (const row of data ?? []) {
    try {
      const r = await fetch(row.image_url as string)
      if (!r.ok) continue
      // i riferimenti sono trasparenti: li rimettiamo su magenta così lo stile di sfondo resta chiaro
      const img = await Image.decode(new Uint8Array(await r.arrayBuffer()))
      const bgImg = new Image(img.width, img.height).fill(0xff00ffff)
      bgImg.composite(img, 0, 0)
      refs.push({ mime: 'image/png', data: b64encode(await bgImg.encode()) })
    } catch { /* ignora riferimento rotto */ }
  }
  return refs
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metodo non permesso' }, 405)
  if (!GEMINI_KEY) return json({ error: 'GEMINI_API_KEY non configurata su Supabase' }, 500)

  let pin = '', name = '', category = ''
  try {
    ;({ pin, name, category } = await req.json())
  } catch {
    return json({ error: 'Richiesta non valida' }, 400)
  }
  name = (name ?? '').trim()
  if (!name || name.length > 60 || !CATEGORIES.includes(category)) return json({ error: 'Nome o categoria non validi' }, 400)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: isAdmin } = await sb.rpc('admin_check', { p_pin: pin })
  if (!isAdmin) return json({ error: 'PIN admin errato' }, 401)

  const key = nameKey(name)
  await sb.from('ingredient_images').upsert({
    name_key: key, display_name: name, category, status: 'pending', error: null, updated_at: new Date().toISOString(),
  })

  try {
    if (category === 'salse') {
      const color = await sauceColor(name)
      await sb.from('ingredient_images').update({ status: 'ok', color, image_url: null, updated_at: new Date().toISOString() }).eq('name_key', key)
      return json({ color })
    }

    const refs = await loadRefs(sb, key)
    const res = await gemini(IMAGE_MODEL, stylePrompt(name, category, refs.length > 0), refs, true)
    const raw = findImage(res)
    if (!raw) throw new Error('Gemini non ha restituito immagini: ' + findText(res).join(' ').slice(0, 200))
    const png = await cutout(raw)

    const path = `${slug(key) || 'ingrediente'}-${Date.now()}.png`
    const up = await sb.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error('Upload fallito: ' + up.error.message)
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)

    await sb.from('ingredient_images').update({
      status: 'ok', image_url: pub.publicUrl, updated_at: new Date().toISOString(),
    }).eq('name_key', key)
    return json({ image_url: pub.publicUrl })
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500)
    await sb.from('ingredient_images').update({ status: 'error', error: msg, updated_at: new Date().toISOString() }).eq('name_key', key)
    return json({ error: msg }, 500)
  }
})
