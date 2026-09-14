export function Notice({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border-l-2 border-alert bg-alert/5 py-2.5 pr-3 pl-3.5 text-[0.875rem] text-alert"
    >
      {message}
    </p>
  )
}
