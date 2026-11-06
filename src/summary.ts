import type { Order, Player } from './types'

const CAT_ORDER = ['salumi', 'formaggi', 'verdure']

/** "cotto, provola, zucchine · salse a parte: senape" */
export function orderLabel(o: Order) {
  const items = o.items
    .filter((i) => i.category !== 'salse')
    .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category))
    .map((i) => i.name.toLowerCase())
  if (o.extra) items.push(o.extra.toLowerCase())
  const sauces = o.items.filter((i) => i.category === 'salse').map((i) => i.name.toLowerCase())
  let label = items.join(', ')
  if (sauces.length) label += `${label ? ' · ' : ''}salse a parte: ${sauces.join(', ')}`
  return label
}

/** Testo per Asinella: una riga per persona, nome e cognome + ingredienti. */
export function asinellaText(orders: Order[], players: Player[]) {
  const byId = new Map(players.map((p) => [p.id, p]))
  return orders
    .map((o) => {
      const p = byId.get(o.player_id)
      const name = p ? `${p.first_name} ${p.last_name}` : '?'
      return { name, line: `${name}: ${orderLabel(o)}${o.notes ? ` (${o.notes})` : ''}` }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => x.line)
    .join('\n')
}
