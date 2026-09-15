import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  meta?: string
  action?: ReactNode
  children: ReactNode
  tight?: boolean
}

export function Panel({ title, meta, action, children, tight = false }: PanelProps) {
  return (
    <section className="sheet overflow-hidden rounded-[12px] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[1rem] font-600 text-ink">{title}</h2>
          {meta ? <span className="text-[0.8125rem] text-ink-faint">{meta}</span> : null}
        </div>
        {action}
      </header>

      <div className={tight ? '' : 'px-5 py-4'}>{children}</div>
    </section>
  )
}
