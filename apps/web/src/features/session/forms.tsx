'use client'

import { useState, type FormEvent } from 'react'

export function LoginForm() {
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setPending(true)
    setStatus('')
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(fields.get('email')).trim().toLowerCase(), password: fields.get('password') }),
      })
      if (response.ok) {
        window.location.replace('/')
        return
      }
      setStatus(response.status === 429 ? 'Too many attempts. Try again shortly.' : 'Sign-in failed. Check your email and password.')
    } catch {
      setStatus('Could not reach Jobflow. Try again.')
    }
    setPending(false)
  }

  return <form className="mt-6 grid gap-4" method="post" action="/api/auth/sign-in/email" onSubmit={submit}>
    <label>Email <input required name="email" type="email" maxLength={254} autoComplete="username" /></label>
    <label>Password <input required name="password" type="password" maxLength={128} autoComplete="current-password" /></label>
    {status && <p className="message" role="alert">{status}</p>}
    <button className="button" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
  </form>
}

export function LogoutButton() {
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    setStatus('')
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      if (response.ok) {
        window.location.replace('/login')
        return
      }
    } catch { /* Display a generic error. */ }
    setStatus('Sign-out failed. Try again.')
    setPending(false)
  }
  return <div>
    <button className="secondary" onClick={logout} disabled={pending}>Sign out</button>
    {status && <p role="alert" className="mt-2 text-sm text-red-700">{status}</p>}
  </div>
}
