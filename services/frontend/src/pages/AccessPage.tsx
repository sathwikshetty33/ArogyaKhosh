import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import type { AccessRequest } from '../lib/api'
import { clearSession, loadSession } from '../lib/session'

const GRANT_OPTIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '48 hours' },
  { hours: 24 * 7, label: '7 days' },
]

function expiryLabel(request: AccessRequest): string {
  if (!request.expires_at) return 'No expiry'

  const ms = new Date(request.expires_at).getTime() - Date.now()
  if (ms <= 0) return 'Expired'

  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min left`
  if (hours < 48) return `${hours} h left`

  return `${Math.round(hours / 24)} days left`
}

function StatusChip({ request }: { request: AccessRequest }) {
  const tone = request.active
    ? 'bg-leaf/10 text-leaf'
    : request.status === 'pending'
      ? 'bg-brass/15 text-brass'
      : 'bg-ink/8 text-ink-soft'

  const label = request.active
    ? expiryLabel(request)
    : request.status === 'granted'
      ? 'Expired'
      : request.status

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1 pr-2.5 pl-2 text-[0.75rem] font-600 capitalize ${tone}`}
    >
      {request.active ? <span className="size-1.5 rounded-full bg-leaf" /> : null}
      {label}
    </span>
  )
}

export function AccessPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [hours, setHours] = useState(48)

  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!session || !id) return

    let cancelled = false

    async function load(token: string, patientId: string) {
      try {
        const result = await api.listRequests(token, patientId)
        if (cancelled) return

        setRequests(result.requests)
        setError('')
      } catch (cause) {
        if (cancelled) return

        if (cause instanceof ApiError && cause.status === 401) {
          clearSession()
          navigate('/login', { replace: true })

          return
        }

        setError(cause instanceof ApiError ? cause.message : 'Could not load access requests.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load(session.token, id)

    return () => {
      cancelled = true
    }
  }, [session, id, refresh, navigate])

  if (!session) return <Navigate to="/login" replace />
  if (!id) return <Navigate to="/dashboard" replace />

  async function act(request: AccessRequest, action: 'approve' | 'decline' | 'revoke') {
    if (!session || !id) return

    setBusy(request.id)
    setError('')

    try {
      if (action === 'approve') await api.approveRequest(session.token, request.id, hours)
      if (action === 'decline') await api.declineRequest(session.token, request.id)
      if (action === 'revoke') await api.revokeRequest(session.token, request.id)

      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'That did not work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const active = requests.filter((r) => r.active)
  const past = requests.filter((r) => r.status !== 'pending' && !r.active)

  return (
    <Page
      title="Who can see your records"
      intro="Approve a request and it lasts only as long as you choose. Revoking takes effect on the doctor's next click."
      footer={
        <Link
          to={`/patients/${id}`}
          className="font-500 text-leaf underline underline-offset-4"
        >
          Back to your record
        </Link>
      }
    >
      {error ? <Notice message={error} /> : null}

      {loading ? (
        <p className="text-[0.9375rem] text-ink-soft">Loading requests…</p>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-[1.0625rem] font-600 text-ink">
                Waiting for you
              </h2>
              {pending.length > 0 ? (
                <label className="flex items-center gap-2 text-[0.8125rem] text-ink-soft">
                  Approve for
                  <select
                    value={hours}
                    onChange={(event) => setHours(Number(event.target.value))}
                    className="cursor-pointer rounded-[5px] border border-rule bg-white px-2 py-1 text-[0.8125rem] text-ink"
                  >
                    {GRANT_OPTIONS.map((option) => (
                      <option key={option.hours} value={option.hours}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="mt-4">
              {pending.length === 0 ? (
                <p className="rounded-[8px] bg-paper/60 px-5 py-6 text-[0.9375rem] text-ink-soft">
                  No one is waiting on you.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {pending.map((request) => (
                    <li
                      key={request.id}
                      className="rounded-[8px] border border-brass/30 bg-brass/5 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[0.9375rem] font-600 text-ink">
                            {request.doctor_name}
                          </p>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
                            {request.hospital} · {request.qualification}
                          </p>
                        </div>
                        <StatusChip request={request} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          disabled={busy === request.id}
                          onClick={() => act(request, 'approve')}
                          className="cursor-pointer rounded-[4px] border-0 bg-leaf px-4 py-2 text-[0.875rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
                        >
                          Approve for {GRANT_OPTIONS.find((o) => o.hours === hours)?.label}
                        </button>
                        <button
                          disabled={busy === request.id}
                          onClick={() => act(request, 'decline')}
                          className="cursor-pointer rounded-[4px] border border-rule bg-transparent px-4 py-2 text-[0.875rem] font-600 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:cursor-progress"
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-display text-[1.0625rem] font-600 text-ink">
              Currently allowed
            </h2>

            <div className="mt-4">
              {active.length === 0 ? (
                <p className="rounded-[8px] bg-leaf/6 px-5 py-6 text-[0.9375rem] text-ink-soft">
                  Nobody can open your records right now.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {active.map((request) => (
                    <li key={request.id} className="rounded-[8px] border border-rule bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[0.9375rem] font-600 text-ink">
                            {request.doctor_name}
                          </p>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
                            {request.hospital} · {request.qualification}
                          </p>
                          {request.granted_by_email ? (
                            <p className="mt-1.5 text-[0.8125rem] text-ink-faint">
                              Approved by {request.granted_by_email}
                            </p>
                          ) : null}
                        </div>
                        <StatusChip request={request} />
                      </div>

                      <button
                        disabled={busy === request.id}
                        onClick={() => act(request, 'revoke')}
                        className="mt-4 cursor-pointer rounded-[4px] border border-alert/30 bg-transparent px-4 py-2 text-[0.875rem] font-600 text-alert transition-colors hover:border-alert hover:bg-alert/5 disabled:cursor-progress"
                      >
                        {busy === request.id ? 'Revoking…' : 'Revoke now'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {past.length > 0 ? (
            <section>
              <h2 className="font-display text-[1.0625rem] font-600 text-ink">History</h2>

              <ul className="m-0 mt-4 flex list-none flex-col border-t border-rule p-0">
                {past.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] text-ink">{request.doctor_name}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-faint">
                        {request.hospital}
                      </p>
                    </div>
                    <StatusChip request={request} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Page>
  )
}
