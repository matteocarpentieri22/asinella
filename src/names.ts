import type { Player } from './types'

/** Nome da mostrare (il cognome è facoltativo: chi è entrato prima può averlo) */
export const fullName = (p: Pick<Player, 'first_name' | 'last_name'>) =>
  [p.first_name, p.last_name].filter((s) => s && s.trim()).join(' ')

/** Iniziali per l'avatar: nome+cognome, oppure le prime due lettere del nome */
export const initials = (p: Pick<Player, 'first_name' | 'last_name'>) =>
  (p.last_name?.trim() ? p.first_name[0] + p.last_name[0] : p.first_name.slice(0, 2)).toUpperCase()
