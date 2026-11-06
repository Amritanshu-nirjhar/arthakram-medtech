import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const links = [
  { to: '/doctor', label: 'Doctor' },
  { to: '/reception', label: 'Reception' },
  { to: '/dashboard', label: 'Dashboard' },
]

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-300 sm:px-4 ${
          scrolled ? 'border border-line bg-surface/80 shadow-sm backdrop-blur-md' : 'border border-transparent'
        }`}
      >
        <Link to="/" className="flex items-center gap-2 pl-2 text-ink">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="hidden font-display text-xl font-extrabold tracking-[-0.04em] min-[420px]:inline">
            Follow<span className="text-accent">Up</span>
          </span>
        </Link>
        <nav className="flex gap-0.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                  isActive ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
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
