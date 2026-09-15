import type { ReactNode } from 'react'

import { Masthead } from './Masthead'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-parchment min-h-dvh">
      <Masthead />

      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">{children}</div>
    </div>
  )
}
