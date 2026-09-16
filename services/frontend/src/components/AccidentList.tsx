import { useState } from 'react'

import type { PatientAccident, RequestStatus } from '../lib/api'

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const LABEL: Record<PatientAccident['status'], string> = {
  reported: 'Reported',
  notified: 'Contact told',
  confirmed: 'Open',
  dismissed: 'False alarm',
  resolved: 'Closed',
}

const GRANT_LABEL: Record<RequestStatus, string> = {
  pending: 'Waiting on a decision',
  granted: 'Has access',
  declined: 'Turned down',
  revoked: 'Withdrawn',
}

function verdict(accident: PatientAccident): string {
  if (accident.model_verdict === null) return 'Photo not checked'
  if (accident.model_verdict) return 'Photo looked like a crash'

  return 'Photo did not look like a crash'
}

interface AccidentListProps {
  accidents: PatientAccident[]
  onClose: (id: string) => Promise<void>
  busyId: string | null
}

export function AccidentList({ accidents, onClose, busyId }: AccidentListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (accidents.length === 0) {
    return (
      <div className="rounded-[8px] bg-leaf/6 px-5 py-6">
        <p className="text-[0.9375rem] font-500 text-ink">No accident reports</p>
        <p className="mt-1.5 max-w-[48ch] text-[0.875rem] leading-relaxed text-ink-soft">
          If someone scans your card at the roadside, the report shows up here —
          who was told, and every doctor who was let in because of it.
        </p>
      </div>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {accidents.map((accident) => {
        const open = accident.open
        const showing = expanded === accident.id

        return (
          <li
            key={accident.id}
            className={`rounded-[8px] border p-4 ${
              open ? 'border-brass/35 bg-brass/6' : 'border-rule bg-paper/50'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-600 text-ink">
                  Reported {when(accident.reported_at)}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
                  {accident.notified_email
                    ? `${accident.notified_email} was told`
                    : 'Nobody could be told'}
                  {' · '}
                  {verdict(accident)}
                </p>
              </div>

              <span
                className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1 pr-2.5 pl-2 text-[0.75rem] font-600 ${
                  open ? 'bg-brass/15 text-brass-deep' : 'bg-ink/6 text-ink-soft'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${open ? 'bg-brass-deep' : 'bg-ink-faint'}`}
                />
                {open ? 'Open' : LABEL[accident.status]}
              </span>
            </div>

            {open ? (
              <p className="mt-2.5 max-w-[52ch] text-[0.8125rem] leading-relaxed text-ink-soft">
                While this is open, a doctor asking for your records is asked of{' '}
                {accident.notified_email ?? 'your emergency contact'} instead of you.
              </p>
            ) : null}

            {accident.grants.length > 0 ? (
              <div className="mt-3 border-t border-rule pt-3">
                <p className="text-[0.75rem] font-600 tracking-wide text-ink-faint uppercase">
                  Let in by this report
                </p>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                  {accident.grants.map((grant) => (
                    <li
                      key={grant.request_id}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.8125rem]"
                    >
                      <span className="text-ink">
                        {grant.doctor_name}
                        <span className="text-ink-faint"> · {grant.hospital}</span>
                      </span>
                      <span className="text-ink-soft">{GRANT_LABEL[grant.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule pt-3">
              {open ? (
                <button
                  type="button"
                  onClick={() => onClose(accident.id)}
                  disabled={busyId === accident.id}
                  className="cursor-pointer rounded-[3px] border-0 bg-leaf px-3.5 py-2 text-[0.8125rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
                >
                  {busyId === accident.id ? 'Closing…' : 'Stop asking my contact'}
                </button>
              ) : null}

              {accident.photo_url ? (
                <button
                  type="button"
                  onClick={() => setExpanded(showing ? null : accident.id)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-600 text-leaf underline underline-offset-3"
                >
                  {showing ? 'Hide photo' : 'See the photo'}
                </button>
              ) : null}
            </div>

            {showing && accident.photo_url ? (
              <img
                src={accident.photo_url}
                alt="Reported scene"
                className="mt-3 max-h-64 w-full rounded-[6px] object-cover"
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
