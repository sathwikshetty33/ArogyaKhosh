import type { ReactNode } from 'react'

import { Masthead } from './Masthead'

interface PageProps {
  title: string
  intro?: string
  children: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  width?: 'narrow' | 'wide'
  bare?: boolean
}

const SHELL = {
  narrow: 'max-w-3xl',
  wide: 'max-w-5xl',
} as const

const NO_ASIDE = {
  narrow: 'max-w-md',
  wide: 'max-w-2xl',
} as const

const ASIDE = {
  narrow: 'lg:w-[16.5rem]',
  wide: 'lg:w-[20rem]',
} as const

export function Page({
  title,
  intro,
  children,
  aside,
  footer,
  width = 'wide',
  bare = false,
}: PageProps) {
  return (
    <div className="bg-parchment flex min-h-dvh flex-col">
      <Masthead bare={bare} />

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
        <div
          className={`flex w-full flex-col gap-10 ${
            aside ? `${SHELL[width]} lg:flex-row lg:items-start lg:gap-12` : NO_ASIDE[width]
          }`}
        >
          <div className="sheet relative flex-1 overflow-hidden rounded-[14px] bg-white p-7 sm:p-8">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-leaf via-leaf-bright to-brass"
            />

            <h1 className="font-display text-[1.75rem] leading-[1.08] font-700 tracking-tight text-ink sm:text-[2rem]">
              {title}
            </h1>

            {intro ? (
              <p className="mt-3 max-w-[48ch] text-[0.9375rem] leading-relaxed text-ink-soft">
                {intro}
              </p>
            ) : null}

            <div className="mt-7">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-rule pt-5 text-[0.9375rem] text-ink-soft">
                {footer}
              </div>
            ) : null}
          </div>

          {aside ? (
            <aside className={`${ASIDE[width]} lg:shrink-0`}>
              <div className="lg:sticky lg:top-10">{aside}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
