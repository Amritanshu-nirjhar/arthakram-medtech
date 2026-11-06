import { useEffect, useMemo, useState } from 'react'
import { getStats } from '../api.js'
import { CountUp } from './Home.jsx'

const STAT_TILES = [
  { key: 'total_reminders', label: 'Created' },
  { key: 'sent', label: 'Sent' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'visited', label: 'Visited' },
  { key: 'avg_doctor_seconds', label: 'Avg doctor time' },
]

const DEFAULT_INPUTS = {
  patientsPerDay: 50,
  workingDays: 26,
  pctNeedingFollowUp: 40,
  currentMissRate: 30,
  consultFee: 500,
  targetMissRate: 15,
}

const FIELDS = [
  { key: 'patientsPerDay', label: 'Patients / day', min: 0, max: 200, step: 1 },
  { key: 'workingDays', label: 'Working days / month', min: 0, max: 31, step: 1 },
  { key: 'pctNeedingFollowUp', label: '% needing follow-up', min: 0, max: 100, step: 1 },
  { key: 'currentMissRate', label: 'Current miss rate (%)', min: 0, max: 100, step: 1 },
  { key: 'consultFee', label: 'Consult fee (₹)', min: 0, max: 3000, step: 50 },
  { key: 'targetMissRate', label: 'Target miss rate (%)', min: 0, max: 100, step: 1 },
]

// Current-status breakdown (each reminder counted once, in its present status).
const STATUS_SEGMENTS = [
  { key: 'approved', label: 'Waiting to send', className: 'bg-line' },
  { key: 'sent', label: 'Sent', className: 'bg-[oklch(0.8_0.07_250)]' },
  { key: 'confirmed', label: 'Confirmed', className: 'bg-lime' },
  { key: 'visited', label: 'Visited', className: 'bg-ink' },
  { key: 'missed', label: 'Missed', className: 'bg-accent' },
]

function fmtNum(n) {
  return Math.round(n).toLocaleString('en-IN')
}

function fmtRupee(n) {
  return `₹${fmtNum(n)}`
}

