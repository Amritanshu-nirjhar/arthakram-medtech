// All server calls for FollowUp live here, matching the API contract in
// BUILD_PLAN.md section 8 exactly. Flip USE_MOCK to false (and point
// BASE_URL at the real backend) once it is running — nothing else in the
// app needs to change.

const USE_MOCK = false
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api' // proxied to :8000 by vite.config.js

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const VISIT_LABELS = {
  follow_up: 'follow-up visit',
  report_review: 'report review',
  routine_check: 'routine check-up',
}

export const DATE_CHIP_OPTIONS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
]

// ---------------------------------------------------------------------------
// Pure helpers — formatting only. The patient-facing message text is never
// built here: it always comes from the server, either as `message_preview`
// from /notes/parse or as `message` from /messages/preview, both of which
// render the one fixed template in backend/app/templates.py.
// ---------------------------------------------------------------------------

export function firstNameOf(fullName) {
  if (!fullName) return ''
  return fullName.trim().split(/\s+/)[0]
}

function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// today + days, pushed from Sunday to Monday (clinic is closed Sundays).
export function resolveFollowUpDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return toISODate(d)
}

export function prettyDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Mock data + logic (used while USE_MOCK is true)
// ---------------------------------------------------------------------------

// Mock-only: stands in for the server's fixed template render
// (backend/app/templates.py) so the mock's parse previews, seed reminders
// and /messages/preview response look realistic while USE_MOCK is true.
// This is never reachable when USE_MOCK is false — the live app always
// renders the message the server sends back, never a client-built one.
const MOCK_CLINIC_NAME = 'Sharma Family Clinic'
const MOCK_DOCTOR_NAME = 'Dr. Sharma'
const MOCK_CLINIC_PHONE = '9800000000'

function mockRenderMessage({ firstName, dateISO, visitType }) {
  if (!firstName || !dateISO || !visitType) return null
  const label = VISIT_LABELS[visitType] || VISIT_LABELS.follow_up
  return `Hi ${firstName}, this is a reminder from ${MOCK_CLINIC_NAME}. ${MOCK_DOCTOR_NAME} would like to see you on ${prettyDate(dateISO)} for your ${label}. Reply YES to confirm, or call ${MOCK_CLINIC_PHONE} to reschedule.`
}

const MOCK_PATIENTS = [
  { id: 'p1', name: 'Ramesh Kumar', phone: '9811100001', age: 52, last_visit_date: '2026-10-15' },
  { id: 'p2', name: 'Priya Sharma', phone: '9811100002', age: 29, last_visit_date: '2026-10-20' },
  { id: 'p3', name: 'Anil Verma', phone: '9811100003', age: 61, last_visit_date: '2026-10-18' },
  { id: 'p4', name: 'Sunita Devi', phone: '9811100004', age: 45, last_visit_date: '2026-09-30' },
  { id: 'p5', name: 'Kavita Rao', phone: '9811100005', age: 34, last_visit_date: '2026-10-22' },
  { id: 'p6', name: 'Meena Gupta', phone: '9811100006', age: 39, last_visit_date: '2026-10-25' },
  { id: 'p7', name: 'Rahul Singh', phone: '9811100007', age: 48, last_visit_date: '2026-10-12' },
  { id: 'p8', name: 'Neha Patel', phone: '9811100008', age: 27, last_visit_date: '2026-10-28' },
  { id: 'p9', name: 'Amit Kumar', phone: '9811100009', age: 41, last_visit_date: '2026-10-10' },
  { id: 'p10', name: 'Amit Verma', phone: '9811100010', age: 58, last_visit_date: '2026-09-25' },
]

// Patients guessed from free text that didn't match a known record.
// Kept so a later approve() in the same session can resolve the id.
const adHocPatients = new Map()

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'patient'
}

function guessNameFromText(text) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const capWords = words.filter((w) => /^[A-Z]/.test(w)).slice(0, 2)
  if (capWords.length) return capWords.join(' ')
  return words.slice(0, 2).join(' ') || 'New patient'
}

