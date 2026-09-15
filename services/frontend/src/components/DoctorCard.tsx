import { Mark } from './Mark'

interface DoctorCardProps {
  name: string
  hospital: string
  qualification: string
  position: string | null
  serial: string
}

export function DoctorCard({
  name,
  hospital,
  qualification,
  position,
  serial,
}: DoctorCardProps) {
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
            <span className="opacity-45 [&_rect]:fill-[var(--color-paper)]">
              <Mark size={15} />
            </span>
          </div>

          <div>
            <p className="font-display text-[7cqw] leading-[1.1] font-700 text-paper">
              {name}
            </p>
            <p className="mt-[1cqw] text-[3.1cqw] leading-snug text-paper/55">{hospital}</p>
          </div>

          <div className="flex items-end justify-between gap-[4cqw]">
            <div className="min-w-0">
              <p className="text-[2.8cqw] leading-none text-paper/55">Qualification</p>
              <p className="mt-[1.2cqw] truncate font-display text-[4.6cqw] leading-none font-700 text-paper">
                {qualification}
              </p>
            </div>

            <div className="shrink-0 text-right">
              {position ? (
                <p className="text-[2.8cqw] leading-none text-paper/70">{position}</p>
              ) : null}
              <p className="mt-[1.2cqw] text-[2.6cqw] leading-none text-paper/40">{serial}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
