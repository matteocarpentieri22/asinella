import { memo, useContext } from 'react'
import type { Category } from '../types'
import { Piece, kindFor } from './art'
import { ImagesContext, nameKey, resolveSauceColor } from './images'
import { rngFrom } from './rng'

/** Icona miniatura per i bottoni ingrediente: immagine generata se c'è, altrimenti il disegno */
export const IngredientIcon = memo(function IngredientIcon({ name, category }: { name: string; category: Category }) {
  const images = useContext(ImagesContext)
  const kind = kindFor(name, category)
  if (kind === 'salsa') {
    const [c1, c2] = resolveSauceColor(name, images)
    return (
      <svg viewBox="-24 -24 48 48" className="ing-icon" aria-hidden="true">
        <path d="M-14,8 C-18,-2 -6,-4 -8,-10 C-2,-6 6,-8 4,-16 C14,-8 16,4 10,10 C4,16 -10,16 -14,8Z" fill={c2} />
        <path d="M-12,7 C-15,-1 -5,-3 -7,-8 C-2,-5 5,-6 4,-13 C12,-6 13,3 9,8 C4,13 -9,13 -12,7Z" fill={c1} />
        <ellipse cx={-3} cy={-1} rx={4} ry={2} fill="#fff" opacity={0.45} />
      </svg>
    )
  }
  const url = images.get(nameKey(name))?.image_url
  if (url) return <img className="ing-icon ing-icon--img" src={url} alt="" loading="lazy" />
  return (
    <svg viewBox="-40 -40 80 80" className="ing-icon" aria-hidden="true">
      <g filter="url(#ig-shadow)">
        <Piece kind={kind} r={rngFrom(name + 'icon')} uid={'ic' + name.replace(/[^a-zA-Z0-9]/g, '')} />
      </g>
    </svg>
  )
})
