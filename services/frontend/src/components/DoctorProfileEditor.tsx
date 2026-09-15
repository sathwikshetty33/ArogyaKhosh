import { useState } from 'react'
import type { FormEvent } from 'react'

import type { DoctorProfile, DoctorUpdate, Hospital } from '../lib/api'

interface DoctorProfileEditorProps {
  doctor: DoctorProfile
  hospitals: Hospital[]
  pending: boolean
  onSave: (update: DoctorUpdate) => Promise<void>
  onCancel: () => void
}

const field =
  'w-full rounded-[6px] border border-rule bg-white px-2.5 py-2 text-[0.9375rem] text-ink outline-none focus:border-leaf'

export function DoctorProfileEditor({
  doctor,
  hospitals,
  pending,
  onSave,
  onCancel,
}: DoctorProfileEditorProps) {
  const [qualification, setQualification] = useState(doctor.qualification)
  const [position, setPosition] = useState(doctor.position ?? '')
  const [hospitalId, setHospitalId] = useState(doctor.hospital_id)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const update: DoctorUpdate = { position }

    if (qualification.trim()) update.qualification = qualification.trim()
    if (hospitalId) update.hospital_id = hospitalId

    await onSave(update)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.75rem] text-ink-soft">Hospital</span>
        <select
          value={hospitalId}
          onChange={(event) => setHospitalId(event.target.value)}
          className={`${field} cursor-pointer`}
        >
          {hospitals.map((hospital) => (
            <option key={hospital.id} value={hospital.id}>
              {hospital.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.75rem] text-ink-soft">Qualification</span>
        <input
          type="text"
          value={qualification}
          onChange={(event) => setQualification(event.target.value)}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.75rem] text-ink-soft">Position</span>
        <input
          type="text"
          value={position}
          placeholder="Consultant"
          onChange={(event) => setPosition(event.target.value)}
          className={field}
        />
      </label>

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
