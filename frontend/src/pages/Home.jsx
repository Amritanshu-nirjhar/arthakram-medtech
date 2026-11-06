import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildMessagePreview, resolveFollowUpDate, prettyDate } from '../api.js'

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
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.2 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
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
      <div className="rounded-[2.6rem] bg-ink p-2.5 shadow-[0_40px_80px_-30px_oklch(0.22_0.035_265/0.5)]">
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
                  <p className="mt-8 text-xs uppercase tracking-[0.2em] text-ink-soft">Listening</p>
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
                      <p className="text-[11px] uppercase tracking-[0.15em] text-ink-soft">{k}</p>
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
    <section id="how" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-40">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">How it works</p>
      <h2 className="display mt-4 max-w-3xl text-[clamp(2.8rem,7vw,6rem)]">
        Two taps for the doctor. <em className="text-accent">Zero</em> forms.
      </h2>

      <div className="mt-16 grid gap-10 md:grid-cols-2 md:gap-20">
        <div className="hidden md:block">
          <div className="sticky top-[calc(50vh-280px)]">
            <Phone step={active} />
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

export default function Home() {
  useRevealAll()

  return (
    <div className="overflow-x-clip">
      <div className="scroll-progress" aria-hidden />

      {/* HERO */}
      <section className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-4 pb-16 pt-10 sm:px-8">
        <div className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full bg-accent/15 blur-[120px]" />
        <p className="rise text-xs uppercase tracking-[0.25em] text-ink-soft">
          For busy clinics · WhatsApp follow-ups
        </p>
        <h1 className="display mt-6 text-[clamp(4.2rem,15vw,13rem)] text-ink">
          <span className="line">
            <span style={{ '--i': 0 }}>Fifteen</span>
          </span>
          <span className="line">
            <span style={{ '--i': 1 }}>
              <em className="text-accent">seconds.</em>
            </span>
          </span>
        </h1>
        <p
          className="hand rise pointer-events-none absolute right-8 top-[38%] hidden rotate-[-6deg] text-4xl leading-none text-accent lg:block"
          style={{ '--i': 5 }}
          aria-hidden
        >
          one line,
          <br />
          two taps.
          <svg viewBox="0 0 120 60" className="mt-2 h-14 w-28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M110 8 C 80 10, 40 20, 14 48" />
            <path d="M14 48 L 16 30 M14 48 L 32 44" />
          </svg>
        </p>
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="rise max-w-md text-lg leading-relaxed text-ink-soft sm:text-xl" style={{ '--i': 6 }}>
            The doctor says one line. The patient gets a WhatsApp reminder. Nobody fills a form, and nobody forgets a
            follow-up again.
          </p>
          <div className="rise flex flex-wrap gap-3" style={{ '--i': 8 }}>
            <Link
              to="/doctor"
              className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-medium text-white transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="h-2 w-2 rounded-full bg-accent transition-transform group-hover:scale-150" />
              Try the doctor screen
            </Link>
            <a
              href="#how"
              className="inline-flex items-center rounded-full border border-ink/20 px-7 py-4 text-base font-medium text-ink transition-colors hover:border-ink"
            >
              See how ↓
            </a>
          </div>
        </div>
      </section>

      {/* MARQUEE of real test notes */}
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
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-40">
        <div className="grid gap-12 md:grid-cols-12">
          <p data-reveal className="text-xs uppercase tracking-[0.25em] text-ink-soft md:col-span-3">
            The problem
          </p>
          <div className="md:col-span-9">
            <p data-reveal className="display text-[clamp(2.4rem,5.5vw,4.8rem)] text-ink">
              Notes live on paper. <span className="highlight">Three in ten</span> follow-ups never come back.
            </p>
            <p data-reveal style={{ '--i': 1 }} className="mt-8 max-w-xl text-lg leading-relaxed text-ink-soft">
              The doctor won&rsquo;t touch anything that takes longer than fifteen seconds. So we built the one thing
              that doesn&rsquo;t.
            </p>
          </div>
        </div>
      </section>

      <StickyStory />

      {/* SAFETY */}
      <section className="bg-ink py-24 text-white md:py-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <p data-reveal className="text-xs uppercase tracking-[0.25em] text-white/50">
            Safety, by design
          </p>
          <h2 data-reveal className="display mt-4 max-w-4xl text-[clamp(2.8rem,7vw,6rem)]">
            The AI never writes to your patient.
          </h2>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <div data-reveal className="rounded-3xl border border-white/15 p-7">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">What the doctor said</p>
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
              <p className="text-xs uppercase tracking-[0.2em] text-ink/60">What the patient gets</p>
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
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 md:py-40">
        <p data-reveal className="text-xs uppercase tracking-[0.25em] text-ink-soft">
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
              className="grid items-baseline gap-2 py-8 md:grid-cols-12"
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
        <p data-reveal className="mt-8 text-lg text-ink-soft">
          ₹999 a month. Pays for itself after <span className="font-semibold text-ink">two</span> recovered visits.
        </p>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-4 pb-24 sm:px-8">
        <div
          data-reveal
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-ink px-8 py-20 text-white md:px-16 md:py-28"
        >
          <div className="drift pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full border-[40px] border-accent/40" />
          <h2 className="display relative max-w-3xl text-[clamp(3rem,8vw,7rem)]">Next patient?</h2>
          <div className="relative mt-10 flex flex-wrap gap-3">
            <Link
              to="/doctor"
              className="rounded-full bg-lime px-7 py-4 font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              Doctor screen
            </Link>
            <Link
              to="/reception"
              className="rounded-full border border-white/30 px-7 py-4 font-medium transition-colors hover:border-white"
            >
              Reception queue
            </Link>
            <Link
              to="/dashboard"
              className="rounded-full border border-white/30 px-7 py-4 font-medium transition-colors hover:border-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-sm text-ink-soft">
          FollowUp · Hackathon build · All patient data is fictional. No medical advice is ever sent.
        </p>
      </section>
    </div>
  )
}
