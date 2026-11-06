import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DATE_CHIP_OPTIONS,
  VISIT_LABELS,
  approveReminder,
  deleteReminder,
  getHealth,
  transcribeAudio,
  parseNote,
  previewMessage,
  prettyDate,
  resolveFollowUpDate,
  searchPatients,
} from '../api.js'
import { CheckIcon, TimerIcon } from '../components/Icons.jsx'
import Spinner from '../components/Spinner.jsx'
import Toast from '../components/Toast.jsx'

function getSpeechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// Plain-language fix for each Web Speech failure, so the demo never dies on "a problem".
const SPEECH_ERRORS = {
  'no-speech': "Didn't catch that. Tap the mic and speak right away.",
  'not-allowed':
    'Mic is blocked. Click the icon left of the address bar, allow Microphone, then reload. On a Mac also check System Settings → Privacy → Microphone.',
  'service-not-allowed':
    'Speech service is off. In Safari turn on Dictation (System Settings → Keyboard), or use Google Chrome.',
  network: "This browser has no speech service (Brave, Arc and some Chromium builds). Use Google Chrome, or type below.",
  'audio-capture': 'No microphone found. Plug one in or check your sound input settings.',
  'language-not-supported': 'This browser does not support Indian English voice. Use Google Chrome.',
}

function micBlockedReason(serverStt) {
  if (!window.isSecureContext)
    return 'The mic only works on a secure link. Open this page on https:// (run npm run dev:phone) or on localhost.'
  if (serverStt) return navigator.mediaDevices && window.MediaRecorder ? null : "This browser can't record audio. Type the note below."
  if (!getSpeechRecognitionClass()) return "This browser can't do voice input. Use Google Chrome or Safari, or type below."
  return null
}

const SILENCE_STOP_MS = 1300 // stop this long after the doctor stops talking
const MAX_RECORD_MS = 12000
const SPEECH_LEVEL = 0.06 // mic RMS above this counts as speech

function MicIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

