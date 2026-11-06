import { createContext, useContext } from 'react'
import { sauceColor } from './art'

/** Immagini generate (una per nome ingrediente), condivise da tutta l'app */
export interface IngredientImage {
  name_key: string
  display_name: string
  category: string
  image_url: string | null
  color: string | null
  status: 'pending' | 'ok' | 'error'
  error: string | null
}

export type ImageMap = Map<string, IngredientImage>

export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export const ImagesContext = createContext<ImageMap>(new Map())

export function useIngredientImage(name: string) {
  return useContext(ImagesContext).get(nameKey(name))
}

/** Colore salsa: quello suggerito da Gemini se c'è, altrimenti dalle regole sul nome */
export function resolveSauceColor(name: string, images: ImageMap): [string, string] {
  const c = images.get(nameKey(name))?.color
  if (c && /^#[0-9a-f]{6},#[0-9a-f]{6}$/i.test(c)) {
    const [a, b] = c.split(',')
    return [a, b]
  }
  return sauceColor(name)
}
