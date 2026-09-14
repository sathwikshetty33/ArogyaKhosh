import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { Link } from 'react-router-dom'

import { EmergencyCard } from '../components/EmergencyCard'
import { Masthead } from '../components/Masthead'

const STEPS = [
  {
    title: 'Someone finds you and scans the card',
    detail:
      'No app, no login. The card in your wallet opens a page on their phone.',
  },
  {
    title: 'They photograph the scene',
    detail:
      'A model checks the photo really shows an accident, so a lost card cannot raise a false alarm.',
  },
  {
    title: 'Your emergency contact is alerted',
    detail:
      'Whoever you nominated gets a message within seconds, wherever they are.',
  },
  {
    title: 'They open your records to one doctor',
    detail:
      'Your contact names the treating doctor. Access expires on its own afterwards.',
  },
]

export function LandingPage() {
  const cardRef = useRef<HTMLDivElement>(null)

  function handleTilt(event: PointerEvent<HTMLDivElement>) {
    const node = cardRef.current
    if (!node) return

    const bounds = node.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5

    node.style.setProperty('--tilt-y', `${x * 9}deg`)
    node.style.setProperty('--tilt-x', `${-y * 7}deg`)
  }

  function resetTilt() {
    const node = cardRef.current
    if (!node) return

    node.style.setProperty('--tilt-y', '0deg')
    node.style.setProperty('--tilt-x', '0deg')
  }

  return (
    <div className="min-h-dvh">
      <div className="bg-forest text-paper">
        <Masthead tone="leaf" />

        <div className="mx-auto w-full max-w-6xl px-5 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-20">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
            <div>
              <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-brass-soft/35 bg-brass/10 py-1.5 pr-4 pl-3 text-[0.8125rem] font-500 text-brass-soft">
                <span className="size-1.5 rounded-full bg-brass-soft" />
                Built for the minutes that matter
              </p>

              <h1 className="max-w-[13ch] font-display text-[3rem] leading-[0.98] font-800 tracking-[-0.02em] text-paper sm:text-[4.5rem]">
                Your records should arrive before you do.
              </h1>

              <p className="mt-6 max-w-[50ch] text-[1.0625rem] leading-relaxed text-paper/70">
                Every prescription, scan and discharge note in one place — and a way
                for the right doctor to reach them in the minutes that decide an
                outcome.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  to="/register/patient"
                  className="rounded-[3px] bg-paper px-6 py-3.5 text-[0.9375rem] font-600 text-leaf no-underline transition-transform duration-150 hover:bg-white active:translate-y-px"
                >
                  Create your record
                </Link>
                <Link
                  to="/register/doctor"
                  className="rounded-[3px] border border-paper/30 px-6 py-3.5 text-[0.9375rem] font-600 text-paper no-underline transition-colors duration-150 hover:border-paper/70"
                >
                  I treat patients
                </Link>
              </div>
            </div>

            <div
              onPointerMove={handleTilt}
              onPointerLeave={resetTilt}
              className="mx-auto w-full max-w-[26rem] lg:max-w-none"
            >
              <div ref={cardRef} className="tilt-card card-lift rounded-[2cqw]">
                <EmergencyCard
                  name="Sathwik Shetty"
                  bloodGroup="O+"
                  contact="amma@example.com"
                  serial="AK · 4471 0982"
                />
              </div>
              <p className="mt-6 text-center text-[0.8125rem] text-paper/45 lg:text-left">
                The card you carry. Printed, or on your lock screen.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-parchment">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
          <div className="flex flex-col gap-6 border-b border-rule pb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
            <h2 className="max-w-[16ch] font-display text-[2rem] leading-[1.04] font-700 text-ink sm:text-[2.75rem]">
              What happens if you are in an accident
            </h2>
            <p className="max-w-[36ch] text-[0.9375rem] leading-relaxed text-ink-soft">
              Four steps, and a human decision at the end of them. No algorithm opens a
              record on its own.
            </p>
          </div>

          <ol className="m-0 grid list-none grid-cols-1 gap-x-16 gap-y-0 p-0 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="group grid grid-cols-[auto_1fr] gap-x-5 border-b border-rule py-7"
              >
                <span className="font-display text-[1.625rem] leading-none font-800 text-brass/55 tabular-nums transition-colors duration-200 group-hover:text-brass">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-[1.0625rem] leading-snug font-600 text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-parchment-deep text-ink">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-18 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <h2 className="max-w-[13ch] font-display text-[2rem] leading-[1.04] font-700 text-ink sm:text-[2.75rem]">
              Nobody opens your file without a yes.
            </h2>

            <p className="mt-6 max-w-[38ch] text-[1rem] leading-relaxed text-ink-soft">
              A doctor asks. You — or the contact you nominated — decide. Every grant
              names one doctor, covers what you choose, and lapses on its own when the
              episode is over.
            </p>

            <Link
              to="/register/patient"
              className="mt-8 inline-block rounded-[4px] bg-leaf px-6 py-3.5 text-[0.9375rem] font-600 text-paper no-underline transition-colors duration-150 hover:bg-leaf-bright"
            >
              Create your record
            </Link>
          </div>

          <div className="sheet rounded-[12px] bg-white p-6 text-ink sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-[1.25rem] leading-tight font-700 text-ink">
                  Dr Anita Rao
                </p>
                <p className="mt-1 text-[0.875rem] text-ink-soft">
                  Apollo Bengaluru · Cardiology
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-leaf/10 py-1.5 pr-3 pl-2.5 text-[0.8125rem] font-600 text-leaf">
                <span className="size-1.5 rounded-full bg-leaf" />
                Access granted
              </span>
            </div>

            <dl className="m-0 mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-0 border-t border-rule">
              {[
                ['Granted by', 'amma@example.com'],
                ['Covers', 'All records, this episode'],
                ['Expires', 'in 47 hours'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="col-span-2 grid grid-cols-subgrid border-b border-rule py-3"
                >
                  <dt className="text-[0.875rem] text-ink-soft">{label}</dt>
                  <dd className="m-0 text-[0.9375rem] font-500 text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="cursor-pointer rounded-[4px] border border-alert/30 bg-transparent px-4 py-2.5 text-[0.875rem] font-600 text-alert transition-colors duration-150 hover:border-alert hover:bg-alert/5">
                Revoke now
              </button>
              <span className="text-[0.8125rem] text-ink-faint">
                Takes effect on their next click.
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-9 text-[0.875rem] text-paper/45 sm:px-8">
          <span className="font-display font-600 text-paper/70">ArogyaKhosh</span>
          <span className="flex gap-7">
            <Link to="/login" className="text-paper/45 no-underline transition-colors hover:text-paper">
              Sign in
            </Link>
            <Link to="/register" className="text-paper/45 no-underline transition-colors hover:text-paper">
              Create account
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