const EXAMPLE_NOTES = ['Ramesh Kumar, review after 2 weeks', 'Kavita ko 15 din baad bulao', 'Amit, 1 week']
const LIMIT_MS = 15000
const RING_R = 84
const RING_C = 2 * Math.PI * RING_R

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Doctor() {
  // true = record + transcribe on our server (works in any browser); false = browser Web Speech
  const [serverStt, setServerStt] = useState(null)
  const blockedReason = micBlockedReason(serverStt)
  const speechSupported = !blockedReason
  const [isListening, setIsListening] = useState(false)
  const [heardVoice, setHeardVoice] = useState(false)
  const micBtnRef = useRef(null)
  const recorderRef = useRef(null)
  const [speechError, setSpeechError] = useState(null)
  const [noteText, setNoteText] = useState('')

  // 'idle' | 'parsing' | 'ready' | 'no_follow_up' | 'error'
  const [status, setStatus] = useState('idle')
  const [parseError, setParseError] = useState(null)
  const [result, setResult] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedVisitType, setSelectedVisitType] = useState(null)

  // Message text shown in the preview card. Always comes from the server:
  // /notes/parse's message_preview, or /messages/preview once the doctor
  // resolves an ambiguous patient / missing date. Never built in the browser.
  const [previewText, setPreviewText] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewNote, setPreviewNote] = useState(null)

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState(null)
  // { id, name, snap } of the reminder just approved, while Undo is offered
  const [lastSaved, setLastSaved] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const undoTimerRef = useRef(null)
  const [stampSeconds, setStampSeconds] = useState(null) // non-null while the APPROVED stamp shows

  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAtRef = useRef(null)
  const tickRef = useRef(null)
  const recognitionRef = useRef(null)
  const latestTranscriptRef = useRef('')
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    getHealth()
      .then((h) => setServerStt(!!h?.stt))
      .catch(() => setServerStt(false))
  }, [])

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      recognitionRef.current?.abort?.()
      recorderRef.current?.stop()
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  function startTimerIfNeeded() {
    if (startedAtRef.current != null) return
    startedAtRef.current = Date.now()
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 250)
  }

  function stopTimer() {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  function handleMicTap() {
    if (isListening) {
      recorderRef.current?.stop()
      recognitionRef.current?.stop()
      return
    }
    if (serverStt) recordAndTranscribe()
    else startBrowserSpeech()
  }

  // Record with MediaRecorder, auto-stop on silence, transcribe on the backend.
  async function recordAndTranscribe() {
    setSpeechError(null)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (err) {
      setSpeechError(err.name === 'NotFoundError' ? SPEECH_ERRORS['audio-capture'] : SPEECH_ERRORS['not-allowed'])
      return
    }
    startTimerIfNeeded()
    setNoteText('')
    setHeardVoice(false)

    const chunks = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

    // Level meter: drives the glow around the mic, and stops recording after a pause.
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    const startedAt = performance.now()
    let spoke = false
    let lastLoud = startedAt
    let raf
    const tick = () => {
      analyser.getFloatTimeDomainData(buf)
      const rms = Math.sqrt(buf.reduce((a, v) => a + v * v, 0) / buf.length)
      micBtnRef.current?.style.setProperty('--level', Math.min(rms * 6, 1).toFixed(3))
      const now = performance.now()
      if (rms > SPEECH_LEVEL) {
        lastLoud = now
        if (!spoke) {
          spoke = true
          setHeardVoice(true)
        }
      }
      const silentFor = now - lastLoud
      if ((spoke && silentFor > SILENCE_STOP_MS) || now - startedAt > MAX_RECORD_MS) {
        if (recorder.state === 'recording') recorder.stop()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    recorder.onstop = async () => {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      ctx.close()
      micBtnRef.current?.style.setProperty('--level', 0)
      recorderRef.current = null
      setIsListening(false)
      if (!spoke) {
        setSpeechError(
          "Didn't hear anything. Check your Mac's input mic (System Settings → Sound → Input) and speak right after tapping.",
        )
        return
      }
      setStatus('parsing')
      try {
        const text = await transcribeAudio(new Blob(chunks, { type: recorder.mimeType }))
        if (!text) {
          setStatus('idle')
          setSpeechError("Couldn't make out any words. Try again a little closer to the mic.")
          return
        }
        setNoteText(text)
        submitNote(text)
      } catch (err) {
        if (err.status === 503) setServerStt(false) // server can't transcribe: fall back to browser speech
        setStatus('idle')
        setSpeechError(err.message)
      }
    }

    recorder.start()
    setIsListening(true)
    raf = requestAnimationFrame(tick)
  }

  function startBrowserSpeech() {
    const SpeechRecognition = getSpeechRecognitionClass()
    if (!SpeechRecognition) return

    startTimerIfNeeded()
    setSpeechError(null)
    setNoteText('')
    latestTranscriptRef.current = ''

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    let finalText = ''
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += transcript
        else interim += transcript
      }
      const combined = `${finalText} ${interim}`.trim()
      latestTranscriptRef.current = combined
      setNoteText(combined)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === 'aborted') return
      setSpeechError(SPEECH_ERRORS[event.error] || `Voice input failed (${event.error}). Type the note below.`)
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      const text = latestTranscriptRef.current.trim()
      if (text) submitNote(text)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setSpeechError('Voice input is still busy. Wait a second and tap again.')
    }
  }

  function handleTextChange(e) {
    setNoteText(e.target.value)
    startTimerIfNeeded()
  }

  async function submitNote(textOverride) {
    const trimmed = (textOverride ?? noteText).trim()
    if (!trimmed) return
    setStatus('parsing')
    setParseError(null)
    try {
      const data = await parseNote(trimmed)
      setResult(data)
      if (data.no_follow_up) {
        setStatus('no_follow_up')
      } else {
        setCandidates(data.candidates || [])
        setSelectedPatientId(data.candidates?.length === 1 ? data.candidates[0].id : null)
        setSelectedDate(data.follow_up_date || null)
        setSelectedVisitType(data.visit_type || null)
        setPreviewText(data.message_preview || null)
        setPreviewNote(null)
        setStatus('ready')
      }
    } catch (err) {
      setParseError(err.message || 'Something went wrong — try again.')
      setStatus('error')
    }
  }

  function handleSearchChange(value) {
    setSearchQuery(value)
    setSearchError(null)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchPatients(value)
        setSearchResults(results)
      } catch (err) {
        setSearchError(err.message || "Couldn't search right now.")
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  // Server-rendered message for (patient, date, visit type) once the doctor
  // resolves an ambiguity or missing date. Never blocks Approve: on failure it
  // only shows a quiet note, because the server renders the real message on save.
  async function refreshPreview(patientId, dateISO, visitType) {
    if (!patientId || !dateISO || !visitType) return
    setPreviewLoading(true)
    setPreviewNote(null)
    try {
      const data = await previewMessage({ patient_id: patientId, follow_up_date: dateISO, visit_type: visitType })
      setPreviewText(data.message || null)
    } catch {
      setPreviewNote('Preview unavailable right now. The message will still be correct when you approve.')
    } finally {
      setPreviewLoading(false)
    }
  }

  function selectPatientChip(patientId) {
    setSelectedPatientId(patientId)
    refreshPreview(patientId, selectedDate, selectedVisitType)
  }

  function selectDateChip(days) {
    const dateISO = resolveFollowUpDate(days)
    setSelectedDate(dateISO)
    refreshPreview(selectedPatientId, dateISO, selectedVisitType)
  }

  function pickSearchedPatient(patient) {
    setCandidates((prev) => [patient, ...prev.filter((p) => p.id !== patient.id)])
    setSelectedPatientId(patient.id)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    refreshPreview(patient.id, selectedDate, selectedVisitType)
  }

  function resetAll() {
    stopTimer()
    startedAtRef.current = null
    setElapsedMs(0)
    setNoteText('')
    setStatus('idle')
    setResult(null)
    setCandidates([])
    setSelectedPatientId(null)
    setSelectedDate(null)
    setSelectedVisitType(null)
    setPreviewText(null)
    setPreviewLoading(false)
    setPreviewNote(null)
    setParseError(null)
    setApproveError(null)
    setSpeechError(null)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
  }

  const selectedPatient = useMemo(
    () => candidates.find((c) => c.id === selectedPatientId) || null,
    [candidates, selectedPatientId],
  )

  const canApprove =
    status === 'ready' && !!selectedPatient && !!selectedDate && !!selectedVisitType && !approving && stampSeconds == null

  async function handleApprove() {
    if (!canApprove) return
    setApproving(true)
    setApproveError(null)
    try {
      const doctorSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0
      const saved = await approveReminder({
        patient_id: selectedPatient.id,
        follow_up_date: selectedDate,
        visit_type: selectedVisitType,
        doctor_seconds: doctorSeconds,
      })
      const snap = { noteText, result, candidates, selectedPatientId, selectedDate, selectedVisitType, previewText }
      const name = selectedPatient.name
      stopTimer()
      setStampSeconds(doctorSeconds) // red APPROVED stamp thuds onto the card
      navigator.vibrate?.(35)
      setTimeout(() => {
        setStampSeconds(null)
        resetAll() // then clear for the next patient
        showToastFor({ id: saved?.id, name, snap }, 5000)
      }, 850)
    } catch (err) {
      setApproveError(err.message || 'Could not save — try again.')
    } finally {
      setApproving(false)
    }
  }

  function showToastFor(saved, ms, msg = null) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setLastSaved(saved)
    setToastMsg(msg)
    undoTimerRef.current = setTimeout(() => {
      setLastSaved(null)
      setToastMsg(null)
    }, ms)
  }

  async function handleUndo() {
    const saved = lastSaved
    if (!saved?.id) return
    try {
      await deleteReminder(saved.id)
      const { snap } = saved
      setNoteText(snap.noteText)
      setResult(snap.result)
      setCandidates(snap.candidates)
      setSelectedPatientId(snap.selectedPatientId)
      setSelectedDate(snap.selectedDate)
      setSelectedVisitType(snap.selectedVisitType)
      setPreviewText(snap.previewText)
      setStatus('ready')
      startTimerIfNeeded()
      showToastFor(null, 1800, 'Undone, fix and approve again')
    } catch (err) {
      showToastFor(null, 2500, err.message || 'Could not undo')
    }
  }

  function tryExample(text) {
    setNoteText(text)
    startTimerIfNeeded()
    submitNote(text)
  }

  const ringProgress = Math.min(elapsedMs / LIMIT_MS, 1)
  const overLimit = elapsedMs > LIMIT_MS

  return (
    <div className="min-h-screen pb-36">
      <Toast
        show={!!lastSaved || !!toastMsg}
        message={toastMsg || `Saved · ${lastSaved?.name || ''}`}
        success={!toastMsg || toastMsg.startsWith('Undone')}
        action={lastSaved ? { label: 'Undo', onClick: handleUndo } : null}
      />

      <div className="mx-auto max-w-md px-4 pt-6">
        <div className="flex flex-col items-center gap-4 pb-8 pt-4 text-center">
          <p className="nb-tab">OPD · Doctor</p>
          <h1 className="display text-5xl text-ink sm:text-6xl">
            Next <em className="text-accent">patient</em>
          </h1>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-mono text-sm tabular-nums transition-colors ${
              elapsedMs > 0 ? (elapsedMs > 15000 ? 'bg-accent text-white' : 'bg-lime text-ink') : 'bg-surface text-ink-soft'
            }`}
            aria-label="Stopwatch"
          >
            <TimerIcon className="h-4 w-4" />
            {formatElapsed(elapsedMs)}
          </div>
          <div className="relative flex h-48 w-48 items-center justify-center">
          <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 192 192" aria-hidden>
            <circle cx="96" cy="96" r={RING_R} fill="none" strokeWidth="5" className="stroke-line" />
            <circle
              cx="96"
              cy="96"
              r={RING_R}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - ringProgress)}
              className={`transition-[stroke-dashoffset] duration-300 ease-linear ${overLimit ? 'stroke-accent' : 'stroke-ink'}`}
            />
          </svg>
          <button
            ref={micBtnRef}
            type="button"
            onClick={handleMicTap}
            aria-label={isListening ? 'Stop listening' : 'Start voice note'}
            style={{
              boxShadow:
                '0 0 0 calc(var(--level, 0) * 44px) oklch(0.53 0.2 30 / 0.22), 0 20px 50px -15px oklch(0.53 0.2 30 / 0.7)',
            }}
            disabled={!speechSupported}
            aria-pressed={isListening}
            className={`relative flex h-36 w-36 items-center justify-center rounded-full text-white transition-all duration-300 hover:scale-105 active:scale-95 ${
              isListening ? `bg-accent-dark ${serverStt ? '' : 'mic-listening'}` : 'bg-accent'
            } ${!speechSupported ? 'opacity-40' : ''}`}
          >
            {isListening ? (
              <span className="wave inline-flex h-8 items-center gap-1" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} style={{ '--i': i }} />
                ))}
              </span>
            ) : (
              <MicIcon className="h-12 w-12" />
            )}
          </button>
          </div>
          <p className="text-sm text-ink-soft">
            {!speechSupported
              ? blockedReason
              : isListening
                ? heardVoice
                  ? 'Hearing you… stop talking and it sends itself'
                  : 'Listening, speak now'
                : status === 'parsing' && serverStt
                  ? 'Writing it down…'
                : 'Tap and say the note'}
          </p>
          {speechError && <p className="text-sm text-warn">{speechError}</p>}
        </div>

        <div className="flex gap-2 pb-2">
          <label htmlFor="note-input" className="sr-only">
            Doctor&rsquo;s note
          </label>
          <input
            id="note-input"
            type="text"
            value={noteText}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNote(noteText)
            }}
            placeholder='e.g. "Ramesh Kumar, review after 2 weeks"'
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-5 py-3.5 text-base text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={() => submitNote(noteText)}
            disabled={!noteText.trim() || status === 'parsing'}
            className="rounded-full bg-ink px-5 py-3.5 text-sm font-medium text-white transition-opacity disabled:opacity-30"
          >
            Check
          </button>
        </div>

        {status === 'idle' && !noteText && (
          <div className="pt-3">
            <p className="text-center label text-ink-soft">or tap an example</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {EXAMPLE_NOTES.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => tryExample(n)}
                  style={{ '--i': i }}
                  className="rise inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  &ldquo;{n}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          {status === 'parsing' && (
            <div className="space-y-3 rounded-3xl border border-line bg-surface p-6" aria-label="Reading the note">
              {[40, 65, 50].map((w) => (
                <div key={w} className="h-4 animate-pulse rounded-full bg-line" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-2xl border border-warn-soft bg-warn-soft p-4 text-sm text-warn">
              <p>{parseError}</p>
              <button type="button" onClick={() => submitNote(noteText)} className="mt-1 font-medium underline">
                Try again
              </button>
            </div>
          )}

          {status === 'no_follow_up' && (
            <div className="rise rounded-3xl border border-line bg-surface p-6 text-center">
              <p className="text-base text-ink">No follow-up needed for {result?.candidates?.[0]?.name || 'this patient'}.</p>
              <p className="mt-1 text-sm text-ink-soft">Nothing to send — no reminder was created.</p>
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
              >
                Next patient
              </button>
            </div>
          )}

          {status === 'ready' && result && (
            <div className="rise relative space-y-5 rounded-3xl border border-line bg-surface p-6 elev-1">
              {stampSeconds != null && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-surface/40">
                  <div className="stamp" role="status">
                    Approved · {stampSeconds}s
                  </div>
                </div>
              )}
              {result.warnings?.length > 0 && (
                <div className="space-y-1 rounded-2xl bg-accent-soft p-3 text-sm text-accent-dark">
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              <div>
                <p className="label text-ink-soft">Patient</p>

                {candidates.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectPatientChip(c.id)}
                        className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                          selectedPatientId === c.id
                            ? 'border-accent bg-accent text-white'
                            : 'border-line text-ink hover:border-accent'
                        }`}
                      >
                        {c.name}
                        {c.age ? `, ${c.age}` : ''}
                      </button>
                    ))}
                  </div>
                )}

                {candidates.length === 1 && (
                  <p className="mt-0.5 font-display text-3xl font-extrabold tracking-[-0.04em] text-ink">{selectedPatient?.name}</p>
                )}

                {candidates.length === 0 && (
                  <p className="mt-0.5 text-sm text-ink-soft">No match yet — search for the patient below.</p>
                )}

                {!showSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowSearch(true)}
                    className="mt-1 inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
                  >
                    Not the right patient? Search
                  </button>
                ) : (
                  <div className="mt-2">
                    <label htmlFor="patient-search" className="sr-only">
                      Search patients by name
                    </label>
                    <input
                      id="patient-search"
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search patient by name"
                      className="w-full rounded-2xl border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                    {searchLoading && <p className="mt-1 text-xs text-ink-soft">Searching…</p>}
                    {searchError && <p className="mt-1 text-xs text-warn">{searchError}</p>}
                    {searchResults.length > 0 && (
                      <ul className="mt-1 divide-y divide-line overflow-hidden rounded-2xl border border-line">
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => pickSearchedPatient(p)}
                              className="block min-h-11 w-full px-4 py-3 text-left text-sm hover:bg-bg"
                            >
                              {p.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="label text-ink-soft">Follow-up date</p>
                {selectedDate ? (
                  <p className="mt-0.5 text-lg font-semibold text-ink">{prettyDate(selectedDate)}</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {DATE_CHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => selectDateChip(opt.days)}
                        className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-ink hover:border-accent"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="label text-ink-soft">Visit type</p>
                <p className="mt-0.5 text-lg font-semibold text-ink">{VISIT_LABELS[selectedVisitType] || '—'}</p>
              </div>

              <div>
                <p className="label text-ink-soft">Message preview</p>
                {previewLoading ? (
                  <div className="mt-2 flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[oklch(0.93_0.06_140)] p-4 text-sm text-ink-soft">
                    <Spinner className="h-4 w-4" />
                    <span>Updating preview…</span>
                  </div>
                ) : (
                  <p className="mt-2 rounded-2xl rounded-tl-sm bg-[oklch(0.93_0.06_140)] p-4 text-sm leading-relaxed text-ink">
                    {previewText || 'Pick a patient and date to preview the message.'}
                  </p>
                )}
                {previewNote && <p className="mt-1 text-xs text-ink-soft">{previewNote}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {status !== 'idle' && status !== 'no_follow_up' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-bg via-bg/95 to-transparent p-4 pt-8">
          <div className="mx-auto max-w-md">
            {approveError && <p className="mb-2 text-center text-sm text-warn">{approveError}</p>}
            <button
              type="button"
              onClick={handleApprove}
              disabled={!canApprove}
              className={`w-full rounded-full bg-accent py-5 text-lg font-semibold text-white ${stampSeconds != null ? '!opacity-100' : ''} elev-accent transition-all enabled:hover:-translate-y-0.5 enabled:active:scale-[0.98] disabled:opacity-30 disabled:shadow-none`}
            >
              {approving ? (
                'Saving…'
              ) : stampSeconds != null ? (
                <span className="inline-flex items-center gap-2">
                  <CheckIcon className="h-5 w-5" /> Saved
                </span>
              ) : (
                'Approve'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
