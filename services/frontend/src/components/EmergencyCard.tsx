import { Mark } from './Mark'

interface EmergencyCardProps {
  name: string
  bloodGroup: string
  contact: string
}

export function EmergencyCard({ name, bloodGroup, contact }: EmergencyCardProps) {
  const filled = Boolean(name.trim())

  return (
    <div>
      <div className="aspect-[1.586/1] w-full rounded-[6px] bg-leaf p-5 text-paper shadow-[0_1px_0_var(--color-rule),0_12px_28px_-18px_rgba(20,35,28,0.7)]">
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <span className="font-display text-[0.9375rem] font-600 text-paper/95">
              ArogyaKhosh
            </span>
            <span className="rounded-[2px] bg-paper/15 p-1">
              <span className="block [&_rect]:fill-[var(--color-paper)]">
                <Mark size={13} />
              </span>
            </span>
          </div>

          <div>
            <p
              className={`font-display text-[1.25rem] leading-tight font-600 transition-colors ${
                filled ? 'text-paper' : 'text-paper/35'
              }`}
            >
              {filled ? name : 'Your name'}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-paper/60">
              {contact.trim() ? `In an emergency, contact ${contact}` : 'Emergency contact pending'}
            </p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] text-paper/60">Blood group</p>
              <p
                className={`font-display text-[1.75rem] leading-none font-700 transition-colors ${
                  bloodGroup ? 'text-paper' : 'text-paper/25'
                }`}
              >
                {bloodGroup || '—'}
              </p>
            </div>

            <div
              aria-hidden="true"
              className="grid size-12 shrink-0 grid-cols-4 gap-[2px] rounded-[2px] bg-paper/90 p-1"
            >
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded-[1px] ${
                    [0, 1, 4, 2, 7, 8, 11, 12, 13, 15].includes(index)
                      ? 'bg-leaf'
                      : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-[34ch] text-[0.8125rem] leading-relaxed text-ink-soft">
        Carry this card. If you are in an accident, whoever finds you scans it — and your
        emergency contact decides which doctor may open your records.
      </p>
    </div>
  )
}
