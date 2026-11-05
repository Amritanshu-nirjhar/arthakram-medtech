export default function Dashboard() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Coming in the next build step.</p>

      <div className="mt-5 rounded-xl border border-line bg-surface p-6 text-sm text-ink-soft">
        <p>This page will show:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Reminders created, sent, confirmed and visited</li>
          <li>Average doctor seconds per note</li>
          <li>A value calculator with editable assumptions</li>
        </ul>
      </div>
    </div>
  )
}
