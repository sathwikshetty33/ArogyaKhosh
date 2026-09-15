import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { DoctorCard } from '../components/DoctorCard'
import { DoctorProfileEditor } from '../components/DoctorProfileEditor'
import { Notice } from '../components/Notice'
import { Panel } from '../components/Panel'
import { Shell } from '../components/Shell'
import { api, ApiError } from '../lib/api'
import type {
  AccessRequest,
  DoctorUpdate,
  Hospital,
  Me,
  PatientSearchResult,
} from '../lib/api'
import type { Session } from '../lib/session'

function expiry(request: AccessRequest): string {
  if (!request.expires_at) return 'No expiry'

  const ms = new Date(request.expires_at).getTime() - Date.now()
  if (ms <= 0) return 'Expired'

  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min left`
  if (hours < 48) return `${hours} h left`

  return `${Math.round(hours / 24)} days left`
}

function Chip({ request }: { request: AccessRequest }) {
  const tone = request.active
    ? 'bg-leaf/10 text-leaf'
    : request.status === 'pending'
      ? 'bg-brass/15 text-brass'
      : 'bg-ink/8 text-ink-soft'

  const label = request.active
    ? expiry(request)
    : request.status === 'granted'
      ? 'Expired'
      : request.status

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-[0.75rem] font-600 ${
        request.active ? '' : 'capitalize'
      } ${tone}`}
    >
      {request.active ? (
        <span className="size-1.5 rounded-full bg-leaf" />
      ) : null}
      {label}
    </span>
  )
}

