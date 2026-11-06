import { useCallback, useEffect, useState } from 'react'
import { DEMO, loginPlayer, fetchCatalog, fetchIngredientImages, fetchCurrentEvent, fetchIngredients, fetchOrders, fetchPlayers, subscribeChanges } from './api'
import { motion } from 'framer-motion'
import { eventPhase } from './format'
import { GlobalDefs } from './piadina/art'
import { ConfirmHost, ask } from './confirm'
import { ImagesContext, type ImageMap } from './piadina/images'
import { supabaseConfigured as configured } from './supabase'
import type { CatalogItem, EventRow, Ingredient, Order, Player } from './types'
import Login from './screens/Login'
import Composer from './screens/Composer'
import OrdersList from './screens/OrdersList'
import Admin, { PIN_KEY } from './screens/Admin'

type Route = 'home' | 'ordini' | 'admin'

function readRoute(): Route {
  const h = window.location.hash.replace('#/', '')
  return h === 'ordini' || h === 'admin' ? h : 'home'
}

const supabaseConfigured = configured || DEMO
const PLAYER_KEY = 'asinella.player'

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [player, setPlayer] = useState<Player | null>(() => {
    try { return JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null') } catch { return null }
  })
  const [event, setEvent] = useState<EventRow | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [images, setImages] = useState<ImageMap>(new Map())
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const reload = useCallback(async () => {
    if (!supabaseConfigured) return
    try {
      const ev = await fetchCurrentEvent()
      const [ings, ords, pls, imgs, cat] = await Promise.all([
        ev ? fetchIngredients(ev.id) : Promise.resolve([]),
        ev ? fetchOrders(ev.id) : Promise.resolve([]),
        fetchPlayers(),
        fetchIngredientImages().catch(() => []),
        fetchCatalog().catch(() => [] as CatalogItem[]),
      ])
      setCatalog(cat)
      setImages(new Map(imgs.map((i) => [i.name_key, i])))
      setEvent(ev)
      setIngredients(ings)
      setOrders(ords)
      setPlayers(pls)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    if (!supabaseConfigured) return
    let t: number | undefined
    const unsub = subscribeChanges(() => {
      window.clearTimeout(t)
      t = window.setTimeout(reload, 250)
    })
    const onVis = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVis)
    return () => { unsub(); document.removeEventListener('visibilitychange', onVis) }
  }, [reload])

  // demo: i dati in memoria si azzerano al reload, ri-registra il giocatore salvato
  useEffect(() => {
    if (DEMO && player) loginPlayer(player.first_name, player.last_name).then((p) => { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); setPlayer(p) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAdminDevice = !!(localStorage.getItem(PIN_KEY) || sessionStorage.getItem(PIN_KEY))
  const go = (r: Route) => { window.location.hash = r === 'home' ? '/' : '/' + r }

  const login = (p: Player) => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(p))
    setPlayer(p)
    reload()
  }
  const logout = () => {
    localStorage.removeItem(PLAYER_KEY)
    setPlayer(null)
  }

  let body
  if (!supabaseConfigured) {
    body = (
      <div className="card center-card">
        <h2>Configurazione mancante</h2>
        <p>Crea il file <code>.env.local</code> con <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (vedi <code>.env.example</code>).</p>
      </div>
    )
  } else if (route === 'admin') {
    body = <Admin event={event} ingredients={ingredients} orders={orders} players={players} images={images} catalog={catalog} reload={reload} me={player} onGoHome={() => go('home')} onLogin={login} />
  } else if (!player) {
    body = <Login onLogin={login} />
  } else if (loading) {
    body = <div className="loader"><div className="spinner" /></div>
  } else if (route === 'ordini') {
    body = <OrdersList event={event} orders={orders} players={players} me={player} onCompose={() => go('home')} />
  } else {
    body = (
      <Composer
        key={(event?.id ?? 'none') + player.id}
        player={player}
        event={event}
        ingredients={ingredients}
        orders={orders}
        onShowOrders={() => go('ordini')}
        reload={reload}
      />
    )
  }

  return (
    <ImagesContext.Provider value={images}>
    <div className="app">
      <GlobalDefs />
      <ConfirmHost />
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="Home">
          <img src="/logo-128.png" alt="" width={40} height={34} />
          <span>Asinella</span>
        </button>
        <nav className="topnav">
          {player && route !== 'admin' && (
            <>
              {isAdminDevice && <button className="navbtn navbtn--admin" onClick={() => go('admin')}>Admin</button>}
              <button className="avatar" onClick={async () => {
                if (await ask({ title: `Esci da ${player.first_name} ${player.last_name}?`, confirm: 'Esci', icon: '👋' })) logout()
              }}
                aria-label="Esci">
                {player.first_name[0]}{player.last_name[0]}
              </button>
            </>
          )}
          {route === 'admin' && <button className="navbtn" onClick={() => go('home')}>{player ? 'La mia piadina' : 'App'}</button>}
        </nav>
      </header>
      {loadError && <div className="toast toast--error">Errore di connessione: {loadError}</div>}
      {player && (route === 'home' || route === 'ordini') && event && eventPhase(event) !== 'concluded' && !loading && (
        <nav className="player-tabs" role="tablist">
          {([['home', 'La mia piadina'], ['ordini', 'Piadine di tutti']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={route === k} className={'player-tab' + (route === k ? ' is-active' : '')} onClick={() => go(k)}>
              <span className="player-tab-label">
                {l}{k === 'ordini' && orders.length > 0 && <span className="player-tab-count">{orders.length}</span>}
              </span>
              {route === k && <motion.span layoutId="player-tab-pill" className="player-tab-pill" />}
            </button>
          ))}
        </nav>
      )}
      <main className="main">{body}</main>
    </div>
    </ImagesContext.Provider>
  )
}
