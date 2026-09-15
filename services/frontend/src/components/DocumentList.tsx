import type { PatientDocument } from '../lib/api'

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function DocumentList({ documents }: { documents: PatientDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-rule px-5 py-8 text-center">
        <p className="text-[0.9375rem] font-500 text-ink">No records yet</p>
        <p className="mt-1.5 text-[0.875rem] text-ink-soft">
          Records added by a hospital that treats you will appear here.
        </p>
      </div>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col border-t border-rule p-0">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule py-4"
        >
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-500 text-ink">{document.name}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-faint">
              {formatDate(document.created_at)} · {formatSize(document.size_bytes)}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-600 ${
              document.visibility === 'public'
                ? 'bg-leaf/10 text-leaf'
                : 'bg-ink/8 text-ink-soft'
            }`}
          >
            {document.visibility === 'public' ? 'Public' : 'Private'}
          </span>
        </li>
      ))}
    </ul>
  )
}
