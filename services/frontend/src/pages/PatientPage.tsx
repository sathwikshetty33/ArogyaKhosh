import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { AccessList } from '../components/AccessList'
import { DocumentList } from '../components/DocumentList'
import { DocumentUpload } from '../components/DocumentUpload'
import { ContactEditor } from '../components/ContactEditor'
import { EmergencyCard } from '../components/EmergencyCard'
import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { Panel } from '../components/Panel'
import { Shell } from '../components/Shell'
import { Vitals } from '../components/Vitals'
import { VitalsEditor } from '../components/VitalsEditor'
import { api, ApiError } from '../lib/api'
import type { PatientDocument, PatientRecord, PatientUpdate } from '../lib/api'
import { clearSession, loadSession } from '../lib/session'

const INTRO: Record<string, string> = {
  owner: 'Your records are private until you approve a request.',
  granted:
    'You have been granted access to this record. It expires on its own.',
  public:
    'You can see this patient’s public records. Anything else needs their consent.',
}

export function PatientPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const [record, setRecord] = useState<PatientRecord | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingVitals, setEditingVitals] = useState(false)
  const [editingContact, setEditingContact] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (!session || !id) return

    let cancelled = false

    async function load(token: string, patientId: string) {
      try {
        const patientRecord = await api.patient(token, patientId)

        if (cancelled) return

        setRecord(patientRecord)
      } catch (cause) {
        if (cancelled) return

        if (cause instanceof ApiError && cause.status === 401) {
          clearSession()
          navigate('/login', { replace: true })

          return
        }

        if (
          cause instanceof ApiError &&
          (cause.status === 403 || cause.status === 404)
        ) {
          setDenied(true)
          return
        }

        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Could not load this record.',
        )
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

  if (denied) {
    return (
      <Page
        width="narrow"
        title="You cannot open this record"
        intro="Either this record does not exist, or nobody has granted you access to it."
      >
        <Link
          to="/dashboard"
          className="text-[0.9375rem] font-500 text-leaf underline underline-offset-4"
        >
          Back to your account
        </Link>
      </Page>
    )
  }

  async function withBusy(documentId: string, work: () => Promise<void>) {
    if (!session) return

    setBusyId(documentId)
    setError('')

    try {
      await work()
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'That did not work. Try again.',
      )
    } finally {
      setBusyId(null)
    }
  }

  function openDocument(document: PatientDocument) {
    if (!session) return

    // Opened up front so the tab is not treated as a pop-up once the
    // signed link comes back.
    const tab = window.open('', '_blank')

    void withBusy(document.id, async () => {
      try {
        const link = await api.documentURL(session.token, document.id)

        if (tab) {
          tab.location.href = link.url
        } else {
          window.location.href = link.url
        }
      } catch (cause) {
        tab?.close()
        throw cause
      }
    })
  }

  function renameDocument(document: PatientDocument, name: string) {
    if (!session || name.trim() === '' || name === document.name) return

    void withBusy(document.id, async () => {
      await api.updateDocument(session.token, document.id, {
        name: name.trim(),
      })
      setRefresh((value) => value + 1)
    })
  }

  function toggleVisibility(document: PatientDocument) {
    if (!session) return

    void withBusy(document.id, async () => {
      await api.updateDocument(session.token, document.id, {
        visibility: document.visibility === 'public' ? 'private' : 'public',
      })
      setRefresh((value) => value + 1)
    })
  }

  function deleteDocument(document: PatientDocument) {
    if (!session) return
    if (!window.confirm(`Delete "${document.name}"? This cannot be undone.`))
      return

    void withBusy(document.id, async () => {
      await api.deleteDocument(session.token, document.id)
      setRefresh((value) => value + 1)
    })
  }

  async function saveProfile(update: PatientUpdate) {
    if (!session || !id) return

    setSavingProfile(true)
    setError('')

    try {
      await api.updatePatient(session.token, id, update)
      setEditingVitals(false)
      setEditingContact(false)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Could not save your details.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function uploadDocument(
    file: File,
    name: string,
    visibility: 'public' | 'private',
  ) {
    if (!session || !id) return

    setUploading(true)
    setError('')

    try {
      await api.uploadDocument(session.token, id, file, name, visibility)
      setAdding(false)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The upload failed. Try again.',
      )
    } finally {
      setUploading(false)
    }
  }

  const access = record?.access
  const isOwner = access === 'owner'
  const patient = record?.patient
  const showCard = isOwner || access === 'granted'

  if (loading) {
    return (
      <Shell>
        <p className="text-[0.9375rem] text-ink-soft">Fetching the record…</p>
      </Shell>
    )
  }

  if (!isOwner) {
    return (
      <Page
        title={patient?.full_name ?? 'Patient'}
        intro={INTRO[access ?? 'public']}
        aside={
          showCard && patient ? (
            <div>
              <div className="card-lift rounded-[2cqw]">
                <EmergencyCard
                  name={patient.full_name}
                  bloodGroup={patient.blood_group ?? ''}
                  contact={patient.emergency_contact_email ?? ''}
                  serial={`AK · ${patient.id.slice(0, 4)} ${patient.id.slice(-4)}`}
                />
              </div>
              <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-soft">
                Emergency details, readable without unlocking anything.
              </p>
            </div>
          ) : undefined
        }
      >
        {error ? <Notice message={error} /> : null}

        <div className="flex flex-col gap-8">
          {showCard ? (
            <Vitals
              bloodGroup={patient?.blood_group ?? null}
              heightCm={patient?.height_cm ?? null}
              weightKg={patient?.weight_kg ?? null}
            />
          ) : null}

          <div className="sheet overflow-hidden rounded-[10px] bg-white">
            <DocumentList
              documents={record?.documents ?? []}
              onOpen={openDocument}
              busyId={busyId}
            />
          </div>

          {access === 'public' ? (
            <div className="rounded-[8px] bg-brass/8 px-5 py-5">
              <p className="text-[0.9375rem] font-600 text-ink">
                Need the full history?
              </p>
              <p className="mt-1.5 max-w-[50ch] text-[0.875rem] leading-relaxed text-ink-soft">
                Request access and{' '}
                {patient?.full_name?.split(' ')[0] ?? 'the patient'} — or their
                emergency contact — decides. Grants name you specifically and
                expire on their own.
              </p>
            </div>
          ) : null}
        </div>
      </Page>
    )
  }

  const active = record?.grants ?? []

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.875rem] leading-tight font-700 text-ink sm:text-[2.25rem]">
            Hello, {patient?.full_name?.split(' ')[0] ?? ''}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            Your records are private until you approve a request.
          </p>
        </div>

        <Link
          to={`/patients/${id}/access`}
          className="rounded-[6px] border border-rule bg-white px-4 py-2.5 text-[0.875rem] font-600 text-ink no-underline transition-colors hover:border-leaf hover:text-leaf"
        >
          Manage access
        </Link>
      </div>

      {error ? (
        <div className="mb-6">
          <Notice message={error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <Panel
            title="Records"
            meta={`${record?.documents.length ?? 0} ${
              record?.documents.length === 1 ? 'file' : 'files'
            }`}
            tight
            action={
              adding ? null : (
                <button
                  onClick={() => setAdding(true)}
                  className="cursor-pointer rounded-[6px] border-0 bg-leaf px-3.5 py-2 text-[0.8125rem] font-600 text-paper transition-colors hover:bg-leaf-bright"
                >
                  Add record
                </button>
              )
            }
          >
            {adding ? (
              <DocumentUpload
                pending={uploading}
                onUpload={uploadDocument}
                onCancel={() => setAdding(false)}
              />
            ) : null}

            <DocumentList
              documents={record?.documents ?? []}
              canManage
              busyId={busyId}
              onOpen={openDocument}
              onRename={renameDocument}
              onToggleVisibility={toggleVisibility}
              onDelete={deleteDocument}
            />
          </Panel>

          <Panel
            title="Who can see this"
            meta={active.length ? `${active.length} active` : undefined}
            action={
              <Link
                to={`/patients/${id}/access`}
                className="text-[0.8125rem] font-500 text-leaf no-underline underline-offset-4 hover:underline"
              >
                Manage
              </Link>
            }
          >
            <AccessList grants={active} />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          {patient ? (
            <div>
              <div className="card-lift rounded-[2cqw]">
                <EmergencyCard
                  name={patient.full_name}
                  bloodGroup={patient.blood_group ?? ''}
                  contact={patient.emergency_contact_email ?? ''}
                  serial={`AK · ${patient.id.slice(0, 4)} ${patient.id.slice(-4)}`}
                />
              </div>
              <p className="mt-3.5 text-[0.8125rem] leading-relaxed text-ink-soft">
                Scanning this never reveals your records — it alerts{' '}
                {patient.emergency_contact_email ?? 'your emergency contact'}.
              </p>
            </div>
          ) : null}

          <Panel
            title="Vitals"
            tight
            action={
              editingVitals ? null : (
                <button
                  onClick={() => setEditingVitals(true)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-500 text-leaf underline-offset-4 hover:underline"
                >
                  Edit
                </button>
              )
            }
          >
            {editingVitals ? (
              <VitalsEditor
                bloodGroup={patient?.blood_group ?? null}
                heightCm={patient?.height_cm ?? null}
                weightKg={patient?.weight_kg ?? null}
                pending={savingProfile}
                onSave={saveProfile}
                onCancel={() => setEditingVitals(false)}
              />
            ) : (
              <Vitals
                bloodGroup={patient?.blood_group ?? null}
                heightCm={patient?.height_cm ?? null}
                weightKg={patient?.weight_kg ?? null}
              />
            )}
          </Panel>

          <Panel
            title="Account"
            action={
              editingContact ? null : (
                <button
                  onClick={() => setEditingContact(true)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-500 text-leaf underline-offset-4 hover:underline"
                >
                  Edit contact
                </button>
              )
            }
          >
            {editingContact ? (
              <ContactEditor
                email={patient?.emergency_contact_email ?? null}
                pending={savingProfile}
                onSave={(value) =>
                  saveProfile({ emergency_contact_email: value })
                }
                onCancel={() => setEditingContact(false)}
              />
            ) : (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
                {[
                  ['Username', patient?.username],
                  ['Email', patient?.email],
                  [
                    'Emergency contact',
                    patient?.emergency_contact_email ?? 'Not set',
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
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
