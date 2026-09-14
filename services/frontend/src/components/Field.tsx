import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: ReactNode
  suffix?: string
  error?: string
}

export function Field({ label, hint, suffix, error, className, ...input }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const isPassword = input.type === 'password'
  const [revealed, setRevealed] = useState(false)

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[0.8125rem] font-500 text-ink-soft">
        {label}
      </label>

      <div className="group relative mt-2">
        <input
          {...input}
          id={id}
          type={isPassword && revealed ? 'text' : input.type}
          aria-describedby={hint || error ? hintId : undefined}
          aria-invalid={error ? true : undefined}
          className={`w-full rounded-[7px] border bg-paper/60 px-3.5 py-2.5 text-[1rem] text-ink shadow-[0_1px_2px_rgba(20,35,28,0.04)] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-ink-faint hover:border-ink-faint focus:bg-white focus:border-leaf focus:shadow-[0_0_0_3px_rgba(31,93,69,0.13)] ${
            error ? 'border-alert' : 'border-rule'
          } ${isPassword ? 'pr-16' : suffix ? 'pr-12' : ''}`}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-[3px] border-0 bg-transparent px-1.5 py-1 text-[0.8125rem] font-500 text-ink-soft transition-colors hover:text-leaf"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        ) : null}

        {!isPassword && suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[0.9375rem] text-ink-faint">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={hintId} className="mt-2 text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-[0.8125rem] leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
