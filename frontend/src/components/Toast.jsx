export default function Toast({ show, message }) {
  if (!show) return null
  return (
    <div
      role="status"
      className="toast-pop fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  )
}
