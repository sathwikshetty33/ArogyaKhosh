export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="8" y="1" width="4" height="18" rx="1" fill="var(--color-leaf)" />
      <rect x="1" y="8" width="18" height="4" rx="1" fill="var(--color-leaf)" />
    </svg>
  )
}
