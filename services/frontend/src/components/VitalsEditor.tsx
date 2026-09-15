import { useState } from 'react'
import type { FormEvent } from 'react'

import type { PatientUpdate } from '../lib/api'

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

interface VitalsEditorProps {
  bloodGroup: string | null
  heightCm: number | null
  weightKg: number | null
  pending: boolean
  onSave: (update: PatientUpdate) => Promise<void>
  onCancel: () => void
}

const field =
  'w-full rounded-[6px] border border-rule bg-white px-2.5 py-2 text-[0.9375rem] text-ink outline-none focus:border-leaf'

export function VitalsEditor({
  bloodGroup,
  heightCm,
  weightKg,
  pending,
  onSave,
  onCancel,
}: VitalsEditorProps) {
  const [group, setGroup] = useState(bloodGroup ?? '')
  const [height, setHeight] = useState(heightCm ? String(heightCm) : '')
  const [weight, setWeight] = useState(weightKg ? String(weightKg) : '')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const update: PatientUpdate = {}

    if (group) update.blood_group = group
    if (height.trim()) update.height_cm = Number(height)
    if (weight.trim()) update.weight_kg = Number(weight)

    await onSave(update)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 py-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.75rem] text-ink-soft">Blood group</span>
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          className={`${field} cursor-pointer`}
        >
          <option value="">Not set</option>
          {GROUPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] text-ink-soft">Height (cm)</span>
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] text-ink-soft">Weight (kg)</span>
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="mt-1 flex items-center gap-2">
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
