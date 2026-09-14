import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import { saveSession } from '../lib/session'

export function DoctorRegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    hospitalId: '',
    qualification: '',
    position: '',
  })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const passwordTooShort = form.password.length > 0 && form.password.length < 8

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)

    try {
      const result = await api.registerDoctor({
        username: form.username.trim(),
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        hospital_id: Number(form.hospitalId),
        qualification: form.qualification.trim(),
        position: form.position.trim() || undefined,
      })

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
      title="Register as a doctor"
      intro="Your hospital vouches for you. Patients grant access to their records one request at a time."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-500 text-leaf underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7">
        {error ? <Notice message={error} /> : null}

        <Field
          label="Full name"
          value={form.fullName}
          onChange={(event) => update('fullName', event.target.value)}
          autoComplete="name"
          autoFocus
          required
        />

        <Field
          label="Username"
          value={form.username}
          onChange={(event) => update('username', event.target.value)}
          hint="Letters and numbers only."
          autoComplete="username"
          required
        />

        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          autoComplete="email"
          required
        />

        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          hint="At least 8 characters."
          error={passwordTooShort ? 'Use at least 8 characters.' : undefined}
          autoComplete="new-password"
          required
        />

        <Field
          label="Hospital ID"
          type="number"
          inputMode="numeric"
          value={form.hospitalId}
          onChange={(event) => update('hospitalId', event.target.value)}
          hint="Ask your hospital administrator for this number."
          required
        />

        <Field
          label="Qualification"
          value={form.qualification}
          onChange={(event) => update('qualification', event.target.value)}
          placeholder="MBBS, MD"
          required
        />

        <Field
          label="Position"
          value={form.position}
          onChange={(event) => update('position', event.target.value)}
          placeholder="Consultant"
          hint="Optional."
        />

        <Button type="submit" pending={pending} pendingLabel="Registering">
          Register
        </Button>
      </form>
    </Page>
  )
}
