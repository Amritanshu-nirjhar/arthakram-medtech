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
  { key: 'patientsPerDay', label: 'Patients / day', min: 0, step: 1 },
  { key: 'workingDays', label: 'Working days / month', min: 0, max: 31, step: 1 },
  { key: 'pctNeedingFollowUp', label: '% needing follow-up', min: 0, max: 100, step: 1 },
  { key: 'currentMissRate', label: 'Current miss rate (%)', min: 0, max: 100, step: 1 },
  { key: 'consultFee', label: 'Consult fee (₹)', min: 0, step: 50 },
  { key: 'targetMissRate', label: 'Target miss rate (%)', min: 0, max: 100, step: 1 },
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
      <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Dashboard</p>
      <h1 className="display mt-2 text-6xl text-ink sm:text-7xl">
        How it&rsquo;s <em className="text-accent">going</em>
      </h1>
      <p className="mt-3 text-base text-ink-soft">
        How follow-ups are going, and what closing the miss rate is worth.
      </p>

      <div className="mt-8">
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
            {STAT_TILES.map((tile, i) => (
              <div
                key={tile.key}
                style={{ '--i': i }}
                className={`rise rounded-3xl border p-5 ${i === 4 ? 'border-transparent bg-lime' : 'border-line bg-surface'}`}
              >
                <p className="display text-5xl text-ink">
                  {stats[tile.key] == null ? '—' : <CountUp to={stats[tile.key]} />}
                  {tile.key === 'avg_doctor_seconds' && stats[tile.key] != null && <span className="text-3xl">s</span>}
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.15em] text-ink-soft">{tile.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="display text-4xl text-ink">Value calculator</h2>
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
                className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
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
            <p className="text-xs uppercase tracking-[0.15em] text-white/60">
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
