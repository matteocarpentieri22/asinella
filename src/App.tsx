import { useCallback, useEffect, useState } from 'react'
import { DEMO, loginPlayer, fetchIngredientImages, fetchCurrentEvent, fetchIngredients, fetchOrders, fetchPlayers, subscribeChanges } from './api'
import { GlobalDefs } from './piadina/art'
import { ImagesContext, type ImageMap } from './piadina/images'
import { supabaseConfigured as configured } from './supabase'
import type { EventRow, Ingredient, Order, Player } from './types'
import Login from './screens/Login'
import Composer from './screens/Composer'
import OrdersList from './screens/OrdersList'
import Admin from './screens/Admin'

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
      const [ings, ords, pls, imgs] = await Promise.all([
        ev ? fetchIngredients(ev.id) : Promise.resolve([]),
        ev ? fetchOrders(ev.id) : Promise.resolve([]),
        fetchPlayers(),
        fetchIngredientImages().catch(() => []),
      ])
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
    body = <Admin event={event} ingredients={ingredients} orders={orders} players={players} images={images} reload={reload} />
  } else if (!player) {
    body = <Login onLogin={login} />
  } else if (loading) {
    body = <div className="loader"><div className="spinner" /></div>
  } else if (route === 'ordini') {
    body = <OrdersList event={event} orders={orders} players={players} me={player} onBack={() => go('home')} />
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
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="Home">
          <img src="/logo-128.png" alt="" width={40} height={34} />
          <span>Asinella</span>
        </button>
        <nav className="topnav">
          {player && route !== 'admin' && (
            <>
              <button className={'navbtn' + (route === 'ordini' ? ' is-active' : '')} onClick={() => go(route === 'ordini' ? 'home' : 'ordini')}>
                {route === 'ordini' ? 'La mia' : `Ordini${orders.length ? ` · ${orders.length}` : ''}`}
              </button>
              <button className="avatar" onClick={() => { if (confirm(`Esci da ${player.first_name} ${player.last_name}?`)) logout() }}
                aria-label="Esci">
                {player.first_name[0]}{player.last_name[0]}
              </button>
            </>
          )}
          {route === 'admin' && <button className="navbtn" onClick={() => go('home')}>Esci da admin</button>}
        </nav>
      </header>
      {loadError && <div className="toast toast--error">Errore di connessione: {loadError}</div>}
      <main className="main">{body}</main>
    </div>
    </ImagesContext.Provider>
  )
}
