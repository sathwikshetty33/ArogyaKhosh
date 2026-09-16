import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import type { ApprovalView } from '../lib/api'

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function verdict(view: ApprovalView): string {
  if (view.model_verdict === undefined) return 'No photo was sent with this report.'
  if (view.model_verdict) return 'The photo appears to show a damaged vehicle.'

  return 'The photo does not clearly show an accident.'
}

// The emergency contact arrives here from a mail link with no account. The key
// in the URL buys sight of this one report and nothing else.
export function ApprovalPage() {
  const { id, key } = useParams<{ id: string; key: string }>()

  const [view, setView] = useState<ApprovalView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !key) return

    let cancelled = false

    api
      .approval(id, key)
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
  }, [id, key])

  async function decide(decision: 'confirm' | 'dismiss' | 'resolve') {
    if (!id || !key) return

    setBusy(true)
    setError(null)

    try {
      setView(await api.decideApproval(id, key, decision))
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
      <Page bare width="narrow" title="Opening the report…">
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
        intro={error ?? 'It may have expired, or the report may already be closed.'}
      >
        <p className="text-[0.875rem] leading-relaxed text-ink-soft">
          Links from an accident alert stop working after 24 hours. If you think
          something is wrong, call the person directly.
        </p>
      </Page>
    )
  }

  const decided = view.status === 'confirmed' || view.status === 'dismissed' || view.status === 'resolved'

  return (
    <Page
      bare
      width="narrow"
      title={`Someone reported an accident involving ${view.patient_first_name}`}
      intro={`Reported ${when(view.reported_at)}. You are listed as their emergency contact.`}
    >
      <div className="flex flex-col gap-6">
        {error ? <Notice message={error} /> : null}

        {view.photo_url ? (
          <img
            src={view.photo_url}
            alt="The scene that was reported"
            className="max-h-80 w-full rounded-[10px] border border-rule object-cover"
          />
        ) : null}

        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{verdict(view)}</p>

        {view.latitude !== undefined && view.longitude !== undefined ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${view.latitude}&mlon=${view.longitude}#map=17/${view.latitude}/${view.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="text-[0.875rem] font-600 text-leaf underline underline-offset-4"
          >
            See where this was reported
          </a>
        ) : null}

        {view.status === 'confirmed' ? (
          <div className="rounded-[8px] bg-leaf/6 px-5 py-5">
            <p className="text-[0.9375rem] font-600 text-ink">You confirmed this report</p>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
              Until {view.window_expires_at ? when(view.window_expires_at) : 'it closes'},
              any doctor asking for {view.patient_first_name}'s records will be
              sent to you to approve. Nothing has been shared yet.
            </p>
          </div>
        ) : null}

        {view.status === 'dismissed' ? (
          <div className="rounded-[8px] bg-ink/5 px-5 py-5">
            <p className="text-[0.9375rem] font-600 text-ink">You marked this a false alarm</p>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
              Any access this report opened has been withdrawn.
            </p>
          </div>
        ) : null}

        {view.status === 'resolved' ? (
          <div className="rounded-[8px] bg-ink/5 px-5 py-5">
            <p className="text-[0.9375rem] font-600 text-ink">This report is closed</p>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
              Doctors already treating {view.patient_first_name} keep what they
              were given; nobody new will be sent to you.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-rule pt-6">
          {view.status !== 'confirmed' ? (
            <button
              type="button"
              onClick={() => decide('confirm')}
              disabled={busy}
              className="w-full cursor-pointer rounded-[3px] border-0 bg-leaf px-5 py-3.5 text-[0.9375rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
            >
              {decided ? 'Reopen this report' : 'Yes, this is real'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => decide('resolve')}
              disabled={busy}
              className="w-full cursor-pointer rounded-[3px] border border-rule bg-white px-5 py-3.5 text-[0.9375rem] font-600 text-ink transition-colors hover:border-leaf hover:text-leaf disabled:cursor-progress"
            >
              They are out of danger — close this
            </button>
          )}

          {view.status !== 'dismissed' ? (
            <button
              type="button"
              onClick={() => decide('dismiss')}
              disabled={busy}
              className="w-full cursor-pointer rounded-[3px] border border-rule bg-white px-5 py-3.5 text-[0.9375rem] font-600 text-ink-soft transition-colors hover:border-alert hover:text-alert disabled:cursor-progress"
            >
              This is a false alarm
            </button>
          ) : null}
        </div>

        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
          Confirming does not hand over any records. It only lets you answer on{' '}
          {view.patient_first_name}'s behalf while they cannot.
        </p>
      </div>
    </Page>
  )
}
