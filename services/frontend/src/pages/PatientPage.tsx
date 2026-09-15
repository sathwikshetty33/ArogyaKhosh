import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AccessList } from '../components/AccessList'
import { DocumentList } from '../components/DocumentList'
import { EmergencyCard } from '../components/EmergencyCard'
import { Notice } from '../components/Notice'
import { Page } from '../components/Page'
import { Vitals } from '../components/Vitals'
import { api, ApiError } from '../lib/api'
import type { Me, PatientRecord } from '../lib/api'
import { clearSession, loadSession } from '../lib/session'

function Section({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[1.0625rem] font-600 text-ink">{title}</h2>
        {meta ? <span className="text-[0.8125rem] text-ink-faint">{meta}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const INTRO: Record<string, string> = {
  owner: 'Your records are private until you approve a request.',
  granted: 'You have been granted access to this record. It expires on its own.',
  public: 'You can see this patient’s public records. Anything else needs their consent.',
}

export function PatientPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const [me, setMe] = useState<Me | null>(null)
  const [record, setRecord] = useState<PatientRecord | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      navigate(`/login?next=/patients/${id ?? ''}`, { replace: true })
      return
    }

    if (!id) return

    let cancelled = false

    async function load(token: string, patientId: string) {
      try {
        const [profile, patientRecord] = await Promise.all([
          api.me(token),
          api.patient(token, patientId),
        ])

        if (cancelled) return

        setMe(profile)
        setRecord(patientRecord)
      } catch (cause) {
        if (cancelled) return

        if (cause instanceof ApiError && cause.status === 401) {
          clearSession()
          navigate('/login', { replace: true })

          return
        }

        if (cause instanceof ApiError && (cause.status === 403 || cause.status === 404)) {
          setDenied(true)
          return
        }

        setError(cause instanceof ApiError ? cause.message : 'Could not load this record.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load(session.token, id)

    return () => {
      cancelled = true
    }
  }, [session, id, navigate])

  if (!session) return null

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

  const access = record?.access
  const isOwner = access === 'owner'
  const patient = record?.patient
  const showCard = isOwner || access === 'granted'

  return (
    <Page
      title={
        loading
          ? 'Loading'
          : isOwner
            ? `Hello, ${patient?.full_name?.split(' ')[0] ?? ''}`
            : (patient?.full_name ?? 'Patient')
      }
      intro={loading ? undefined : INTRO[access ?? 'public']}
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
              {isOwner
                ? 'Keep a printed copy in your wallet. Scanning it never reveals your records — it alerts your emergency contact.'
                : 'Emergency details, readable without unlocking anything.'}
            </p>
          </div>
        ) : undefined
      }
    >
      {error ? <Notice message={error} /> : null}

      {loading ? (
        <p className="text-[0.9375rem] text-ink-soft">Fetching the record…</p>
      ) : (
        <div className="flex flex-col gap-10">
          {showCard ? (
            <Vitals
              bloodGroup={patient?.blood_group ?? null}
              heightCm={patient?.height_cm ?? null}
              weightKg={patient?.weight_kg ?? null}
            />
          ) : null}

          <Section
            title={isOwner ? 'Records' : 'Records you can open'}
            meta={`${record?.documents.length ?? 0} ${
              record?.documents.length === 1 ? 'document' : 'documents'
            }`}
          >
            <DocumentList documents={record?.documents ?? []} />
          </Section>

          {access === 'public' ? (
            <div className="rounded-[8px] bg-brass/8 px-5 py-5">
              <p className="text-[0.9375rem] font-600 text-ink">
                Need the full history?
              </p>
              <p className="mt-1.5 max-w-[50ch] text-[0.875rem] leading-relaxed text-ink-soft">
                Request access and {patient?.full_name?.split(' ')[0] ?? 'the patient'} — or
                their emergency contact — decides. Grants name you specifically and expire
                on their own.
              </p>
            </div>
          ) : null}

          {isOwner ? (
            <Section
              title="Who can see this"
              meta={record?.grants?.length ? `${record.grants.length} active` : undefined}
            >
              <AccessList grants={record?.grants ?? []} />
            </Section>
          ) : null}

          {isOwner ? (
            <Section title="Account">
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-8 gap-y-0 border-t border-rule">
                {[
                  ['Username', patient?.username],
                  ['Email', patient?.email],
                  ['Emergency contact', patient?.emergency_contact_email ?? 'Not set'],
                  ['Record id', patient?.id],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="col-span-2 grid grid-cols-subgrid border-b border-rule py-3"
                  >
                    <dt className="text-[0.875rem] text-ink-soft">{label}</dt>
                    <dd className="m-0 truncate text-[0.9375rem] text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}

          {me?.role === 'doctor' ? (
            <p className="text-[0.8125rem] text-ink-faint">
              Signed in as {me.user.full_name}
              {me.doctor?.hospital ? ` · ${me.doctor.hospital.name}` : ''}
            </p>
          ) : null}
        </div>
      )}
    </Page>
  )
}
