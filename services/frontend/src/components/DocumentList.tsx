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

function kindLabel(contentType: string | null): string {
  if (!contentType) return 'FILE'
  if (contentType.includes('pdf')) return 'PDF'
  if (contentType.startsWith('image/')) return 'IMG'
  if (contentType.includes('word') || contentType.includes('zip')) return 'DOC'

  return 'TXT'
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
  'cursor-pointer rounded-[4px] border-0 bg-transparent px-1.5 py-1 text-[0.8125rem] font-500 transition-colors disabled:cursor-progress disabled:opacity-40'

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
      <p className="px-5 py-10 text-center text-[0.9375rem] text-ink-soft">
        No records yet. Anything you or a hospital adds will appear here.
      </p>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {documents.map((document) => {
        const busy = busyId === document.id

        if (editing === document.id) {
          return (
            <li key={document.id} className="border-b border-rule px-5 py-3 last:border-b-0">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  onRename?.(document, draft)
                  setEditing(null)
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  aria-label="Record name"
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
            </li>
          )
        }

        return (
          <li
            key={document.id}
            className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-5 py-3 transition-colors last:border-b-0 hover:bg-paper/50"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-paper text-[0.625rem] font-700 text-ink-soft">
              {kindLabel(document.content_type)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[0.9375rem] font-500 text-ink">{document.name}</p>
                {document.visibility === 'public' ? (
                  <span className="shrink-0 rounded-full bg-leaf/10 px-2 py-0.5 text-[0.6875rem] font-600 text-leaf">
                    Public
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-ink-faint">
                {formatDate(document.created_at)} · {formatSize(document.size_bytes)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {onOpen ? (
                <button
                  disabled={busy}
                  onClick={() => onOpen(document)}
                  className={`${action} text-leaf hover:bg-leaf/8`}
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
                    className={`${action} text-ink-soft hover:bg-ink/6 hover:text-ink`}
                  >
                    Rename
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => onToggleVisibility?.(document)}
                    className={`${action} text-ink-soft hover:bg-ink/6 hover:text-ink`}
                  >
                    {document.visibility === 'public' ? 'Make private' : 'Make public'}
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => onDelete?.(document)}
                    className={`${action} text-alert hover:bg-alert/8`}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
