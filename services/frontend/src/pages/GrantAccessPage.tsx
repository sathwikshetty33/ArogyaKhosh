import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import type { GrantLinkView } from '../lib/api'

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Reached from a mail link when a doctor asks for records during an accident
// the contact has already confirmed. It shows who is asking and nothing of
// what they are asking for.
export function GrantAccessPage() {
  const { token } = useParams<{ token: string }>()

  const [view, setView] = useState<GrantLinkView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    api
      .grantLink(token)
      .then((result) => {
        if (!cancelled) setView(result)
      })
      .catch((cause) => {
        if (cancelled) return

        setError(
          cause instanceof ApiError ? cause.message : 'Could not open this link.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function decide(decision: 'grant' | 'deny') {
    if (!token) return

    setBusy(true)
    setError(null)

    try {
      setView(await api.decideGrant(token, decision))
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Could not record that.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Page bare width="narrow" title="Opening the request…">
        <p className="text-[0.9375rem] text-ink-soft">One moment.</p>
      </Page>
    )
  }

  if (!view) {
    return (
      <Page
        bare
        width="narrow"
        title="This link does not work"
        intro={error ?? 'The accident report it belongs to may already be closed.'}
      >
        <p className="text-[0.875rem] leading-relaxed text-ink-soft">
          Once an accident report is closed, every request link from it stops
          working. The patient can answer the doctor themselves.
        </p>
      </Page>
    )
  }

  const answered = view.status !== 'pending'

  return (
    <Page
      bare
      width="narrow"
      title={`${view.doctor_name} wants to read ${view.patient_first_name}'s records`}
      intro={`Asked ${when(view.requested_at)}. You confirmed their accident, so this is your call for now.`}
    >
      <div className="flex flex-col gap-6">
        {error ? <Notice message={error} /> : null}

        <div className="rounded-[8px] border border-rule bg-paper/50 p-5">
          <p className="text-[1rem] font-600 text-ink">{view.doctor_name}</p>
          <p className="mt-1 text-[0.875rem] text-ink-soft">
            {view.qualification}
            {view.position ? ` · ${view.position}` : ''}
          </p>
          <p className="mt-0.5 text-[0.875rem] text-ink-soft">{view.hospital}</p>
        </div>

        {answered ? (
          <div
            className={`rounded-[8px] px-5 py-5 ${
              view.status === 'granted' ? 'bg-leaf/6' : 'bg-ink/5'
            }`}
          >
            <p className="text-[0.9375rem] font-600 text-ink">
              {view.status === 'granted'
                ? 'You let this doctor in'
                : `This request was ${view.status}`}
            </p>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
              {view.status === 'granted'
                ? `Their access ends ${view.access_until ? when(view.access_until) : 'when the report closes'}. ${view.patient_first_name} can withdraw it sooner.`
                : 'Nothing was shared. This link cannot be used again.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => decide('grant')}
                disabled={busy}
                className="w-full cursor-pointer rounded-[3px] border-0 bg-leaf px-5 py-3.5 text-[0.9375rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
              >
                Let them see the records
              </button>

              <button
                type="button"
                onClick={() => decide('deny')}
                disabled={busy}
                className="w-full cursor-pointer rounded-[3px] border border-rule bg-white px-5 py-3.5 text-[0.9375rem] font-600 text-ink-soft transition-colors hover:border-alert hover:text-alert disabled:cursor-progress"
              >
                No
              </button>
            </div>

            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
              Access you give here ends{' '}
              {view.access_until ? when(view.access_until) : 'when the report closes'},
              on its own. {view.patient_first_name} can take it back at any time.
            </p>
          </>
        )}
      </div>
    </Page>
  )
}
