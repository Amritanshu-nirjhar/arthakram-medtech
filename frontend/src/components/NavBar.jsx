import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const links = [
  { to: '/doctor', label: 'Doctor' },
  { to: '/reception', label: 'Reception' },
  { to: '/dashboard', label: 'Dashboard' },
]

export default function NavBar() {
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef(null)
  const [pill, setPill] = useState(null) // { left, width } of the active link

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Slide the dark pill under whichever link is active.
  useLayoutEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector('a[aria-current="page"]')
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pathname])

  return (
    <header className="site-nav sticky top-0 z-40 px-3 pt-3">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-300 sm:px-4 ${
          scrolled ? 'border border-line bg-surface/80 shadow-sm backdrop-blur-md' : 'border border-transparent'
        }`}
      >
        <Link to="/" viewTransition className="flex min-h-11 items-center gap-2 pl-2 text-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="hidden font-display text-xl font-extrabold tracking-[-0.04em] min-[420px]:inline">
            Follow<span className="text-accent">Up</span>
          </span>
        </Link>
        <nav ref={navRef} className="relative flex gap-0.5">
          <span
            aria-hidden
            className="absolute inset-y-0 rounded-full bg-ink transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
            style={pill ? { left: pill.left, width: pill.width, opacity: 1 } : { left: 0, width: 0, opacity: 0 }}
          />
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              viewTransition
              className={({ isActive }) =>
                `relative inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors duration-300 sm:px-4 ${
                  isActive ? 'text-white' : 'text-ink-soft hover:text-ink'
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
