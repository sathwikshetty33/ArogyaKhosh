import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Page } from '../components/Page'
import { clearSession, loadSession } from '../lib/session'

function format(msLeft: number): string {
  const minutes = Math.floor(msLeft / 60000)
  const seconds = Math.floor((msLeft % 60000) / 1000)

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [session] = useState(loadSession)
  const [msLeft, setMsLeft] = useState(0)

  useEffect(() => {
    if (!session) return

    const tick = () => setMsLeft(Math.max(0, session.expiresAt - Date.now()))

    tick()
    const timer = setInterval(tick, 1000)

    return () => clearInterval(timer)
  }, [session])

  if (!session) {
    return (
      <Page
        title="You are signed out"
        intro="Sign in to open your records."
      >
        <button
          onClick={() => navigate('/login')}
          className="cursor-pointer border-0 bg-transparent p-0 font-500 text-leaf underline underline-offset-4"
        >
          Go to sign in
        </button>
      </Page>
    )
  }

  const expired = msLeft <= 0

  return (
    <Page
      title={`Welcome, ${session.user.full_name}`}
      intro="Nothing lives here yet. Records, access requests and your emergency card arrive next."
    >
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-8 gap-y-0 border-t border-rule">
        {[
          ['Signed in as', session.user.username],
          ['Role', session.role],
          ['Email', session.user.email],
          ['Session expires in', expired ? 'expired' : format(msLeft)],
        ].map(([label, value]) => (
          <div key={label} className="col-span-2 grid grid-cols-subgrid border-b border-rule py-3.5">
            <dt className="text-[0.875rem] text-ink-soft">{label}</dt>
            <dd
              className={`m-0 text-[0.9375rem] font-500 ${
                label === 'Session expires in' && expired ? 'text-alert' : 'text-ink'
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <button
        onClick={() => {
          clearSession()
          navigate('/login')
        }}
        className="mt-8 cursor-pointer border-0 bg-transparent p-0 text-[0.9375rem] font-500 text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-alert"
      >
        Sign out
      </button>
    </Page>
  )
}