function numOr(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function computeValue(inputs) {
  const patientsPerDay = numOr(inputs.patientsPerDay)
  const workingDays = numOr(inputs.workingDays)
  const pctNeedingFollowUp = numOr(inputs.pctNeedingFollowUp)
  const currentMissRate = numOr(inputs.currentMissRate)
  const consultFee = numOr(inputs.consultFee)
  const targetMissRate = numOr(inputs.targetMissRate)

  const followUpsPerMonth = patientsPerDay * workingDays * (pctNeedingFollowUp / 100)
  const missedPerMonth = followUpsPerMonth * (currentMissRate / 100)
  const rupeesLostPerMonth = missedPerMonth * consultFee
  const missRateDrop = Math.max(currentMissRate - targetMissRate, 0)
  const visitsRecoveredPerMonth = (missRateDrop / 100) * followUpsPerMonth
  const rupeesRecoveredPerMonth = visitsRecoveredPerMonth * consultFee

  return {
    patientsPerDay,
    workingDays,
    pctNeedingFollowUp,
    currentMissRate,
    consultFee,
    targetMissRate,
    followUpsPerMonth,
    missedPerMonth,
    rupeesLostPerMonth,
    missRateDrop,
    visitsRecoveredPerMonth,
    rupeesRecoveredPerMonth,
  }
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)

  async function loadStats() {
    setLoading(true)
    setError(null)
    try {
      const data = await getStats()
      setStats(data)
    } catch (err) {
      setError(err.message || 'Could not load stats.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  function handleInputChange(key, raw) {
    setInputs((prev) => ({ ...prev, [key]: raw === '' ? '' : Number(raw) }))
  }

  const v = useMemo(() => computeValue(inputs), [inputs])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <p className="nb-tab">Clinic · Dashboard</p>
      <h1 className="display mt-3 text-5xl text-ink sm:text-6xl">
        How it&rsquo;s <em className="text-accent">going</em>
      </h1>
      <p className="mt-3 text-base text-ink-soft">
        How follow-ups are going, and what closing the miss rate is worth.
      </p>

      <div className="mt-8">
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Loading stats">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`rounded-3xl border border-line bg-surface p-5 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}>
                <div className="h-10 w-14 animate-pulse rounded-2xl bg-line" />
                <div className="mt-3 h-3 w-20 animate-pulse rounded-full bg-line" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-line bg-surface p-6 text-center text-sm text-warn">
            <p>{error}</p>
            <button type="button" onClick={loadStats} className="mt-2 font-medium underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STAT_TILES.map((tile, i) => (
              <div
                key={tile.key}
                style={{ '--i': i }}
                className={`rise scroll-rise rounded-3xl border p-5 ${i === 4 ? 'col-span-2 border-transparent bg-lime sm:col-span-1' : 'border-line bg-surface'}`}
              >
                <p className="display text-5xl text-ink">
                  {stats[tile.key] == null ? '—' : <CountUp to={stats[tile.key]} />}
                  {tile.key === 'avg_doctor_seconds' && stats[tile.key] != null && <span className="text-3xl">s</span>}
                </p>
                <p className="mt-2 label text-ink-soft">{tile.label}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && stats?.total_reminders > 0 && (
          <div className="rise scroll-rise mt-4 rounded-3xl border border-line bg-surface p-5 sm:p-6" style={{ '--i': 5 }}>
            <p className="label text-ink-soft">Where every reminder is now</p>
            <div className="mt-4 flex h-4 gap-1 overflow-hidden rounded-full">
              {STATUS_SEGMENTS.filter((seg) => stats[seg.key] > 0).map((seg) => (
                <div
                  key={seg.key}
                  className={`${seg.className} rounded-full transition-[flex-grow] duration-700`}
                  style={{ flexGrow: stats[seg.key] }}
                  title={`${seg.label}: ${stats[seg.key]}`}
                />
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              {STATUS_SEGMENTS.map((seg) => (
                <li key={seg.key} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.className}`} />
                  {seg.label} <span className="font-semibold tabular-nums text-ink">{stats[seg.key] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="scroll-rise elev-1 mt-10 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="display text-4xl text-ink">Value calculator</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Edit the numbers for this clinic — the math below updates as you type.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block rounded-2xl bg-bg p-4">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink-soft">{f.label}</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{fmtNum(numOr(inputs[f.key]))}</span>
              </span>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={inputs[f.key]}
                onChange={(e) => handleInputChange(f.key, e.target.value)}
                className="mt-3 w-full accent-[var(--color-accent)]"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setInputs(DEFAULT_INPUTS)}
          className="mt-2 inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Reset to defaults
        </button>

        <div className="mt-5 space-y-4 border-t border-line pt-4">
          <div>
            <p className="text-xs text-ink-soft">Follow-ups / month</p>
            <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-ink">{fmtNum(v.followUpsPerMonth)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {fmtNum(v.patientsPerDay)} patients/day × {fmtNum(v.workingDays)} working days/month ×{' '}
              {fmtNum(v.pctNeedingFollowUp)}% need a follow-up
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-soft">Missed follow-ups / month, at today&rsquo;s miss rate</p>
            <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-ink">{fmtNum(v.missedPerMonth)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {fmtNum(v.followUpsPerMonth)} follow-ups/month × {fmtNum(v.currentMissRate)}% miss rate
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-soft">₹ lost / month, at today&rsquo;s miss rate</p>
            <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-ink">{fmtRupee(v.rupeesLostPerMonth)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {fmtNum(v.missedPerMonth)} missed follow-ups × ₹{fmtNum(v.consultFee)} consult fee
            </p>
          </div>

          <div className="rounded-3xl bg-ink p-6 text-white">
            <p className="label text-white/60">
              ₹ recovered / month if the miss rate drops to {fmtNum(v.targetMissRate)}%
            </p>
            <p className="display mt-2 text-6xl tabular-nums text-lime sm:text-7xl">
              {fmtRupee(v.rupeesRecoveredPerMonth)}
            </p>
            <p className="mt-2 text-xs text-white/60">
              ({fmtNum(v.currentMissRate)}% − {fmtNum(v.targetMissRate)}%) × {fmtNum(v.followUpsPerMonth)}{' '}
              follow-ups/month × ₹{fmtNum(v.consultFee)} = {fmtNum(v.visitsRecoveredPerMonth)} visits recovered/month
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
