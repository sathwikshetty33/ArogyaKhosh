import { Mark } from './Mark'

interface EmergencyCardProps {
  name: string
  bloodGroup: string
  contact: string
  serial?: string
  placeholderName?: string
}

export function EmergencyCard({
  name,
  bloodGroup,
  contact,
  serial = 'AK · 0000 0000',
  placeholderName = 'Your name',
}: EmergencyCardProps) {
  const filled = Boolean(name.trim())

  return (
    <div className="@container w-full">
      <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-[2cqw] bg-leaf text-paper shadow-[0_2cqw_5cqw_-3cqw_rgba(20,35,28,0.55)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, var(--color-paper) 0 1px, transparent 1px 7px)',
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-[5cqw]">
          <div className="flex items-start justify-between gap-[3cqw]">
            <span className="font-display text-[4.2cqw] leading-none font-600 text-paper/95">
              ArogyaKhosh
            </span>
            <span className="[&_rect]:fill-[var(--color-paper)] opacity-45">
              <Mark size={15} />
            </span>
          </div>

          <div>
            <p
              className={`font-display text-[7cqw] leading-[1.1] font-700 transition-colors duration-300 ${
                filled ? 'text-paper' : 'text-paper/45'
              }`}
            >
              {filled ? name : placeholderName}
            </p>
            <p className="mt-[1cqw] text-[3.1cqw] leading-snug text-paper/55">
              {contact.trim() ? `Emergency contact · ${contact}` : 'Emergency contact pending'}
            </p>
          </div>

          <div className="flex items-end justify-between gap-[4cqw]">
            <div>
              <p className="text-[2.8cqw] leading-none text-paper/55">Blood group</p>
              <p
                className={`mt-[1.2cqw] font-display text-[9cqw] leading-none font-700 transition-colors duration-300 ${
                  bloodGroup ? 'text-paper' : 'text-paper/35'
                }`}
              >
                {bloodGroup || '—'}
              </p>
            </div>

            <div className="flex items-end gap-[3cqw]">
              <span className="pb-[0.6cqw] text-[2.6cqw] leading-none text-paper/40">
                {serial}
              </span>
              <span
                aria-hidden="true"
                className="grid size-[17cqw] shrink-0 grid-cols-5 gap-[0.7cqw] rounded-[1cqw] bg-paper p-[1.4cqw]"
              >
                {Array.from({ length: 25 }).map((_, index) => (
                  <span
                    key={index}
                    className={`rounded-[0.3cqw] ${
                      [0, 1, 2, 5, 7, 10, 12, 13, 16, 18, 20, 21, 22, 24, 9, 14].includes(index)
                        ? 'bg-leaf'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
