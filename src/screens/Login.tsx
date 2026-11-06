import { useState } from 'react'
import { loginPlayer } from '../api'
import type { Player } from '../types'

export default function Login({ onLogin }: { onLogin: (p: Player) => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (first.trim().length < 2 || last.trim().length < 2) {
      setErr('Scrivi nome e cognome')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      onLogin(await loginPlayer(first, last))
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
          <input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name"
            autoCapitalize="words" enterKeyHint="next" placeholder="Mario" />
        </label>
        <label>
          Cognome
          <input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name"
            autoCapitalize="words" enterKeyHint="go" placeholder="Rossi" />
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
