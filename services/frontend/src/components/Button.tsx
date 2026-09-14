import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean
  pendingLabel?: string
}

export function Button({
  pending,
  pendingLabel = 'Working',
  children,
  className,
  ...button
}: ButtonProps) {
  return (
    <button
      {...button}
      disabled={pending || button.disabled}
      className={`inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[3px] border-0 bg-leaf px-5 py-3.5 text-[0.9375rem] font-600 text-paper transition-[background-color,transform] duration-150 hover:bg-leaf-bright active:translate-y-px disabled:cursor-progress disabled:bg-ink-faint ${className ?? ''}`}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
}
