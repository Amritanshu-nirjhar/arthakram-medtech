import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildMessagePreview, resolveFollowUpDate, prettyDate } from '../api.js'
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ShieldIcon } from '../components/Icons.jsx'

const SAMPLE_NOTES = [
  'Ramesh Kumar, review after 2 weeks',
  'Priya Sharma come back Monday with reports',
  'Kavita ko 15 din baad bulao',
  'Sunita Devi follow up 1 month',
  'Meena Gupta report check next friday',
  'Neha routine checkup 3 months',
  'Amit, 1 week',
]

const DEMO_DATE = resolveFollowUpDate(10)
const DEMO_MESSAGE = buildMessagePreview({ firstName: 'Anil', dateISO: DEMO_DATE, visitType: 'follow_up' })

const STEPS = [
  { n: '01', title: 'Speak', body: 'Tap the mic and say one line, the way you would to your assistant. English or Hinglish.' },
  { n: '02', title: 'Extract', body: 'FollowUp pulls out three things only: who, when, what kind of visit. Everything medical is ignored.' },
  { n: '03', title: 'Approve', body: 'One tap. The stopwatch stops. The screen clears for the next patient.' },
  { n: '04', title: 'Send', body: 'Reception taps Send on WhatsApp. The patient gets a plain reminder from a fixed template.' },
]

// Adds `.in` to every [data-reveal] element once it scrolls into view.
function useRevealAll() {
  useEffect(() => {
    // A fully clipped .write heading never "intersects", so it is triggered by its parent instead.
    const targets = new Map()
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      const t = el.classList.contains('write') ? el.parentElement : el
      targets.set(t, [...(targets.get(t) || []), el])
    })
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          ;(targets.get(e.target) || []).forEach((el) => el.classList.add('in'))
          io.unobserve(e.target)
        }),
      { rootMargin: '0px 0px -20% 0px' },
    )
    targets.forEach((_, t) => io.observe(t))
    return () => io.disconnect()
  }, [])
}

// Landing sections are .nb-page sheets: each sticks when its bottom reaches the viewport bottom,
// and while the next sheet slides over it, it tilts back, shrinks and darkens (--cover 0..1).
function useNotebookPages(counterRef) {
  useEffect(() => {
    const pages = [...document.querySelectorAll('.nb-page')]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ro = new ResizeObserver(() => pages.forEach((p) => p.style.setProperty('--h', `${p.offsetHeight}px`)))
    pages.forEach((p) => ro.observe(p))
    let raf = 0
    const update = () => {
      raf = 0
      const vh = window.innerHeight
      let current = 0
      pages.forEach((p, i) => {
        const next = pages[i + 1]
        const cover = next ? Math.min(Math.max((vh - next.getBoundingClientRect().top) / vh, 0), 1) : 0
        p.style.setProperty('--cover', cover.toFixed(3))
        p.style.transform =
          cover > 0 && !reduce
            ? `perspective(1600px) rotateX(${(cover * 8).toFixed(2)}deg) scale(${(1 - cover * 0.06).toFixed(4)})`
            : ''
        if (p.getBoundingClientRect().top < vh * 0.5) current = i
      })
      const c = counterRef.current
      if (c) {
        c.querySelector('[data-n]').textContent = current + 1
        const max = document.documentElement.scrollHeight - vh
        c.style.setProperty('--nb-progress', max > 0 ? (window.scrollY / max).toFixed(3) : 0)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [counterRef])
}

function PageNum({ n }) {
  return (
    <span className="nb-page-num" aria-hidden>
      p. {n}
    </span>
  )
}

export function CountUp({ to, prefix = '', duration = 1400 }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to)
      return
    }
    let raf
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        setValue(to * (1 - Math.pow(1 - t, 4)))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {Math.round(value).toLocaleString('en-IN')}
    </span>
  )
}

function Wave({ className = '' }) {
  return (
    <span className={`wave inline-flex h-7 items-center gap-1 ${className}`} aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} style={{ '--i': i }} />
      ))}
    </span>
  )
}

