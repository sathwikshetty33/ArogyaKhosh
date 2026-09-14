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
      <label
        htmlFor={id}
        className="block text-[0.8125rem] font-500 text-ink-soft"
      >
        {label}
      </label>

      <div className="relative mt-1.5">
        <input
          {...input}
          id={id}
          type={isPassword && revealed ? 'text' : input.type}
          aria-describedby={hint || error ? hintId : undefined}
          aria-invalid={error ? true : undefined}
          className={`w-full border-0 border-b bg-transparent pb-2 text-[1.0625rem] text-ink transition-colors outline-none placeholder:text-ink-faint focus:border-leaf ${
            error ? 'border-alert' : 'border-rule'
          } ${isPassword ? 'pr-16' : suffix ? 'pr-10' : ''}`}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute right-0 bottom-2.5 cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-500 text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-leaf"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        ) : null}

        {!isPassword && suffix ? (
          <span className="pointer-events-none absolute right-0 bottom-2.5 text-[0.9375rem] text-ink-faint">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={hintId} className="mt-2 text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-[0.8125rem] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
