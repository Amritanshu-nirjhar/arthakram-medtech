export default function Toast({ show, message, action }) {
  if (!show) return null
  return (
    <div
      role="status"
      className="toast-pop fixed top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-ink py-2 pl-5 pr-2 text-sm font-medium text-white shadow-lg"
    >
      <span className="whitespace-nowrap">{message}</span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-full bg-lime px-4 py-1.5 font-semibold text-ink transition-transform active:scale-95"
        >
          {action.label}
        </button>
      ) : (
        <span className="pr-3" />
      )}
    </div>
  )
}
