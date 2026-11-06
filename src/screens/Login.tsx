import { useState } from 'react'
import { loginPlayer } from '../api'
import type { Player } from '../types'

export default function Login({ onLogin }: { onLogin: (p: Player) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setErr('Scrivi il tuo nome')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      onLogin(await loginPlayer(name, ''))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <img className="login-logo" src="/logo-256.png" alt="Asinella" width={170} height={140} />
      <h1>Ordine piadine</h1>
      <form className="card form" onSubmit={submit}>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name"
            autoCapitalize="words" enterKeyHint="go" placeholder="Mario" />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Un attimo…' : 'Entra'}
        </button>
      </form>
      <a className="linkbtn small" href="#/admin">Area admin</a>
    </div>
  )
}
