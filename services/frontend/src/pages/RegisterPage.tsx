import { Link } from 'react-router-dom'

import { Page } from '../components/Page'

const PATHS = [
  {
    to: '/register/patient',
    title: 'I am a patient',
    detail: 'Keep your records in one place and carry an emergency card.',
  },
  {
    to: '/register/doctor',
    title: 'I am a doctor',
    detail: 'Request access to a patient’s history from your hospital.',
  },
]

export function RegisterPage() {
  return (
    <Page
      title="Create an account"
      intro="Two ways in. Pick the one that describes you."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-500 text-leaf underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <ul className="m-0 flex list-none flex-col border-t border-rule p-0">
        {PATHS.map((path) => (
          <li key={path.to} className="border-b border-rule">
            <Link
              to={path.to}
              className="group flex items-center justify-between gap-6 py-5 no-underline transition-[padding] duration-200 hover:pl-2"
            >
              <span>
                <span className="block font-display text-[1.125rem] font-600 text-ink">
                  {path.title}
                </span>
                <span className="mt-1 block max-w-[38ch] text-[0.875rem] text-ink-soft">
                  {path.detail}
                </span>
              </span>

              <span
                aria-hidden="true"
                className="h-px w-6 shrink-0 bg-rule transition-[width,background-color] duration-200 group-hover:w-12 group-hover:bg-leaf"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}
