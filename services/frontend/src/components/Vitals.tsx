interface VitalsProps {
  bloodGroup: string | null
  heightCm: number | null
  weightKg: number | null
}

export function Vitals({ bloodGroup, heightCm, weightKg }: VitalsProps) {
  const cells = [
    { label: 'Blood group', value: bloodGroup ?? '—' },
    { label: 'Height', value: heightCm ? `${heightCm} cm` : '—' },
    { label: 'Weight', value: weightKg ? `${weightKg} kg` : '—' },
  ]

  return (
    <dl className="m-0 grid grid-cols-3 gap-px overflow-hidden rounded-[8px] bg-rule">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-white px-4 py-3.5">
          <dt className="text-[0.75rem] text-ink-faint">{cell.label}</dt>
          <dd className="m-0 mt-1 font-display text-[1.375rem] leading-none font-700 text-ink">
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