export function DoctorPage({ session, me }: { session: Session; me: Me }) {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PatientSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [asking, setAsking] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const doctorId = me.doctor?.id

  useEffect(() => {
    if (!doctorId) return

    let cancelled = false

    async function load(token: string, id: string) {
      try {
        const [mine, list] = await Promise.all([
          api.doctorRequests(token, id),
          api.hospitals(token),
        ])

        if (cancelled) return

        setRequests(mine.requests)
        setHospitals(list.hospitals)
      } catch (cause) {
        if (cancelled) return

        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Could not load your requests.',
        )
      }
    }

    load(session.token, doctorId)

    return () => {
      cancelled = true
    }
  }, [session, doctorId, refresh])

  async function search(event: FormEvent) {
    event.preventDefault()

    setSearching(true)
    setError('')

    try {
      const found = await api.searchPatients(session.token, term.trim())
      setResults(found.results)
    } catch (cause) {
      setResults(null)
      setError(cause instanceof ApiError ? cause.message : 'Could not search.')
    } finally {
      setSearching(false)
    }
  }

  async function requestAccess(patientId: string) {
    setAsking(patientId)
    setError('')

    try {
      await api.requestAccess(session.token, patientId)
      setResults(null)
      setTerm('')
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Could not send the request.',
      )
    } finally {
      setAsking(null)
    }
  }

  async function saveProfile(update: DoctorUpdate) {
    if (!doctorId) return

    setSaving(true)
    setError('')

    try {
      await api.updateDoctor(session.token, doctorId, update)
      setEditing(false)
      window.location.reload()
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Could not save your profile.',
      )
      setSaving(false)
    }
  }

  const open = requests.filter((r) => r.active)
  const pending = requests.filter((r) => r.status === 'pending')
  const past = requests.filter((r) => !r.active && r.status !== 'pending')

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.875rem] leading-tight font-700 text-ink sm:text-[2.25rem]">
            Hello, {me.user.full_name}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            {open.length > 0
              ? `${open.length} patient ${open.length === 1 ? 'record' : 'records'} open to you right now.`
              : 'No patient has granted you access yet.'}
          </p>
        </div>

        <span className="inline-flex items-center gap-2 pb-1 text-[0.875rem] text-ink-soft">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-leaf" />
          {me.doctor?.hospital?.name ?? 'Your hospital'}
        </span>
      </div>

      {error ? (
        <div className="mb-6">
          <Notice message={error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <Panel title="Find a patient">
            <form onSubmit={search} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Patient username or email"
                aria-label="Patient username or email"
                className="min-w-0 flex-1 rounded-[6px] border border-rule bg-white px-3 py-2 text-[0.9375rem] text-ink outline-none focus:border-leaf"
              />
              <button
                type="submit"
                disabled={searching || term.trim().length < 3}
                className="cursor-pointer rounded-[6px] border-0 bg-leaf px-4 py-2 text-[0.875rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-not-allowed disabled:bg-ink-faint"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>

            <p className="mt-2 text-[0.8125rem] text-ink-faint">
              Patients are found by their exact username or email, never by
              browsing. Ask the patient for theirs.
            </p>

            {results !== null ? (
              results.length === 0 ? (
                <p className="mt-4 rounded-[6px] bg-paper/60 px-4 py-3 text-[0.875rem] text-ink-soft">
                  No patient matches that. Check the spelling with them.
                </p>
              ) : (
                <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                  {results.map((result) => (
                    <li
                      key={result.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-rule bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[0.9375rem] font-600 text-ink">
                          {result.full_name}
                        </p>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-faint">
                          @{result.username}
                        </p>
                      </div>

                      {result.active ? (
                        <Link
                          to={`/patients/${result.id}`}
                          className="rounded-[5px] bg-leaf px-3 py-1.5 text-[0.8125rem] font-600 text-paper no-underline"
                        >
                          Open record
                        </Link>
                      ) : result.request_status === 'pending' ? (
                        <span className="rounded-full bg-brass/15 px-2.5 py-1 text-[0.75rem] font-600 text-brass">
                          Awaiting their decision
                        </span>
                      ) : (
                        <button
                          disabled={asking === result.id}
                          onClick={() => requestAccess(result.id)}
                          className="cursor-pointer rounded-[5px] border border-leaf bg-transparent px-3 py-1.5 text-[0.8125rem] font-600 text-leaf transition-colors hover:bg-leaf/8 disabled:cursor-progress"
                        >
                          {asking === result.id ? 'Sending…' : 'Request access'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </Panel>

          <Panel
            title="Records you can open"
            meta={open.length ? `${open.length} active` : undefined}
            tight
          >
            {open.length === 0 ? (
              <p className="px-5 py-8 text-center text-[0.9375rem] text-ink-soft">
                No patient has granted you access yet.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {open.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-500 text-ink">
                        {request.patient_name}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-faint">
                        Granted by {request.granted_by_email ?? 'the patient'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Chip request={request} />
                      <Link
                        to={`/patients/${request.patient_id}`}
                        className="text-[0.8125rem] font-600 text-leaf no-underline underline-offset-4 hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Your requests"
            meta={pending.length ? `${pending.length} waiting` : undefined}
            tight
          >
            {pending.length + past.length === 0 ? (
              <p className="px-5 py-8 text-center text-[0.9375rem] text-ink-soft">
                {requests.length === 0
                  ? 'You have not asked for any records yet.'
                  : 'Nothing waiting — every request you have made is active above.'}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {[...pending, ...past].map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] text-ink">
                        {request.patient_name}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-faint">
                        Asked{' '}
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Chip request={request} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          {me.doctor ? (
            <div>
              <div className="card-lift rounded-[2cqw]">
                <DoctorCard
                  name={me.user.full_name}
                  hospital={me.doctor.hospital?.name ?? 'Unlinked hospital'}
                  qualification={me.doctor.qualification}
                  position={me.doctor.position}
                  serial={`AK · ${me.doctor.id.slice(0, 4)} ${me.doctor.id.slice(-4)}`}
                />
              </div>
              <p className="mt-3.5 text-[0.8125rem] leading-relaxed text-ink-soft">
                Patients see this when deciding whether to let you open their
                records.
              </p>
            </div>
          ) : null}

          <Panel
            title="Your profile"
            action={
              editing || !me.doctor ? null : (
                <button
                  onClick={() => setEditing(true)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-500 text-leaf underline-offset-4 hover:underline"
                >
                  Edit
                </button>
              )
            }
          >
            {editing && me.doctor ? (
              <DoctorProfileEditor
                doctor={me.doctor}
                hospitals={hospitals}
                pending={saving}
                onSave={saveProfile}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
                {[
                  ['Hospital', me.doctor?.hospital?.name ?? '—'],
                  ['Qualification', me.doctor?.qualification ?? '—'],
                  ['Position', me.doctor?.position ?? 'Not set'],
                  ['Username', me.user.username],
                  ['Email', me.user.email],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="col-span-2 grid grid-cols-subgrid"
                  >
                    <dt className="text-[0.8125rem] text-ink-soft">{label}</dt>
                    <dd className="m-0 truncate text-[0.8125rem] text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>
        </div>
      </div>
    </Shell>
  )
}
