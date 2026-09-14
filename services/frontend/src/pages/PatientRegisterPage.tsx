import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BloodGroupPicker } from '../components/BloodGroupPicker'
import { Button } from '../components/Button'
import { EmergencyCard } from '../components/EmergencyCard'
import { Field } from '../components/Field'
import { Fieldset } from '../components/Fieldset'
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
        <div>
          <div className="card-lift rounded-[2cqw]">
            <EmergencyCard
              name={form.fullName}
              bloodGroup={form.bloodGroup}
              contact={form.emergencyContactEmail}
            />
          </div>
          <p className="mt-6 max-w-[34ch] text-[0.875rem] leading-relaxed text-ink-soft">
            Carry this card. If you are in an accident, whoever finds you scans it —
            and your emergency contact decides which doctor may open your records.
          </p>

          <ul className="m-0 mt-8 flex list-none flex-col gap-0 border-t border-rule p-0">
            {[
              ['Nothing is shared by default', 'Every record starts private to you.'],
              ['One doctor at a time', 'Grants name a person, never a hospital.'],
              ['Access lapses on its own', 'You never have to remember to revoke.'],
            ].map(([title, detail]) => (
              <li key={title} className="border-b border-rule py-4">
                <p className="text-[0.875rem] font-600 text-ink">{title}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{detail}</p>
              </li>
            ))}
          </ul>
        </div>
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
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-12">
        {error ? <Notice message={error} /> : null}

        <Fieldset step={1} title="Your account">
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
        </Fieldset>

        <Fieldset
          step={2}
          title="What a paramedic needs"
          detail="Printed on your card and readable without unlocking anything. All optional."
        >
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
        </Fieldset>

        <Fieldset
          step={3}
          title="Who we reach"
          detail="If you cannot answer, this is the person who decides which doctor may read your file."
        >
          <Field
            label="Emergency contact email"
            type="email"
            value={form.emergencyContactEmail}
            onChange={(event) => update('emergencyContactEmail', event.target.value)}
            autoComplete="email"
          />
        </Fieldset>

        <Button type="submit" pending={pending} pendingLabel="Creating record">
          Create my record
        </Button>
      </form>
    </Page>
  )
}
