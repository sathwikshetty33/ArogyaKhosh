import { Link, useLocation } from 'react-router-dom'

import { Mark } from './Mark'

export function Masthead({ tone = 'paper' }: { tone?: 'paper' | 'leaf' }) {
  const { pathname } = useLocation()
  const onLeaf = tone === 'leaf'
  const showSignIn = !pathname.startsWith('/login')

  return (
    <header
      className={`border-b ${
        onLeaf ? 'border-paper/15' : 'border-rule'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          to="/"
          className={`inline-flex items-center gap-2.5 no-underline ${
            onLeaf ? 'text-paper [&_rect]:fill-[var(--color-paper)]' : 'text-leaf'
          }`}
        >
          <Mark size={19} />
          <span className="font-display text-[1.0625rem] font-600 tracking-tight">
            ArogyaKhosh
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {showSignIn ? (
            <Link
              to="/login"
              className={`rounded-[3px] px-3 py-2 text-[0.875rem] font-500 no-underline transition-colors ${
                onLeaf
                  ? 'text-paper/80 hover:text-paper'
                  : 'text-ink-soft hover:text-leaf'
              }`}
            >
              Sign in
            </Link>
          ) : null}

          <Link
            to="/register"
            className={`rounded-[3px] px-3.5 py-2 text-[0.875rem] font-600 no-underline transition-colors ${
              onLeaf
                ? 'bg-paper text-leaf hover:bg-white'
                : 'bg-leaf text-paper hover:bg-leaf-bright'
            }`}
          >
            Create account
          </Link>
        </nav>
      </div>
    </header>
  )
}
