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
      .filter((r) => {
        if (filter === 'today') return r.follow_up_date === today
        if (filter === 'week') return r.follow_up_date >= today && r.follow_up_date <= weekEnd
        return true
      })
      .sort((a, b) => (a.follow_up_date || '').localeCompare(b.follow_up_date || ''))
  }, [reminders, filter, today, weekEnd])

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Reception</p>
      <h1 className="display mt-2 text-6xl text-ink sm:text-7xl">
        The <em className="text-accent">queue</em>
      </h1>
      <p className="mt-3 text-base text-ink-soft">Send reminders and track who has confirmed, visited or missed.</p>

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
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-surface">
        {loading && <p className="p-6 text-center text-sm text-ink-soft">Loading the queue…</p>}

        {!loading && error && (
          <div className="p-6 text-center text-sm text-warn">
            <p>{error}</p>
            <button type="button" onClick={loadReminders} className="mt-2 font-medium underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-soft">No follow-ups in this range yet.</p>
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
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-tight text-ink">{r.patient_name}</p>
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

                  <div className="flex flex-shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    {r.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleSend(r)}
                        disabled={action.loading}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.62_0.15_150)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      >
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
