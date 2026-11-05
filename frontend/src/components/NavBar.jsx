import { NavLink } from 'react-router-dom'

const links = [
  { to: '/doctor', label: 'Doctor' },
  { to: '/reception', label: 'Reception' },
  { to: '/dashboard', label: 'Dashboard' },
]

export default function NavBar() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-[1.05rem] font-semibold text-ink">FollowUp</span>
        <nav className="flex gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-soft text-accent-dark' : 'text-ink-soft hover:bg-bg hover:text-ink'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
