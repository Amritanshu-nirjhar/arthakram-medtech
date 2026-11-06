import { useEffect, useMemo, useState } from 'react'
import { VISIT_LABELS, getReminders, prettyDate, updateReminderStatus } from '../api.js'
import StatusBadge from '../components/StatusBadge.jsx'

const FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'all', label: 'All' },
]

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayISO() {
  return toISODate(new Date())
}

function addDaysISO(base, days) {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

function inRange(r, filter, today, weekEnd) {
  if (filter === 'today') return r.follow_up_date === today
  if (filter === 'week') return r.follow_up_date >= today && r.follow_up_date <= weekEnd
  return true
}

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2s.2-1.1.1-1.2-.2-.2-.5-.3Z" />
    </svg>
  )
}

export default function Reception() {
  const [filter, setFilter] = useState('today')
  const [reminders, setReminders] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionState, setActionState] = useState({})

  async function loadReminders() {
    setLoading(true)
    setError(null)
    try {
      const data = await getReminders()
      setReminders(data)
    } catch (err) {
      setError(err.message || 'Could not load the queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReminders()
  }, [])

  async function handleStatusChange(reminder, status) {
    setActionState((prev) => ({ ...prev, [reminder.id]: { loading: true, error: null } }))
    try {
      const updated = await updateReminderStatus(reminder.id, status)
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, ...updated } : r)))
      setActionState((prev) => ({ ...prev, [reminder.id]: { loading: false, error: null } }))
    } catch (err) {
      setActionState((prev) => ({
        ...prev,
        [reminder.id]: { loading: false, error: err.message || 'Could not update — try again.' },
      }))
    }
  }

  async function handleSend(reminder) {
    const url = `https://wa.me/91${reminder.patient_phone}?text=${encodeURIComponent(reminder.message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    await handleStatusChange(reminder, 'sent')
  }

  const today = todayISO()
  const weekEnd = addDaysISO(today, 6)

  const visible = useMemo(() => {
    if (!reminders) return []
    return reminders
      .filter((r) => inRange(r, filter, today, weekEnd))
      .sort((a, b) => (a.follow_up_date || '').localeCompare(b.follow_up_date || ''))
  }, [reminders, filter, today, weekEnd])

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, (reminders || []).filter((r) => inRange(r, f.value, today, weekEnd)).length]),
  )
  const toSendToday = (reminders || []).filter((r) => r.status === 'approved' && r.follow_up_date <= today).length

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Reception</p>
      <h1 className="display mt-2 text-6xl text-ink sm:text-7xl">
        The <em className="text-accent">queue</em>
      </h1>
      <p className="mt-3 text-base text-ink-soft">
        {toSendToday > 0 ? (
          <>
            <span className="font-semibold text-ink">{toSendToday} to send today.</span> Then track who confirms,
            visits or misses.
          </>
        ) : (
          'All caught up. Track who has confirmed, visited or missed.'
        )}
      </p>

      <div className="mt-8 inline-flex rounded-full border border-line bg-surface p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {f.label}
            {reminders && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                  filter === f.value ? 'bg-white/20' : 'bg-bg'
                }`}
              >
                {counts[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-surface">
        {loading && (
          <ul className="divide-y divide-line px-5 sm:px-7" aria-label="Loading the queue">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-4 py-5">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-line" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="h-4 w-1/3 animate-pulse rounded-full bg-line" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-line" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="p-6 text-center text-sm text-warn">
            <p>{error}</p>
            <button type="button" onClick={loadReminders} className="mt-2 font-medium underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="px-6 py-14 text-center">
            <p className="display text-4xl text-ink">Nothing here.</p>
            <p className="mt-2 text-sm text-ink-soft">
              No follow-ups in this range.{' '}
              {filter !== 'all' && (
                <button type="button" onClick={() => setFilter('all')} className="font-medium text-accent underline">
                  Show all
                </button>
              )}
            </p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <ul key={filter} className="divide-y divide-line px-5 sm:px-7">
            {visible.map((r, idx) => {
              const action = actionState[r.id] || {}
              return (
                <li
                  key={r.id}
                  style={{ '--i': idx }}
                  className="rise flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      r.status === 'approved' ? 'bg-lime text-ink' : 'bg-ink/[0.06] text-ink'
                    }`}
                    aria-hidden
                  >
                    {r.patient_name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-bold tracking-[-0.03em] text-ink">{r.patient_name}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {r.patient_phone ? `+91 ${r.patient_phone}` : 'No phone on file'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                      <span>{prettyDate(r.follow_up_date)}</span>
                      <span>{VISIT_LABELS[r.visit_type] || r.visit_type}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{r.message}</p>
                    {action.error && <p className="mt-1 text-sm text-warn">{action.error}</p>}
                  </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    {r.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleSend(r)}
                        disabled={action.loading}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.62_0.15_150)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        {action.loading ? 'Opening…' : 'Send on WhatsApp'}
                      </button>
                    )}
                    {r.status === 'sent' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(r, 'confirmed')}
                          disabled={action.loading}
                          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-accent disabled:opacity-50"
                        >
                          Mark confirmed
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(r, 'missed')}
                          disabled={action.loading}
                          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:border-warn disabled:opacity-50"
                        >
                          Mark missed
                        </button>
                      </>
                    )}
                    {r.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(r, 'visited')}
                          disabled={action.loading}
                          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-accent disabled:opacity-50"
                        >
                          Mark visited
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(r, 'missed')}
                          disabled={action.loading}
                          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:border-warn disabled:opacity-50"
                        >
                          Mark missed
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
