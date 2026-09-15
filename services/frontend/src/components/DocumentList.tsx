import { useState } from 'react'

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

interface DocumentListProps {
  documents: PatientDocument[]
  canManage?: boolean
  busyId?: string | null
  onOpen?: (document: PatientDocument) => void
  onRename?: (document: PatientDocument, name: string) => void
  onToggleVisibility?: (document: PatientDocument) => void
  onDelete?: (document: PatientDocument) => void
}

const action =
  'cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-500 underline decoration-rule underline-offset-4 transition-colors disabled:cursor-progress disabled:opacity-50'

export function DocumentList({
  documents,
  canManage = false,
  busyId = null,
  onOpen,
  onRename,
  onToggleVisibility,
  onDelete,
}: DocumentListProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (documents.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-rule px-5 py-8 text-center">
        <p className="text-[0.9375rem] font-500 text-ink">No records yet</p>
        <p className="mt-1.5 text-[0.875rem] text-ink-soft">
          Anything you or a hospital adds will appear here.
        </p>
      </div>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col border-t border-rule p-0">
      {documents.map((document) => {
        const busy = busyId === document.id

        return (
          <li key={document.id} className="border-b border-rule py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                {editing === document.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      onRename?.(document, draft)
                      setEditing(null)
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="min-w-0 flex-1 rounded-[5px] border border-leaf bg-white px-2.5 py-1.5 text-[0.9375rem] text-ink outline-none"
                    />
                    <button
                      type="submit"
                      className="cursor-pointer rounded-[4px] border-0 bg-leaf px-3 py-1.5 text-[0.8125rem] font-600 text-paper"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="cursor-pointer rounded-[4px] border border-rule bg-transparent px-3 py-1.5 text-[0.8125rem] font-500 text-ink-soft"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="truncate text-[0.9375rem] font-500 text-ink">
                      {document.name}
                    </p>
                    <p className="mt-1 text-[0.8125rem] text-ink-faint">
                      {formatDate(document.created_at)} · {formatSize(document.size_bytes)}
                    </p>
                  </>
                )}
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
            </div>

            {editing === document.id ? null : (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                {onOpen ? (
                  <button
                    disabled={busy}
                    onClick={() => onOpen(document)}
                    className={`${action} text-leaf hover:decoration-leaf`}
                  >
                    {busy ? 'Opening…' : 'Open'}
                  </button>
                ) : null}

                {canManage ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setDraft(document.name)
                        setEditing(document.id)
                      }}
                      className={`${action} text-ink-soft hover:text-ink`}
                    >
                      Rename
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => onToggleVisibility?.(document)}
                      className={`${action} text-ink-soft hover:text-ink`}
                    >
                      Make {document.visibility === 'public' ? 'private' : 'public'}
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => onDelete?.(document)}
                      className={`${action} text-alert hover:decoration-alert`}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
