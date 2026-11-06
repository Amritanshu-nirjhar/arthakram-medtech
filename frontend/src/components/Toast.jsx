import { CheckIcon, UndoIcon } from './Icons.jsx'

export default function Toast({ show, message, action, success = true }) {
  if (!show) return null
  return (
    <div
      role="status"
      className="toast-pop fixed top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-ink py-2 pl-5 pr-2 text-sm font-medium text-white shadow-lg"
    >
      <span className="flex items-center gap-2 whitespace-nowrap">
        {success && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime text-ink">
            <CheckIcon className="h-3.5 w-3.5" strokeWidth="2.6" />
          </span>
        )}
        {message}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 rounded-full bg-lime min-h-11 px-4 font-semibold text-ink transition-transform active:scale-95"
        >
          <UndoIcon className="h-4 w-4" />
          {action.label}
        </button>
      ) : (
        <span className="pr-3" />
      )}
    </div>
  )
}
