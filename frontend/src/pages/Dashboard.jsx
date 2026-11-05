import { useEffect, useMemo, useState } from 'react'
import { getStats } from '../api.js'

const STAT_TILES = [
  { key: 'reminders_created', label: 'Created', format: fmtCount },
  { key: 'reminders_sent', label: 'Sent', format: fmtCount },
  { key: 'reminders_confirmed', label: 'Confirmed', format: fmtCount },
  { key: 'reminders_visited', label: 'Visited', format: fmtCount },
  { key: 'avg_doctor_seconds', label: 'Avg doctor time', format: fmtSeconds },
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
  { key: 'patientsPerDay', label: 'Patients / day', min: 0, step: 1 },
  { key: 'workingDays', label: 'Working days / month', min: 0, max: 31, step: 1 },
  { key: 'pctNeedingFollowUp', label: '% needing follow-up', min: 0, max: 100, step: 1 },
  { key: 'currentMissRate', label: 'Current miss rate (%)', min: 0, max: 100, step: 1 },
  { key: 'consultFee', label: 'Consult fee (₹)', min: 0, step: 50 },
  { key: 'targetMissRate', label: 'Target miss rate (%)', min: 0, max: 100, step: 1 },
]

function fmtCount(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-IN')
}

function fmtSeconds(n) {
  return n == null ? '—' : `${Math.round(n)}s`
}

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
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">
        How follow-ups are going, and what closing the miss rate is worth.
      </p>

      <div className="mt-5">
        {loading && (
          <div className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-ink-soft">
            Loading stats…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-warn">
            <p>{error}</p>
            <button type="button" onClick={loadStats} className="mt-2 font-medium underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STAT_TILES.map((tile) => (
              <div key={tile.key} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-2xl font-semibold tabular-nums text-ink">{tile.format(stats[tile.key])}</p>
                <p className="mt-1 text-xs text-ink-soft">{tile.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Value calculator</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Edit the numbers for this clinic — the math below updates as you type.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs text-ink-soft">{f.label}</span>
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={inputs[f.key]}
                onChange={(e) => handleInputChange(f.key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setInputs(DEFAULT_INPUTS)}
          className="mt-3 text-xs text-ink-soft underline"
        >
          Reset to defaults
        </button>

        <div className="mt-5 space-y-4 border-t border-line pt-4">
          <div>
            <p className="text-xs text-ink-soft">Follow-ups / month</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{fmtNum(v.followUpsPerMonth)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {fmtNum(v.patientsPerDay)} patients/day × {fmtNum(v.workingDays)} working days/month ×{' '}
              {fmtNum(v.pctNeedingFollowUp)}% need a follow-up
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-soft">Missed follow-ups / month, at today&rsquo;s miss rate</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{fmtNum(v.missedPerMonth)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {fmtNum(v.followUpsPerMonth)} follow-ups/month × {fmtNum(v.currentMissRate)}% miss rate
            </p>
          </div>

          <div>
            <p className="text-xs text-ink-soft">₹ lost / month, at today&rsquo;s miss rate</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{fmtRupee(v.rupeesLostPerMonth)}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {fmtNum(v.missedPerMonth)} missed follow-ups × ₹{fmtNum(v.consultFee)} consult fee
            </p>
          </div>

          <div className="rounded-lg bg-accent-soft p-4">
            <p className="text-xs text-accent-dark">
              ₹ recovered / month if the miss rate drops to {fmtNum(v.targetMissRate)}%
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-accent-dark">
              {fmtRupee(v.rupeesRecoveredPerMonth)}
            </p>
            <p className="mt-1 text-xs text-accent-dark">
              ({fmtNum(v.currentMissRate)}% − {fmtNum(v.targetMissRate)}%) × {fmtNum(v.followUpsPerMonth)}{' '}
              follow-ups/month × ₹{fmtNum(v.consultFee)} = {fmtNum(v.visitsRecoveredPerMonth)} visits recovered/month
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
