import { useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'

interface DocumentUploadProps {
  pending: boolean
  onUpload: (file: File, name: string, visibility: 'public' | 'private') => Promise<void>
  onCancel: () => void
}

export function DocumentUpload({ pending, onUpload, onCancel }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [over, setOver] = useState(false)

  function choose(chosen: File | null) {
    setFile(chosen)
    if (chosen) setName(chosen.name.replace(/\.[^.]+$/, ''))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setOver(false)
    choose(event.dataTransfer.files?.[0] ?? null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) return

    await onUpload(file, name.trim() || file.name, visibility)

    setFile(null)
    setName('')
    setVisibility('private')

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <form onSubmit={handleSubmit} className="border-b border-rule bg-paper/40 px-5 py-4">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        className={`rounded-[8px] border border-dashed px-4 py-6 text-center transition-colors ${
          over ? 'border-leaf bg-leaf/5' : 'border-rule bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          id="record-file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
          className="sr-only"
        />

        {file ? (
          <p className="text-[0.9375rem] text-ink">
            {file.name}{' '}
            <button
              type="button"
              onClick={() => choose(null)}
              className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] text-ink-soft underline underline-offset-4"
            >
              change
            </button>
          </p>
        ) : (
          <p className="text-[0.9375rem] text-ink-soft">
            Drop a file here, or{' '}
            <label
              htmlFor="record-file"
              className="cursor-pointer font-600 text-leaf underline underline-offset-4"
            >
              browse
            </label>
          </p>
        )}

        <p className="mt-1.5 text-[0.75rem] text-ink-faint">
          PDF, image, Word or text · up to 20 MB
        </p>
      </div>

      {file ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Name this record"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name this record"
            className="min-w-0 flex-1 rounded-[6px] border border-rule bg-white px-3 py-2 text-[0.9375rem] text-ink outline-none focus:border-leaf"
          />

          <select
            aria-label="Who can see this record"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'public' | 'private')}
            className="cursor-pointer rounded-[6px] border border-rule bg-white px-2.5 py-2 text-[0.8125rem] text-ink"
          >
            <option value="private">Private</option>
            <option value="public">Any doctor</option>
          </select>

          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-[6px] border-0 bg-leaf px-4 py-2 text-[0.875rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
          >
            {pending ? 'Uploading…' : 'Add record'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-500 text-ink-soft underline underline-offset-4"
        >
          Cancel
        </button>
      )}
    </form>
  )
}
