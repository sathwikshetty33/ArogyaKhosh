import { useState } from 'react'
import type { FormEvent } from 'react'

interface ContactEditorProps {
  email: string | null
  pending: boolean
  onSave: (email: string) => Promise<void>
  onCancel: () => void
}

export function ContactEditor({ email, pending, onSave, onCancel }: ContactEditorProps) {
  const [value, setValue] = useState(email ?? '')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim()) return

    await onSave(value.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.75rem] text-ink-soft">Emergency contact email</span>
        <input
          type="email"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="name@example.com"
          className="w-full rounded-[6px] border border-rule bg-white px-2.5 py-2 text-[0.9375rem] text-ink outline-none focus:border-leaf"
        />
      </label>

      <p className="text-[0.75rem] leading-relaxed text-ink-faint">
        This is who we reach if you cannot answer, and who may grant a doctor access on
        your behalf.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-[6px] border-0 bg-leaf px-3.5 py-2 text-[0.8125rem] font-600 text-paper transition-colors hover:bg-leaf-bright disabled:cursor-progress disabled:bg-ink-faint"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-[6px] border border-rule bg-transparent px-3.5 py-2 text-[0.8125rem] font-500 text-ink-soft transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