// The phone mock shows a different screen for each story step.
function Phone({ step, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-[300px] ${className}`}>
      <div className="rounded-[2.6rem] bg-ink p-2.5 elev-2">
        <div className="relative h-[540px] overflow-hidden rounded-[2.1rem] bg-surface">
          <div className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
          <div className="flex items-center justify-between px-6 pt-11 text-[11px] font-medium text-ink-soft">
            <span>{step === 3 ? 'WhatsApp' : 'FollowUp · Doctor'}</span>
            <span className="tabular-nums">{['00:03', '00:06', '00:08', '✓'][step]}</span>
          </div>

          {STEPS.map((_, i) => (
            <div
              key={i}
              className="absolute inset-x-0 bottom-0 top-16 px-5 transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{
                opacity: step === i ? 1 : 0,
                transform: `translateY(${(i - step) * 30}px) scale(${step === i ? 1 : 0.96})`,
              }}
              aria-hidden={step !== i}
            >
              {i === 0 && (
                <div className="flex h-full flex-col items-center pt-10 text-center">
                  <div className="mic-listening flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white">
                    <Wave />
                  </div>
                  <p className="mt-8 label text-ink-soft">Listening</p>
                  <p className="caret hand mt-3 text-[1.7rem] leading-tight text-ink">
                    &ldquo;Anil Verma, BP high, started amlodipine 5mg, review in 10 days&rdquo;
                  </p>
                </div>
              )}
              {i === 1 && (
                <div className="space-y-3 pt-6">
                  {[
                    ['Patient', 'Anil Verma'],
                    ['Follow-up', prettyDate(DEMO_DATE)],
                    ['Visit', 'follow-up visit'],
                  ].map(([k, v], j) => (
                    <div key={k} className="rounded-2xl border border-line p-4" style={{ transitionDelay: `${j * 80}ms` }}>
                      <p className="label text-ink-soft">{k}</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{v}</p>
                    </div>
                  ))}
                  <p className="pt-2 text-center text-xs text-ink-soft">
                    <span className="line-through">BP · amlodipine · 5mg</span> — ignored
                  </p>
                </div>
              )}
              {i === 2 && (
                <div className="flex h-full flex-col justify-end pb-8">
                  <div className="rounded-2xl bg-bg p-4 text-sm leading-relaxed text-ink">{DEMO_MESSAGE}</div>
                  <div className="mt-4 rounded-2xl bg-accent py-4 text-center text-lg font-semibold text-white">
                    Approve
                  </div>
                  <p className="mt-3 text-center text-xs text-ink-soft">8 seconds, mic to approve</p>
                </div>
              )}
              {i === 3 && (
                <div className="-mx-5 flex h-full flex-col bg-[oklch(0.93_0.03_150)] px-4 pt-6">
                  <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[oklch(0.9_0.08_140)] p-3 text-[13px] leading-relaxed text-ink shadow-sm">
                    {DEMO_MESSAGE}
                    <span className="mt-1 block text-right text-[10px] text-ink-soft">10:42 ✓✓</span>
                  </div>
                  <div className="mt-3 max-w-[40%] rounded-2xl rounded-tl-sm bg-surface p-3 text-[13px] text-ink shadow-sm">
                    YES
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StickyStory() {
  const [active, setActive] = useState(0)
  const refs = useRef([])
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number(e.target.dataset.step))),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    refs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section id="how" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-32">
      <p className="label text-ink-soft">How it works</p>
      <h2 data-reveal className="write display mt-4 max-w-3xl h2-size">
        Two taps for the doctor. <em className="text-accent">Zero</em> forms.
      </h2>

      <div className="mt-16 grid gap-10 md:grid-cols-2 md:gap-20">
        <div className="hidden md:block">
          <div className="sticky top-[calc(50vh-280px)] [perspective:1400px]">
            <div className="story-phone" style={{ '--a': active }}>
              <Phone step={active} />
            </div>
            <div className="mt-6 flex justify-center gap-2">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${active === i ? 'w-8 bg-accent' : 'w-1.5 bg-line'}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              ref={(el) => { refs.current[i] = el }}
              data-step={i}
              className="flex min-h-[auto] flex-col justify-center py-10 md:min-h-[80vh]"
            >
              <div className={`transition-opacity duration-500 ${active === i ? 'md:opacity-100' : 'md:opacity-30'}`}>
                <p className="display text-[clamp(4rem,10vw,8rem)] text-accent/25">{s.n}</p>
                <h3 className="-mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{s.title}</h3>
                <p className="mt-4 max-w-sm text-lg leading-relaxed text-ink-soft">{s.body}</p>
              </div>
              <Phone step={i} className="mt-8 md:hidden" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Words of the doctor's spoken note; `strike` marks the medical words the system ignores.
const NOTE_WORDS = [
  ['Anil'],
  ['Verma,'],
  ['BP', true],
  ['high,', true],
  ['started'],
  ['amlodipine', true],
  ['5mg,', true],
  ['review'],
  ['in'],
  ['10'],
  ['days'],
]

// Mouse-only parallax: writes --mx/--my (-1..1) on the hero; .hd-layer reads them.
const PAGE_COUNT = 7

function heroParallax(e) {
  if (e.pointerType !== 'mouse') return
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3))
  e.currentTarget.style.setProperty('--my', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3))
}

function heroParallaxReset(e) {
  e.currentTarget.style.setProperty('--mx', 0)
  e.currentTarget.style.setProperty('--my', 0)
}

// Looping product story: handwritten note -> medical words struck -> 3 fields -> WhatsApp message.
function HeroDemo() {
  let strikeIdx = 0
  return (
    <div className="hd-scene rise relative mx-auto h-[540px] w-full max-w-[540px] sm:h-[580px]" style={{ '--i': 4 }} aria-hidden>
      <div className="hd-stage absolute inset-0">
      {/* 1. the doctor's note */}
      <div className="hd-layer tape absolute left-0 top-0 w-[88%] sm:w-[80%]" style={{ '--z': 0 }}>
        <div
          className="hd-float relative rotate-[-4deg] overflow-hidden rounded-3xl border border-line bg-surface px-6 pb-12 pt-5 elev-2 sm:pl-14"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0 33px, oklch(0.55 0.08 250 / 0.12) 33px 34px)',
            backgroundPosition: '0 22px',
          }}
        >
          <span className="absolute bottom-0 left-9 top-0 hidden w-px bg-accent/35 sm:block" />
          <div className="flex items-baseline justify-between label text-ink-soft">
            <span>
              <span className="font-display text-lg font-extrabold normal-case tracking-tight text-accent">Rx</span>{' '}
              Dr. Sharma · OPD
            </span>
            <span className="font-mono">10:42</span>
          </div>
          <p className="hand mt-3 text-[1.7rem] leading-[34px] text-ink sm:text-[2rem]">
            {NOTE_WORDS.map(([w, strike], i) => (
              <span key={i}>
                <span
                  className={`hd-word${strike ? ' hd-strike' : ''}`}
                  style={{ '--w': i, '--s': strike ? strikeIdx++ : 0 }}
                >
                  {w}
                </span>{' '}
              </span>
            ))}
          </p>
          <span className="hd-stamp absolute bottom-3 right-5 rotate-[-10deg] rounded-md border-2 border-accent px-2.5 py-1 font-display text-xs font-extrabold uppercase tracking-[0.18em] text-accent">
            Approved · 8s
          </span>
        </div>
      </div>

      {/* 2. the only three things extracted */}
      <div className="hd-layer absolute right-0 top-[45%] sm:top-[40%]" style={{ '--z': 130 }}>
        <div className="hd-float flex flex-col items-end gap-2.5" style={{ '--f': 1 }}>
        {[
          ['Patient', 'Anil Verma'],
          ['Date', prettyDate(DEMO_DATE)],
          ['Visit', 'follow-up'],
        ].map(([k, v], i) => (
          <div
            key={k}
            className="hd-chip flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 elev-1"
            style={{ '--c': i, rotate: `${[2, -1.5, 1][i]}deg` }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-ink">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="label text-ink-soft">{k}</span>
            <span className="text-sm font-semibold text-ink">{v}</span>
          </div>
        ))}
        </div>
      </div>

      {/* 3. what the patient actually receives */}
      <div className="hd-layer absolute bottom-0 left-[4%] w-[90%] sm:w-[78%]" style={{ '--z': 70 }}>
        <div className="hd-float" style={{ '--f': 2 }}>
        <div className="hd-msg rotate-[2deg] rounded-3xl border border-line bg-surface p-4 elev-2">
          <div className="flex items-center gap-3 border-b border-line pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[oklch(0.72_0.17_150)] text-xs font-bold text-white">
              SF
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">Sharma Family Clinic</p>
              <p className="text-[11px] text-ink-soft">WhatsApp · just now</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl rounded-tl-sm bg-[oklch(0.93_0.06_140)] px-3.5 py-3 text-[13px] leading-relaxed text-ink">
            {DEMO_MESSAGE}
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-soft">
              10:42
              <svg viewBox="0 0 18 12" className="hd-ticks h-3 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M1 6.5 4.5 10 11 2M7 9l1 1 6.5-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  )
}

const PRICING_ITEMS = [
  'Unlimited reminders',
  'Voice notes in English and Hinglish',
  '3-layer safety, no medical advice ever',
  'Reception queue and dashboard',
  '10-minute setup',
  '1-week free trial',
]

const FAQS = [
  {
    q: 'Is it safe? Can it give medical advice?',
    a: 'No. Three layers make sure of it. The AI only extracts three fields (name, date, visit type) and never writes a sentence. Every message comes from one fixed, pre-approved template. And a final scan blocks doses, medicine names and diagnosis words before anything is saved.',
  },
  {
    q: 'Does it work in Hinglish?',
    a: '“Kavita ko 15 din baad bulao” works just like “review Kavita after 15 days”. Doctors speak the way they already do.',
  },
  {
    q: 'Do patients need an app?',
    a: 'No. They get a plain WhatsApp message from the clinic and can reply YES to confirm or call to reschedule.',
  },
  {
    q: 'What does the doctor actually have to do?',
    a: 'Tap the mic, say one line, tap Approve. Under 15 seconds, no forms, no typing. Reception handles the sending.',
  },
  {
    q: 'What happens to patient data?',
    a: 'It stays on the clinic’s own server. This demo uses fictional patients only.',
  },
]

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-32">
      <div className="grid items-center gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <p data-reveal className="label text-ink-soft">
            Pricing
          </p>
          <h2 data-reveal className="write display mt-4 h2-size text-ink">
            One price. <em>That&rsquo;s it.</em>
          </h2>
          <p data-reveal style={{ '--i': 1 }} className="mt-6 max-w-sm text-lg leading-relaxed text-ink-soft">
            Paid by the clinic, not the patient. One recovered visit is ₹500, so the month is covered after{' '}
            <span className="highlight font-semibold text-ink">two</span>.
          </p>
        </div>

        <div data-reveal style={{ '--i': 2 }} className="tape relative md:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white elev-2 sm:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
            <span
              className="absolute right-6 top-8 rotate-[8deg] rounded-md border-2 border-lime px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-lime sm:right-10"
              aria-hidden
            >
              1 week free
            </span>
            <p className="relative label text-white/50">Per clinic</p>
            <p className="relative mt-3 flex items-baseline gap-2">
              <span className="display text-[clamp(4rem,10vw,6.5rem)] text-lime">₹999</span>
              <span className="text-lg text-white/60">/ month</span>
            </p>
            <p className="hand relative mt-2 text-3xl text-white/90">pays for itself after 2 recovered visits</p>
            <ul className="relative mt-8 grid gap-3 sm:grid-cols-2">
              {PRICING_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
                    <CheckIcon className="h-3 w-3" strokeWidth="3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link viewTransition
              to="/doctor"
              className="group relative mt-10 inline-flex items-center gap-3 rounded-full bg-lime px-7 py-4 font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              Start with the doctor screen
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-6xl px-4 pb-24 sm:px-8 md:pb-32">
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <p data-reveal className="label text-ink-soft">
            Questions
          </p>
          <h2 data-reveal className="write display mt-4 h2-size text-ink">
            Asked <em>often.</em>
          </h2>
          <p data-reveal className="mt-6 flex items-center gap-2 text-ink-soft">
            <ShieldIcon className="h-5 w-5 text-accent" />
            No medical advice, ever.
          </p>
        </div>
        <div className="divide-y divide-line border-y border-line md:col-span-8">
          {FAQS.map((f, i) => (
            <details key={f.q} data-reveal style={{ '--i': i }} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line transition-colors group-open:border-ink group-open:bg-ink group-open:text-white">
                  <ChevronDownIcon className="h-5 w-5 transition-transform duration-300 group-open:rotate-180" />
                </span>
              </summary>
              <p className="max-w-2xl pb-6 pr-14 text-lg leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const links = [
    ['/doctor', 'Doctor'],
    ['/reception', 'Reception'],
    ['/dashboard', 'Dashboard'],
  ]
  return (
    <footer className="relative mt-8 overflow-hidden border-t border-line bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-16 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="hand text-4xl leading-tight text-ink">
            One line from the doctor.
            <br />
            <span className="text-accent">One reminder for the patient.</span>
          </p>
        </div>
        <nav className="md:col-span-3" aria-label="Footer">
          <p className="label text-ink-soft">Screens</p>
          <ul className="mt-4 space-y-2">
            {links.map(([to, label]) => (
              <li key={to}>
                <Link viewTransition to={to} className="group inline-flex min-h-11 items-center gap-2 text-lg font-medium text-ink hover:text-accent">
                  {label}
                  <ArrowRightIcon className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-3">
          <p className="label text-ink-soft">Promise</p>
          <p className="mt-4 text-ink-soft">All patient data is fictional. No medical advice is ever sent.</p>
        </div>
      </div>
      <p
        className="display pointer-events-none mt-10 select-none whitespace-nowrap px-2 text-center text-[clamp(4rem,18vw,16rem)] leading-[0.78] text-ink"
        style={{ marginBottom: '-0.12em' }}
        aria-hidden
      >
        Follow<span className="text-accent">Up</span>
      </p>
    </footer>
  )
}

export default function Home() {
  useRevealAll()
  const heroRef = useRef(null)
  const counterRef = useRef(null)
  useNotebookPages(counterRef)
  useEffect(() => {
    const el = heroRef.current
    const scene = el.querySelector('.hd-scene')
    let raf = 0
    // 0 while the 3D scene sits below the nav, 1 once it has scrolled fully past it
    const update = () => {
      raf = 0
      const r = scene.getBoundingClientRect()
      el.style.setProperty('--sp', Math.min(Math.max((80 - r.top) / r.height, 0), 1).toFixed(3))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="overflow-x-clip">
      <div ref={counterRef} className="nb-counter" aria-hidden>
        <span className="text-2xl leading-none text-ink">
          p. <span data-n>1</span>
        </span>
        <span className="nb-counter-track">
          <span className="nb-counter-fill" />
        </span>
        <span className="text-lg leading-none">/ {PAGE_COUNT}</span>
      </div>

      {/* HERO */}
      <div className="nb-page nb-paper nb-first">
      <section
        ref={heroRef}
        onPointerMove={heroParallax}
        onPointerLeave={heroParallaxReset}
        className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-14 px-4 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10"
      >
        <div className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full bg-accent/15 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full bg-lime/30 blur-[120px]" />

        <div className="relative">
          <p className="rise inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1.5 pl-2.5 pr-4 text-xs font-medium text-ink-soft shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            For Indian clinics · WhatsApp follow-ups
          </p>
          <h1 className="display mt-7 text-[clamp(4rem,14vw,9rem)] text-ink">
            <span className="line">
              <span style={{ '--i': 0 }}>Fifteen</span>
            </span>
            <span className="line">
              <span style={{ '--i': 1 }}>
                <em>seconds.</em>
              </span>
            </span>
          </h1>
          <p className="rise mt-8 max-w-lg text-lg leading-relaxed text-ink-soft sm:text-xl" style={{ '--i': 6 }}>
            The doctor says one line. The patient gets a WhatsApp reminder.{' '}
            <span className="text-ink">No forms, no missed follow-ups.</span>
          </p>
          <div className="rise mt-9 flex flex-wrap gap-3" style={{ '--i': 8 }}>
            <Link viewTransition
              to="/doctor"
              className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-medium text-white elev-1 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="h-2 w-2 rounded-full bg-accent transition-transform group-hover:scale-150" />
              Try the doctor screen
              <span className="transition-transform group-hover:translate-x-1" aria-hidden>
                →
              </span>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center rounded-full border border-ink/15 bg-surface/60 px-7 py-4 text-base font-medium text-ink backdrop-blur transition-colors hover:border-ink"
            >
              See how ↓
            </a>
          </div>
          <ul className="rise mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft" style={{ '--i': 10 }}>
            {['3-layer safety', 'Works in Hinglish', '₹999 / month', 'No forms'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <HeroDemo />
      </section>
      </div>

      {/* MARQUEE + PROBLEM */}
      <div className="nb-page nb-paper">
      <PageNum n={2} />
      <section className="border-y border-line bg-surface py-6" aria-label="Example notes">
        <div className="overflow-hidden">
          <div className="marquee gap-10 pr-10">
            {[...SAMPLE_NOTES, ...SAMPLE_NOTES].map((n, i) => (
              <span key={i} className="flex shrink-0 items-center gap-10 text-4xl text-ink sm:text-5xl">
                <span className="hand">{n}</span>
                <span className="text-2xl text-accent">✱</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-32">
        <div className="grid gap-12 md:grid-cols-12">
          <p data-reveal className="label text-ink-soft md:col-span-3">
            The problem
          </p>
          <div className="md:col-span-9">
            <p data-reveal className="write display h2-size text-ink">
              Notes live on paper. <span className="highlight">Three in ten</span> follow-ups never come back.
            </p>
            <p data-reveal style={{ '--i': 1 }} className="mt-8 max-w-xl text-lg leading-relaxed text-ink-soft">
              The doctor won&rsquo;t touch anything that takes longer than fifteen seconds. So we built the one thing
              that doesn&rsquo;t.
            </p>
          </div>
        </div>
      </section>
      </div>

      <div className="nb-page nb-paper">
        <PageNum n={3} />
        <StickyStory />
      </div>

      {/* SAFETY */}
      <section className="nb-page bg-ink py-24 text-white md:py-32">
        <span className="nb-page-num !text-white/50" aria-hidden>
          p. 4
        </span>
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <p data-reveal className="label text-white/50">
            Safety, by design
          </p>
          <h2 data-reveal className="write display mt-4 max-w-4xl h2-size">
            The AI never writes to your patient.
          </h2>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <div data-reveal className="rounded-3xl border border-white/15 p-7">
              <p className="label text-white/50">What the doctor said</p>
              <p className="hand mt-4 text-4xl leading-snug">
                Anil Verma, <span className="strike">BP high</span>, started{' '}
                <span className="strike" style={{ '--i': 1 }}>
                  amlodipine
                </span>{' '}
                <span className="strike" style={{ '--i': 2 }}>
                  5mg
                </span>
                , review in 10 days
              </p>
            </div>
            <div data-reveal style={{ '--i': 2 }} className="rounded-3xl bg-lime p-7 text-ink">
              <p className="label text-ink/60">What the patient gets</p>
              <p className="mt-4 text-lg leading-relaxed">{DEMO_MESSAGE}</p>
            </div>
          </div>

          <ol className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/15 bg-white/15 md:grid-cols-3">
            {[
              ['Extract only', 'The model returns name, date and visit type. Never a sentence.'],
              ['Fixed template', 'Every message comes from one pre-approved template in code.'],
              ['Final scan', 'Doses, medicine names and diagnosis words are blocked before saving.'],
            ].map(([t, b], i) => (
              <li key={t} data-reveal style={{ '--i': i }} className="bg-ink p-7">
                <p className="display text-5xl text-lime">{i + 1}</p>
                <p className="mt-3 text-lg font-semibold">{t}</p>
                <p className="mt-2 text-white/60">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* NUMBERS */}
      <div className="nb-page nb-paper">
      <PageNum n={5} />
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-32">
        <p data-reveal className="label text-ink-soft">
          One clinic, one month
        </p>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {[
            { to: 520, label: 'follow-ups needed', note: '50 patients/day × 26 days × 40%' },
            { to: 156, label: 'missed today', note: '30% miss rate' },
            { to: 78000, prefix: '₹', label: 'lost every month', note: '× ₹500 consult fee' },
            { to: 39000, prefix: '₹', label: 'recovered', note: 'if misses drop to 15%', hi: true },
          ].map((row, i) => (
            <div
              key={row.label}
              data-reveal
              style={{ '--i': i }}
              className="flip grid items-baseline gap-2 py-8 md:grid-cols-12"
            >
              <p
                className={`display text-[clamp(3.5rem,9vw,8rem)] md:col-span-6 ${row.hi ? 'text-accent' : 'text-ink'}`}
              >
                <CountUp to={row.to} prefix={row.prefix} />
              </p>
              <p className="text-2xl font-medium text-ink md:col-span-3">{row.label}</p>
              <p className="text-ink-soft md:col-span-3 md:text-right">{row.note}</p>
            </div>
          ))}
        </div>
      </section>
      </div>

      <div className="nb-page nb-paper">
        <PageNum n={6} />
        <Pricing />
        <Faq />
      </div>

      {/* CTA */}
      <div className="nb-page nb-paper pt-16">
      <PageNum n={7} />
      <section className="relative overflow-hidden px-4 pb-24 sm:px-8">
        <div
          data-reveal
          className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-8 py-20 text-white md:px-16 md:py-28"
        >
          <div className="drift pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full border-[40px] border-accent/40" />
          <h2 className="display relative max-w-3xl h2-size">Next patient?</h2>
          <div className="relative mt-10 flex flex-wrap gap-3">
            <Link viewTransition
              to="/doctor"
              className="rounded-full bg-lime px-7 py-4 font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              Doctor screen
            </Link>
            <Link viewTransition
              to="/reception"
              className="rounded-full border border-white/30 px-7 py-4 font-medium transition-colors hover:border-white"
            >
              Reception queue
            </Link>
            <Link viewTransition
              to="/dashboard"
              className="rounded-full border border-white/30 px-7 py-4 font-medium transition-colors hover:border-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      </div>
    </div>
  )
}
