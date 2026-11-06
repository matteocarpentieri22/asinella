import { motion } from 'framer-motion'
import { formatEventDate } from '../format'
import { orderLabel } from '../summary'
import type { EventRow, Order, Player } from '../types'

export default function OrdersList({
  event, orders, players, me, onBack,
}: { event: EventRow | null; orders: Order[]; players: Player[]; me: Player; onBack: () => void }) {
  const byId = new Map(players.map((p) => [p.id, p]))
  const sorted = [...orders].sort((a, b) => {
    if (a.player_id === me.id) return -1
    if (b.player_id === me.id) return 1
    const pa = byId.get(a.player_id), pb = byId.get(b.player_id)
    return (pa?.first_name ?? '').localeCompare(pb?.first_name ?? '')
  })

  return (
    <div className="orders">
      <div className="orders-head">
        <h2>Ordini {event ? `di ${formatEventDate(event.event_date)}` : ''}</h2>
        <span className="pill">{orders.length} 🫓</span>
      </div>
      {!orders.length && <p className="muted">Ancora nessuno ha ordinato. Sii il primo!</p>}
      <ul className="order-list">
        {sorted.map((o, i) => {
          const p = byId.get(o.player_id)
          const mine = o.player_id === me.id
          return (
            <motion.li key={o.id} className={'order' + (mine ? ' is-mine' : '')}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
              <div className="order-avatar">{p ? p.first_name[0] + p.last_name[0] : '?'}</div>
              <div className="order-body">
                <div className="order-name">{p ? `${p.first_name} ${p.last_name}` : 'Sconosciuto'}{mine && ' (tu)'}</div>
                <div className="order-items">{orderLabel(o)}</div>
                {o.notes && <div className="order-notes">📝 {o.notes}</div>}
              </div>
            </motion.li>
          )
        })}
      </ul>
      <button className="btn btn--block" onClick={onBack}>Torna alla mia piadina</button>
    </div>
  )
}
