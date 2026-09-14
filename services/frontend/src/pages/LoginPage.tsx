import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { EmergencyCard } from '../components/EmergencyCard'
import { Field } from '../components/Field'
import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import { saveSession } from '../lib/session'

export function LoginPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)

    try {
      const result = await api.login({ identifier: identifier.trim(), password })
      saveSession(result)
      navigate('/dashboard')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Page
      title="Sign in"
      width="narrow"
      intro="Your records follow you, whichever hospital treats you next."
      aside={
        <div>
          <div className="card-lift rounded-[2cqw]">
            <EmergencyCard
              name="Sathwik Shetty"
              bloodGroup="O+"
              contact="amma@example.com"
              serial="AK · 4471 0982"
            />
          </div>
          <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-soft">
            Signed in or not, your emergency card keeps working. It is the one way in
            that never asks anybody for a password.
          </p>
        </div>
      }
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="font-500 text-leaf underline underline-offset-4">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {error ? <Notice message={error} /> : null}

        <Field
          label="Username or email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoFocus
          required
        />

        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        <Button type="submit" pending={pending} pendingLabel="Signing in">
          Sign in
        </Button>
      </form>
    </Page>
  )
}
