import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DATE_CHIP_OPTIONS,
  VISIT_LABELS,
  approveReminder,
  buildMessagePreview,
  firstNameOf,
  parseNote,
  prettyDate,
  resolveFollowUpDate,
  searchPatients,
} from '../api.js'
import Toast from '../components/Toast.jsx'

function getSpeechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

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

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Doctor() {
  const [speechSupported] = useState(() => !!getSpeechRecognitionClass())
  const [isListening, setIsListening] = useState(false)
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

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState(null)
  const [showToast, setShowToast] = useState(false)

  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAtRef = useRef(null)
  const tickRef = useRef(null)
  const recognitionRef = useRef(null)
  const latestTranscriptRef = useRef('')
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      recognitionRef.current?.abort?.()
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
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
      recognitionRef.current?.stop()
      return
    }
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
      if (event.error === 'no-speech') {
        setSpeechError("Didn't catch that — try again or type it below.")
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSpeechError('Microphone access was blocked — type the note instead.')
      } else {
        setSpeechError('Voice input had a problem — type the note instead.')
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      const text = latestTranscriptRef.current.trim()
      if (text) submitNote(text)
    }

    recognitionRef.current = recognition
    recognition.start()
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

  function pickSearchedPatient(patient) {
    setCandidates((prev) => [patient, ...prev.filter((p) => p.id !== patient.id)])
    setSelectedPatientId(patient.id)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
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

  const messagePreview = useMemo(() => {
    if (!selectedPatient || !selectedDate || !selectedVisitType) return null
    return buildMessagePreview({
      firstName: firstNameOf(selectedPatient.name),
      dateISO: selectedDate,
      visitType: selectedVisitType,
    })
  }, [selectedPatient, selectedDate, selectedVisitType])

  const canApprove = status === 'ready' && !!selectedPatient && !!selectedDate && !!selectedVisitType && !approving

  async function handleApprove() {
    if (!canApprove) return
    setApproving(true)
    setApproveError(null)
    try {
      const doctorSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0
      await approveReminder({
        patient_id: selectedPatient.id,
        follow_up_date: selectedDate,
        visit_type: selectedVisitType,
        doctor_seconds: doctorSeconds,
      })
      stopTimer()
      setShowToast(true)
      setTimeout(() => {
        setShowToast(false)
        resetAll()
      }, 1600)
    } catch (err) {
      setApproveError(err.message || 'Could not save — try again.')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      <Toast show={showToast} message="Saved ✓" />

      <div className="mx-auto max-w-md px-4 pt-6">
        <div className="flex flex-col items-center gap-3 pb-6 pt-2 text-center">
          <div className="tabular-nums text-sm font-medium text-ink-soft">{formatElapsed(elapsedMs)}</div>
          <button
            type="button"
            onClick={handleMicTap}
            disabled={!speechSupported}
            aria-pressed={isListening}
            className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-95 ${
              isListening ? 'mic-listening bg-accent-dark' : 'bg-accent'
            } ${!speechSupported ? 'opacity-40' : ''}`}
          >
            <MicIcon className="h-10 w-10" />
          </button>
          <p className="text-sm text-ink-soft">
            {!speechSupported
              ? 'Voice input is not supported here — type the note below.'
              : isListening
                ? 'Listening — speak the note now'
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
            className="flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={() => submitNote(noteText)}
            disabled={!noteText.trim() || status === 'parsing'}
            className="rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white disabled:opacity-30"
          >
            Check
          </button>
        </div>

        <div className="space-y-4 pt-4">
          {status === 'parsing' && <p className="text-center text-sm text-ink-soft">Reading the note…</p>}

          {status === 'error' && (
            <div className="rounded-lg border border-warn-soft bg-warn-soft p-4 text-sm text-warn">
              <p>{parseError}</p>
              <button type="button" onClick={() => submitNote(noteText)} className="mt-1 font-medium underline">
                Try again
              </button>
            </div>
          )}

          {status === 'no_follow_up' && (
            <div className="rounded-xl border border-line bg-surface p-5 text-center">
              <p className="text-base text-ink">No follow-up needed for {result?.candidates?.[0]?.name || 'this patient'}.</p>
              <p className="mt-1 text-sm text-ink-soft">Nothing to send — no reminder was created.</p>
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white"
              >
                Next patient
              </button>
            </div>
          )}

          {status === 'ready' && result && (
            <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
              {result.warnings?.length > 0 && (
                <div className="space-y-1 rounded-lg bg-accent-soft p-3 text-sm text-accent-dark">
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs text-ink-soft">Patient</p>

                {candidates.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedPatientId(c.id)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
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
                  <p className="mt-0.5 text-lg font-semibold text-ink">{selectedPatient?.name}</p>
                )}

                {candidates.length === 0 && (
                  <p className="mt-0.5 text-sm text-ink-soft">No match yet — search for the patient below.</p>
                )}

                {!showSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowSearch(true)}
                    className="mt-2 text-sm text-ink-soft underline"
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
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                    {searchLoading && <p className="mt-1 text-xs text-ink-soft">Searching…</p>}
                    {searchError && <p className="mt-1 text-xs text-warn">{searchError}</p>}
                    {searchResults.length > 0 && (
                      <ul className="mt-1 divide-y divide-line overflow-hidden rounded-lg border border-line">
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => pickSearchedPatient(p)}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-bg"
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
                <p className="text-xs text-ink-soft">Follow-up date</p>
                {selectedDate ? (
                  <p className="mt-0.5 text-lg font-semibold text-ink">{prettyDate(selectedDate)}</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {DATE_CHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setSelectedDate(resolveFollowUpDate(opt.days))}
                        className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink hover:border-accent"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-ink-soft">Visit type</p>
                <p className="mt-0.5 text-lg font-semibold text-ink">{VISIT_LABELS[selectedVisitType] || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-ink-soft">Message preview</p>
                <p className="mt-1 rounded-lg bg-bg p-3 text-sm leading-relaxed text-ink">
                  {messagePreview || 'Pick a patient and date to preview the message.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {status !== 'idle' && status !== 'no_follow_up' && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-line bg-surface p-4">
          <div className="mx-auto max-w-md">
            {approveError && <p className="mb-2 text-center text-sm text-warn">{approveError}</p>}
            <button
              type="button"
              onClick={handleApprove}
              disabled={!canApprove}
              className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-white transition disabled:opacity-30"
            >
              {approving ? 'Saving…' : 'Approve'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
