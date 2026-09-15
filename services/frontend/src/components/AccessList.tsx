import type { AccessGrant } from '../lib/api'

function remaining(iso: string | null): string {
  if (!iso) return 'No expiry set'

  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Expired'

  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return `Expires in ${Math.max(1, Math.round(ms / 60_000))} min`
  if (hours < 48) return `Expires in ${hours} h`

  return `Expires in ${Math.round(hours / 24)} days`
}

export function AccessList({ grants }: { grants: AccessGrant[] }) {
  if (grants.length === 0) {
    return (
      <div className="rounded-[8px] bg-leaf/6 px-5 py-6">
        <p className="text-[0.9375rem] font-500 text-ink">Nobody has access right now</p>
        <p className="mt-1.5 max-w-[46ch] text-[0.875rem] leading-relaxed text-ink-soft">
          Your records stay private until you approve a request, or your emergency
          contact approves one on your behalf.
        </p>
      </div>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {grants.map((grant) => (
        <li key={grant.id} className="rounded-[8px] border border-rule bg-paper/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-600 text-ink">{grant.doctor_name}</p>
              <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
                {grant.hospital} · {grant.qualification}
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-leaf/10 py-1 pr-2.5 pl-2 text-[0.75rem] font-600 text-leaf">
              <span className="size-1.5 rounded-full bg-leaf" />
              {remaining(grant.expires_at)}
            </span>
          </div>

          {grant.granted_by_email ? (
            <p className="mt-2.5 border-t border-rule pt-2.5 text-[0.8125rem] text-ink-faint">
              Approved by {grant.granted_by_email}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
