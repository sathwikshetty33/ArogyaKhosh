import { Link, useLocation, useNavigate } from 'react-router-dom'

import { clearSession, loadSession } from '../lib/session'
import { Mark } from './Mark'

export function Masthead({ tone = 'paper' }: { tone?: 'paper' | 'leaf' }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const session = loadSession()
  const onLeaf = tone === 'leaf'

  const quiet = onLeaf ? 'text-paper/80 hover:text-paper' : 'text-ink-soft hover:text-leaf'
  const solid = onLeaf
    ? 'bg-paper text-leaf hover:bg-white'
    : 'bg-leaf text-paper hover:bg-leaf-bright'

  return (
    <header className={`border-b ${onLeaf ? 'border-paper/15' : 'border-rule'}`}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          to={session ? '/dashboard' : '/'}
          className={`inline-flex items-center gap-2.5 no-underline ${
            onLeaf ? 'text-paper [&_rect]:fill-[var(--color-paper)]' : 'text-leaf'
          }`}
        >
          <Mark size={19} />
          <span className="font-display text-[1.0625rem] font-600 tracking-tight">
            ArogyaKhosh
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3">
          {session ? (
            <>
              <span
                className={`hidden text-[0.875rem] sm:inline ${
                  onLeaf ? 'text-paper/70' : 'text-ink-soft'
                }`}
              >
                {session.user.full_name}
              </span>
              <button
                onClick={() => {
                  clearSession()
                  navigate('/login', { replace: true })
                }}
                className={`cursor-pointer rounded-[3px] border-0 bg-transparent px-3 py-2 text-[0.875rem] font-500 transition-colors ${quiet}`}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {pathname.startsWith('/login') ? null : (
                <Link
                  to="/login"
                  className={`rounded-[3px] px-3 py-2 text-[0.875rem] font-500 no-underline transition-colors ${quiet}`}
                >
                  Sign in
                </Link>
              )}
              <Link
                to="/register"
                className={`rounded-[3px] px-3.5 py-2 text-[0.875rem] font-600 no-underline transition-colors ${solid}`}
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
