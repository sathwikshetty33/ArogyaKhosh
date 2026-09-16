import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '../components/Button'
import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { api, ApiError } from '../lib/api'
import type { AccidentReport } from '../lib/api'

type Stage = 'idle' | 'sending' | 'sent'

// The person reading this is a stranger at a roadside on somebody else's
// phone. No account, no choices that need explaining, one button.
export function ReportAccidentPage() {
  const { id } = useParams<{ id: string }>()
  const fileInput = useRef<HTMLInputElement>(null)

  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AccidentReport | null>(null)

  function choose(file: File | null) {
    setPhoto(file)
    setPreview(file ? URL.createObjectURL(file) : null)
    setError(null)
  }

  // Location is offered, never required. A refused prompt must not stop the
  // alert, so the request goes out either way.
  function locate(): Promise<GeolocationCoordinates | null> {
    if (!navigator.geolocation) return Promise.resolve(null)

    return new Promise((resolve) => {
      const done = (value: GeolocationCoordinates | null) => resolve(value)
      const timer = setTimeout(() => done(null), 4000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timer)
          done(position.coords)
        },
        () => {
          clearTimeout(timer)
          done(null)
        },
        { timeout: 4000, maximumAge: 60_000 },
      )
    })
  }

  async function send() {
    if (!id) return

    setStage('sending')
    setError(null)

    try {
      setResult(await api.reportAccident(id, photo, await locate()))
      setStage('sent')
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Could not send the alert.',
      )
      setStage('idle')
    }
  }

  if (stage === 'sent' && result) {
    return (
      <Page
        bare
        width="narrow"
        title={
          result.contact_notified
            ? `${result.patient_first_name}'s contact has been told`
            : 'Report sent'
        }
        intro={
          result.contact_notified
            ? 'Someone who knows them is being alerted right now. You can stay with them until help arrives.'
            : 'We saved the report, but we could not reach anyone listed for them. Call your local emergency number.'
        }
      >
        <div className="rounded-[8px] bg-leaf/6 px-5 py-5">
          <p className="text-[0.9375rem] font-600 text-ink">
            If anyone is hurt, call emergency services first
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
            This alert reaches a family member, not an ambulance. It does not
            replace a call for help.
          </p>
        </div>
      </Page>
    )
  }

  return (
    <Page
      bare
      width="narrow"
      title="Report an accident"
      intro="You scanned someone's emergency card. Send a photo of what you can see and we will alert the person they listed."
    >
      <div className="flex flex-col gap-6">
        {error ? <Notice message={error} /> : null}

        <div className="rounded-[8px] border-l-2 border-alert bg-alert/5 py-3 pr-4 pl-4">
          <p className="text-[0.875rem] leading-relaxed text-ink">
            <strong className="font-600">Call emergency services first.</strong>{' '}
            This alerts a family member, not an ambulance.
          </p>
        </div>

        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
            className="hidden"
          />

          {preview ? (
            <div className="overflow-hidden rounded-[10px] border border-rule">
              <img src={preview} alt="What you photographed" className="w-full object-cover" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full cursor-pointer border-0 border-t border-rule bg-white py-3 text-[0.8125rem] font-600 text-leaf"
              >
                Take a different photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-[10px] border-2 border-dashed border-rule bg-paper/40 px-6 py-10 transition-colors hover:border-leaf hover:bg-leaf/4"
            >
              <span className="font-display text-[1rem] font-600 text-ink">
                Take a photo of the scene
              </span>
              <span className="max-w-[34ch] text-center text-[0.8125rem] leading-relaxed text-ink-soft">
                It helps whoever gets the alert understand what happened.
              </span>
            </button>
          )}
        </div>

        <Button onClick={send} pending={stage === 'sending'} pendingLabel="Sending">
          {photo ? 'Send the alert' : 'Send without a photo'}
        </Button>

        <p className="text-center text-[0.8125rem] leading-relaxed text-ink-soft">
          Sending shares your rough location if your phone allows it. It never
          shows you their medical records.
        </p>
      </div>
    </Page>
  )
}
