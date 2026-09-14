import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BloodGroupPicker } from '../components/BloodGroupPicker'
import { Button } from '../components/Button'
import { EmergencyCard } from '../components/EmergencyCard'
import { Field } from '../components/Field'
import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import type { PatientInput } from '../lib/api'
import { saveSession } from '../lib/session'

function optionalNumber(value: string): number | undefined {
  const parsed = Number(value)
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function PatientRegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    bloodGroup: '',
    heightCm: '',
    weightKg: '',
    emergencyContactEmail: '',
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

    const input: PatientInput = {
      username: form.username.trim(),
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
      blood_group: form.bloodGroup || undefined,
      height_cm: optionalNumber(form.heightCm),
      weight_kg: optionalNumber(form.weightKg),
      emergency_contact_email: form.emergencyContactEmail.trim() || undefined,
    }

    try {
      const result = await api.registerPatient(input)
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
      title="Your health record"
      intro="One account holds every prescription, scan and discharge note — and issues the card below."
      aside={
        <EmergencyCard
          name={form.fullName}
          bloodGroup={form.bloodGroup}
          contact={form.emergencyContactEmail}
        />
      }
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

        <BloodGroupPicker
          value={form.bloodGroup}
          onChange={(value) => update('bloodGroup', value)}
        />

        <div className="grid grid-cols-2 gap-5">
          <Field
            label="Height"
            type="number"
            inputMode="decimal"
            suffix="cm"
            value={form.heightCm}
            onChange={(event) => update('heightCm', event.target.value)}
          />
          <Field
            label="Weight"
            type="number"
            inputMode="decimal"
            suffix="kg"
            value={form.weightKg}
            onChange={(event) => update('weightKg', event.target.value)}
          />
        </div>

        <Field
          label="Emergency contact email"
          type="email"
          value={form.emergencyContactEmail}
          onChange={(event) => update('emergencyContactEmail', event.target.value)}
          hint="The person we reach if you are in an accident. They decide who may read your records."
          autoComplete="email"
        />

        <Button type="submit" pending={pending} pendingLabel="Creating record">
          Create my record
        </Button>
      </form>
    </Page>
  )
}
