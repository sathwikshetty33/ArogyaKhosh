import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface DocumentUploadProps {
  pending: boolean
  onUpload: (file: File, name: string, visibility: 'public' | 'private') => Promise<void>
}

export function DocumentUpload({ pending, onUpload }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')

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
    <form
      onSubmit={handleSubmit}
      className="rounded-[8px] border border-dashed border-rule bg-paper/50 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null
            setFile(chosen)
            if (chosen && !name) setName(chosen.name)
          }}
          className="min-w-0 flex-1 text-[0.875rem] text-ink-soft file:mr-3 file:cursor-pointer file:rounded-[4px] file:border-0 file:bg-ink/8 file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-600 file:text-ink"
        />
      </div>

      {file ? (
        <div className="mt-4 flex flex-col gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name this record"
            className="w-full rounded-[6px] border border-rule bg-white px-3 py-2 text-[0.9375rem] text-ink outline-none focus:border-leaf"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[0.8125rem] text-ink-soft">
              Visible to
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as 'public' | 'private')
                }
                className="cursor-pointer rounded-[5px] border border-rule bg-white px-2 py-1 text-[0.8125rem] text-ink"
              >
                <option value="private">Only me and doctors I allow</option>
                <option value="public">Any signed-in doctor</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-[4px] border-0 bg-leaf px-4 py-2 text-[0.875rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
            >
              {pending ? 'Uploading…' : 'Add record'}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  )
}
