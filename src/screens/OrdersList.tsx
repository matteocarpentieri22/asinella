import { motion } from 'framer-motion'
import { formatDeadline, formatEventDate, isOpen } from '../format'
import { IngredientIcon } from '../piadina/IngredientIcon'
import { orderLabel } from '../summary'
import type { EventRow, Order, Player } from '../types'

/** Le piadine di tutti per la serata in corso */
export default function OrdersList({
  event, orders, players, me, onCompose,
}: { event: EventRow | null; orders: Order[]; players: Player[]; me: Player; onCompose: () => void }) {
  const byId = new Map(players.map((p) => [p.id, p]))
  const sorted = [...orders].sort((a, b) => {
    if (a.player_id === me.id) return -1
    if (b.player_id === me.id) return 1
    const pa = byId.get(a.player_id), pb = byId.get(b.player_id)
    return (pa?.first_name ?? '').localeCompare(pb?.first_name ?? '')
  })
  const open = isOpen(event)
  const mine = orders.some((o) => o.player_id === me.id)

  return (
    <div className="orders">
      {event && (
        <p className="muted small orders-sub">
          {formatEventDate(event.event_date)} · {open ? `ordini aperti fino a ${formatDeadline(event.deadline)}` : 'ordini chiusi'}
        </p>
      )}

      {open && !mine && (
        <button className="cta-card" onClick={onCompose}>
          <span>🫓</span>
          <span><strong>Non hai ancora ordinato</strong><small>Tocca per comporre la tua piadina</small></span>
          <span className="cta-go">›</span>
        </button>
      )}

      {!orders.length && <p className="muted empty-orders">Ancora nessuno ha ordinato. Sii il primo!</p>}

      <ul className="order-list">
        {sorted.map((o, i) => {
          const p = byId.get(o.player_id)
          const isMe = o.player_id === me.id
          return (
            <motion.li key={o.id} className={'order' + (isMe ? ' is-mine' : '')}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
              onClick={isMe && open ? onCompose : undefined}>
              <div className="order-avatar">{p ? p.first_name[0] + p.last_name[0] : '?'}</div>
              <div className="order-body">
                <div className="order-name">{p ? `${p.first_name} ${p.last_name}` : 'Sconosciuto'}{isMe && ' (tu)'}</div>
                <div className="order-icons">
                  {o.items.slice(0, 7).map((it) => <IngredientIcon key={it.id} name={it.name} category={it.category} />)}
                </div>
                <div className="order-items">{orderLabel(o)}</div>
                {o.notes && <div className="order-notes">📝 {o.notes}</div>}
              </div>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
