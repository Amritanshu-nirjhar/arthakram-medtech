const STATUS_STYLES = {
  approved: { label: 'Approved', className: 'border border-line text-ink-soft' },
  sent: { label: 'Sent', className: 'bg-accent-soft text-accent-dark' },
  confirmed: { label: 'Confirmed', className: 'bg-accent text-white' },
  visited: { label: 'Visited', className: 'bg-ink text-white' },
  missed: { label: 'Missed', className: 'bg-warn-soft text-warn' },
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { label: status, className: 'border border-line text-ink-soft' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  )
}
