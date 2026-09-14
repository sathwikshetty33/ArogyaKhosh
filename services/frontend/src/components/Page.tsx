import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Mark } from './Mark'

interface PageProps {
  title: string
  intro?: string
  children: ReactNode
  aside?: ReactNode
  footer?: ReactNode
}

export function Page({ title, intro, children, aside, footer }: PageProps) {
  return (
    <div className="min-h-dvh px-5 py-10 sm:px-8 sm:py-16">
      <div
        className={`mx-auto flex w-full gap-12 ${aside ? 'max-w-5xl lg:items-start' : 'max-w-xl'} ${
          aside ? 'flex-col lg:flex-row' : ''
        }`}
      >
        <div className={aside ? 'flex-1' : 'w-full'}>
          <div className="relative pl-6 sm:pl-8">
            <div className="spine absolute top-0 bottom-0 left-0 w-[3px] rounded-full bg-leaf" />

            <Link
              to="/"
              className="inline-flex items-center gap-2.5 text-leaf no-underline"
            >
              <Mark />
              <span className="font-display text-[1.0625rem] font-600 tracking-tight">
                ArogyaKhosh
              </span>
            </Link>

            <h1 className="mt-9 text-[2rem] leading-[1.15] font-600 text-ink sm:text-[2.375rem]">
              {title}
            </h1>

            {intro ? (
              <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-soft">
                {intro}
              </p>
            ) : null}

            <div className="mt-9">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-rule pt-5 text-sm text-ink-soft">
                {footer}
              </div>
            ) : null}
          </div>
        </div>

        {aside ? <div className="lg:w-[20rem] lg:pt-2">{aside}</div> : null}
      </div>
    </div>
  )
}
