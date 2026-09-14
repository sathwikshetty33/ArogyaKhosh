import type { ReactNode } from 'react'

interface FieldsetProps {
  step: number
  title: string
  detail?: string
  children: ReactNode
}

export function Fieldset({ step, title, detail, children }: FieldsetProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="flex w-full items-baseline gap-3 p-0">
        <span className="font-display text-[0.875rem] font-700 text-leaf tabular-nums">
          {String(step).padStart(2, '0')}
        </span>
        <span className="font-display text-[1.125rem] font-600 text-ink">{title}</span>
      </legend>

      {detail ? (
        <p className="mt-1.5 ml-[1.9rem] max-w-[44ch] text-[0.875rem] leading-relaxed text-ink-soft">
          {detail}
        </p>
      ) : null}

      <div className="mt-6 ml-[1.9rem] flex flex-col gap-6">{children}</div>
    </fieldset>
  )
}