function randomFictionalPhone() {
  return `98${Math.floor(10000000 + Math.random() * 89999999)}`
}

function matchPatients(text) {
  const lower = text.toLowerCase()

  // Deliberately ambiguous demo case: two "Amit"s in the clinic.
  if (/\bamit\b/.test(lower)) {
    return MOCK_PATIENTS.filter((p) => firstNameOf(p.name).toLowerCase() === 'amit')
  }

  const hits = MOCK_PATIENTS.filter((p) =>
    new RegExp(`\\b${escapeRegExp(firstNameOf(p.name).toLowerCase())}\\b`).test(lower),
  )
  if (hits.length > 0) return hits

  // No known patient mentioned — guess a name so the flow never blocks,
  // and flag it with a warning for the doctor to confirm.
  const guessed = guessNameFromText(text)
  const id = `new-${slugify(guessed)}`
  if (!adHocPatients.has(id)) {
    adHocPatients.set(id, { id, name: guessed, phone: randomFictionalPhone(), age: null, last_visit_date: null })
  }
  return [adHocPatients.get(id)]
}

function findPatientById(id) {
  return MOCK_PATIENTS.find((p) => p.id === id) || adHocPatients.get(id) || null
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function daysUntilWeekday(name) {
  const targetIdx = WEEKDAYS.indexOf(name)
  const todayIdx = new Date().getDay()
  const diff = (targetIdx - todayIdx + 7) % 7
  return diff === 0 ? 7 : diff
}

function parseDurationDays(lower) {
  let m
  if ((m = lower.match(/(\d+)\s*(?:day|days|din)\b/))) return parseInt(m[1], 10)
  if ((m = lower.match(/(\d+)\s*(?:week|weeks|wk|wks)\b/))) return parseInt(m[1], 10) * 7
  if ((m = lower.match(/(\d+)\s*(?:month|months)\b/))) return parseInt(m[1], 10) * 30
  if (/\ba\s+week\b/.test(lower)) return 7
  if (/\ba\s+month\b/.test(lower)) return 30
  const weekdayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  if (weekdayMatch) return daysUntilWeekday(weekdayMatch[1])
  return null
}

function guessVisitType(lower) {
  if (/\breport/.test(lower)) return 'report_review'
  if (/\broutine|check-?up\b/.test(lower)) return 'routine_check'
  return 'follow_up'
}

const MEDICAL_PATTERNS = [
  /\d+\s?(mg|ml|mcg|g|iu)\b/i,
  /\b(tablet|tab|capsule|syrup|injection|dose|twice|daily)\b/i,
  /\b(paracetamol|amlodipine|metformin|azithromycin|ibuprofen)\b/i,
  /\b(diabetes|hypertension|infection|fever|bp|sugar|cancer)\b/i,
]

function detectMedicalContent(lower) {
  return MEDICAL_PATTERNS.some((re) => re.test(lower))
}

function detectNoFollowUp(lower) {
  return /no\s+follow[\s-]?ups?\b/.test(lower) || /follow[\s-]?up.*(not needed|not required)/.test(lower)
}

async function mockParseNote(rawText) {
  await wait(450)
  const text = (rawText || '').trim()
  if (!text) {
    return {
      candidates: [],
      follow_up_date: null,
      visit_type: null,
      message_preview: null,
      warnings: ['Say or type a note first — for example, "Ramesh Kumar, review after 2 weeks."'],
      no_follow_up: false,
    }
  }

  const lower = text.toLowerCase()
  const warnings = []
  if (detectMedicalContent(lower)) {
    warnings.push('Clinical details (symptoms, medicines, doses) were ignored. The message only uses the name, date and visit type.')
  }

  const candidates = matchPatients(text)
  if (candidates.length === 1 && candidates[0].id.startsWith('new-')) {
    warnings.push(`"${candidates[0].name}" was not found in patient records — confirm the name before approving.`)
  }

  const no_follow_up = detectNoFollowUp(lower)
  if (no_follow_up) {
    return { candidates, follow_up_date: null, visit_type: null, message_preview: null, warnings, no_follow_up: true }
  }

  const visit_type = guessVisitType(lower)
  const days = parseDurationDays(lower)
  const follow_up_date = days != null ? resolveFollowUpDate(days) : null

  let message_preview = null
  if (candidates.length === 1 && follow_up_date) {
    message_preview = mockRenderMessage({
      firstName: firstNameOf(candidates[0].name),
      dateISO: follow_up_date,
      visitType: visit_type,
    })
  }

  return { candidates, follow_up_date, visit_type, message_preview, warnings, no_follow_up: false }
}

// Seed reminders so the reception queue and stats aren't empty on load.
// Today in the demo clock is 2026-11-05 (Thursday).
let reminderSeq = 1
const reminderStore = [
  mkSeedReminder('p1', '2026-11-05', 'follow_up', 'approved', 9),
  mkSeedReminder('p2', '2026-11-09', 'report_review', 'approved', 12),
  mkSeedReminder('p3', '2026-11-06', 'follow_up', 'sent', 8),
  mkSeedReminder('p4', '2026-11-20', 'routine_check', 'sent', 14),
  mkSeedReminder('p5', '2026-11-07', 'report_review', 'confirmed', 7),
  mkSeedReminder('p6', '2026-10-29', 'follow_up', 'visited', 10),
  mkSeedReminder('p7', '2026-10-25', 'follow_up', 'missed', 11),
]

function mkSeedReminder(patientId, followUpDate, visitType, status, doctorSeconds) {
  const patient = MOCK_PATIENTS.find((p) => p.id === patientId)
  const id = `r-seed-${reminderSeq++}`
  return {
    id,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_phone: patient.phone,
    follow_up_date: followUpDate,
    visit_type: visitType,
    message: mockRenderMessage({ firstName: firstNameOf(patient.name), dateISO: followUpDate, visitType }),
    status,
    created_at: '2026-11-01T09:00:00.000Z',
    approved_at: '2026-11-01T09:00:05.000Z',
    sent_at: status === 'approved' ? null : '2026-11-01T09:05:00.000Z',
    doctor_seconds: doctorSeconds,
  }
}

async function mockCreateReminder({ patient_id, follow_up_date, visit_type, doctor_seconds }) {
  await wait(350)
  const patient = findPatientById(patient_id)
  if (!patient) throw new Error('That patient could not be found. Please pick again.')
  const message = mockRenderMessage({ firstName: firstNameOf(patient.name), dateISO: follow_up_date, visitType: visit_type })
  const reminder = {
    id: `r-${reminderSeq++}`,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_phone: patient.phone,
    follow_up_date,
    visit_type,
    message,
    status: 'approved',
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    sent_at: null,
    doctor_seconds,
  }
  reminderStore.unshift(reminder)
  return reminder
}

async function mockGetReminders(status) {
  await wait(300)
  let list = reminderStore.slice()
  if (status) list = list.filter((r) => r.status === status)
  list.sort((a, b) => (a.follow_up_date || '').localeCompare(b.follow_up_date || ''))
  return list
}

async function mockUpdateReminderStatus(id, status) {
  await wait(300)
  const reminder = reminderStore.find((r) => r.id === id)
  if (!reminder) throw new Error('Reminder not found.')
  reminder.status = status
  if (status === 'sent' && !reminder.sent_at) reminder.sent_at = new Date().toISOString()
  return { ...reminder }
}

async function mockPreviewMessage({ patient_id, follow_up_date, visit_type }) {
  await wait(200)
  const patient = findPatientById(patient_id)
  if (!patient) throw new Error('That patient could not be found.')
  const message = mockRenderMessage({
    firstName: firstNameOf(patient.name),
    dateISO: follow_up_date,
    visitType: visit_type,
  })
  return { message, warnings: [] }
}

async function mockSearchPatients(query) {
  await wait(250)
  const q = (query || '').toLowerCase().trim()
  if (!q) return []
  return MOCK_PATIENTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
}

async function mockGetStats() {
  await wait(300)
  const created = reminderStore.length
  const sent = reminderStore.filter((r) => ['sent', 'confirmed', 'visited', 'missed'].includes(r.status)).length
  const confirmed = reminderStore.filter((r) => ['confirmed', 'visited'].includes(r.status)).length
  const visited = reminderStore.filter((r) => r.status === 'visited').length
  const missed = reminderStore.filter((r) => r.status === 'missed').length
  const withSeconds = reminderStore.filter((r) => typeof r.doctor_seconds === 'number')
  const avg_doctor_seconds = withSeconds.length
    ? Math.round(withSeconds.reduce((sum, r) => sum + r.doctor_seconds, 0) / withSeconds.length)
    : null
  return {
    reminders_created: created,
    reminders_sent: sent,
    reminders_confirmed: confirmed,
    reminders_visited: visited,
    reminders_missed: missed,
    avg_doctor_seconds,
  }
}

// ---------------------------------------------------------------------------
// Real backend calls (used when USE_MOCK is false)
// ---------------------------------------------------------------------------

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || body.message || detail
    } catch {
      // response had no JSON body — fall back to statusText
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ---------------------------------------------------------------------------
// Public API — every call in the app goes through these functions.
// ---------------------------------------------------------------------------

export async function parseNote(text) {
  if (USE_MOCK) return mockParseNote(text)
  return request('/notes/parse', { method: 'POST', body: JSON.stringify({ text }) })
}

// Used once the doctor resolves an ambiguous patient or a missing date (or
// picks a patient from search) so the preview reflects the server's real
// template instead of going stale. Always render the `message` this returns
// verbatim — never build message text on the client.
export async function previewMessage({ patient_id, follow_up_date, visit_type }) {
  if (USE_MOCK) return mockPreviewMessage({ patient_id, follow_up_date, visit_type })
  return request('/messages/preview', {
    method: 'POST',
    body: JSON.stringify({ patient_id, follow_up_date, visit_type }),
  })
}

export async function approveReminder({ patient_id, follow_up_date, visit_type, doctor_seconds }) {
  if (USE_MOCK) return mockCreateReminder({ patient_id, follow_up_date, visit_type, doctor_seconds })
  return request('/reminders', {
    method: 'POST',
    body: JSON.stringify({ patient_id, follow_up_date, visit_type, doctor_seconds }),
  })
}

export async function getReminders(status) {
  if (USE_MOCK) return mockGetReminders(status)
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return request(`/reminders${qs}`)
}

export async function updateReminderStatus(id, status) {
  if (USE_MOCK) return mockUpdateReminderStatus(id, status)
  return request(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export async function getHealth() {
  if (USE_MOCK) return { status: 'ok', stt: false }
  return request('/health')
}

// Voice note -> text on our own server (faster-whisper). Multipart, so no JSON header.
export async function transcribeAudio(blob) {
  const form = new FormData()
  form.append('audio', blob, 'note.webm')
  let res
  try {
    res = await fetch(`${BASE_URL}/transcribe`, { method: 'POST', body: form })
  } catch {
    throw new Error('Could not reach the server. Is the backend running?')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.detail || `Transcribe failed (${res.status})`), { status: res.status })
  return body.text || ''
}

export async function deleteReminder(id) {
  if (USE_MOCK) return null
  return request(`/reminders/${id}`, { method: 'DELETE' })
}

export async function searchPatients(query) {
  if (USE_MOCK) return mockSearchPatients(query)
  const qs = query ? `?search=${encodeURIComponent(query)}` : ''
  return request(`/patients${qs}`)
}

export async function getStats() {
  if (USE_MOCK) return mockGetStats()
  return request('/stats')
}
