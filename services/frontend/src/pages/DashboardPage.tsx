import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import type { Me } from '../lib/api'
import { clearSession, loadSession } from '../lib/session'

export function DashboardPage() {
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true })
      return
    }

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

  if (!session) return null

  return (
    <Page
      width="narrow"
      title={me ? `Hello, ${me.user.full_name.split(' ')[0]}` : 'Loading'}
      intro={
        me?.role === 'doctor'
          ? 'Open a patient record by its link, or request access to one.'
          : undefined
      }
    >
      {error ? <Notice message={error} /> : null}

      {me?.doctor ? (
        <div className="flex flex-col gap-8">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-8 gap-y-0 border-t border-rule">
            {[
              ['Hospital', me.doctor.hospital?.name ?? '—'],
              ['Qualification', me.doctor.qualification],
              ['Position', me.doctor.position ?? '—'],
              ['Email', me.user.email],
            ].map(([label, value]) => (
              <div
                key={label}
                className="col-span-2 grid grid-cols-subgrid border-b border-rule py-3"
              >
                <dt className="text-[0.875rem] text-ink-soft">{label}</dt>
                <dd className="m-0 text-[0.9375rem] text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-[8px] bg-brass/8 px-5 py-5">
            <p className="text-[0.9375rem] font-600 text-ink">Opening a patient record</p>
            <p className="mt-1.5 max-w-[50ch] text-[0.875rem] leading-relaxed text-ink-soft">
              Patient records live at a shareable link. Without a grant you will see their
              public records only — everything else needs their consent.
            </p>
          </div>

          <Link
            to="/"
            className="text-[0.9375rem] font-500 text-leaf underline underline-offset-4"
          >
            How access works
          </Link>
        </div>
      ) : (
        <p className="text-[0.9375rem] text-ink-soft">Taking you to your record…</p>
      )}
    </Page>
  )
}
