import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { Shell } from '../components/Shell'
import { api, ApiError } from '../lib/api'
import type { Me } from '../lib/api'
import { clearSession, loadSession } from '../lib/session'
import { DoctorPage } from './DoctorPage'

export function DashboardPage() {
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return

    let cancelled = false

    async function load(token: string) {
      try {
        const profile = await api.me(token)
        if (cancelled) return

        if (profile.patient) {
          navigate(`/patients/${profile.patient.id}`, { replace: true })
          return
        }

        setMe(profile)
      } catch (cause) {
        if (cancelled) return

        if (cause instanceof ApiError && cause.status === 401) {
          clearSession()
          navigate('/login', { replace: true })

          return
        }

        setError(cause instanceof ApiError ? cause.message : 'Could not load your account.')
      }
    }

    load(session.token)

    return () => {
      cancelled = true
    }
  }, [session, navigate])

  if (!session) return <Navigate to="/login" replace />

  if (error) {
    return (
      <Page width="narrow" title="Something went wrong">
        <Notice message={error} />
      </Page>
    )
  }

  if (me?.doctor) return <DoctorPage session={session} me={me} />

  return (
    <Shell>
      <p className="text-[0.9375rem] text-ink-soft">Loading your account…</p>
    </Shell>
  )
}
