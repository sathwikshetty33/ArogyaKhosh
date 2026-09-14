const GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const

interface BloodGroupPickerProps {
  value: string
  onChange: (value: string) => void
}

export function BloodGroupPicker({ value, onChange }: BloodGroupPickerProps) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-[0.8125rem] font-500 text-ink-soft">
        Blood group
      </legend>

      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {GROUPS.map((group) => {
          const selected = value === group

          return (
            <button
              key={group}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? '' : group)}
              className={`cursor-pointer rounded-[3px] border py-2.5 text-[0.9375rem] font-600 transition-colors duration-150 ${
                selected
                  ? 'border-leaf bg-leaf text-paper'
                  : 'border-rule bg-paper/60 text-ink-soft hover:border-leaf hover:bg-white hover:text-leaf'
              }`}
            >
              {group}
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-[0.8125rem] text-ink-faint">
        Shown to anyone who scans your emergency card. Leave blank if you are unsure.
      </p>
    </fieldset>
  )
}
