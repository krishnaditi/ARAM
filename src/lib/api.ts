import { supabase, isBackendConfigured } from './supabaseClient'

/**
 * Data-access layer for onboarding.
 *
 * When Supabase is configured, every sensitive operation goes through a Postgres
 * RPC that runs INSIDE the Mumbai (ap-south-1) database — PIN hashing/verification via
 * pgcrypto, consent writes, session creation — so no personal data is processed outside
 * India. When Supabase is NOT configured, a local mock stands in so the UI can be
 * reviewed on a preview URL before any backend exists. The mock is dev-only and clearly
 * not secure (PIN kept locally); it must never run against real student data.
 */

export interface CreateChildInput {
  emis: string
  language: string
  nickname: string
  ageGroup: string
  pin: string
}

export interface ConsentFlags {
  parentConsent: boolean
  childAssent: boolean
  cameraOptIn: boolean
  voiceOptIn: boolean
}

export interface ReturningContext {
  name: string
  daysSinceLast: number
  streak: number
  sessionsCompleted: number
  buddiesUnlocked: number
  achievements: number
  clinicianAlertPending: boolean
}

export interface VerifyPinResult {
  ok: boolean
  remainingAttempts: number
  locked: boolean
}

// ─────────────────────────── Supabase-backed implementation ───────────────────────────

async function sbCreateChild(input: CreateChildInput): Promise<{ childId: string }> {
  const { data, error } = await supabase!.rpc('create_child', {
    p_emis: input.emis,
    p_language: input.language,
    p_nickname: input.nickname,
    p_age_group: input.ageGroup,
    p_pin: input.pin,
  })
  if (error) throw error
  return { childId: data as string }
}

/** Writes both consents + opt-ins and creates SESSION #1 atomically (RPC enforces both consents). */
async function sbFinalizeOnboarding(
  childId: string,
  consents: ConsentFlags,
): Promise<{ sessionId: string; sessionNumber: number }> {
  const { data, error } = await supabase!.rpc('finalize_onboarding', {
    p_child_id: childId,
    p_parent_consent: consents.parentConsent,
    p_child_assent: consents.childAssent,
    p_camera_opt_in: consents.cameraOptIn,
    p_voice_opt_in: consents.voiceOptIn,
  })
  if (error) throw error
  const row = data as { session_id: string; session_number: number }
  return { sessionId: row.session_id, sessionNumber: row.session_number }
}

async function sbVerifyPin(childId: string, pin: string): Promise<VerifyPinResult> {
  const { data, error } = await supabase!.rpc('verify_pin', { p_child_id: childId, p_pin: pin })
  if (error) throw error
  const row = data as { ok: boolean; remaining_attempts: number; locked: boolean }
  return { ok: row.ok, remainingAttempts: row.remaining_attempts, locked: row.locked }
}

async function sbGetReturningContext(childId: string): Promise<ReturningContext> {
  const { data, error } = await supabase!.rpc('get_returning_context', { p_child_id: childId })
  if (error) throw error
  const r = data as Record<string, unknown>
  return {
    name: String(r.name ?? ''),
    daysSinceLast: Number(r.days_since_last ?? 0),
    streak: Number(r.streak ?? 0),
    sessionsCompleted: Number(r.sessions_completed ?? 0),
    buddiesUnlocked: Number(r.buddies_unlocked ?? 0),
    achievements: Number(r.achievements ?? 0),
    clinicianAlertPending: Boolean(r.clinician_alert_pending ?? false),
  }
}

async function sbClearClinicianAlert(childId: string): Promise<void> {
  const { error } = await supabase!.rpc('clear_clinician_alert', { p_child_id: childId })
  if (error) throw error
}

// ─────────────────────────── Local mock (UI review only) ───────────────────────────

const MOCK_KEY = 'aram.mock.child'
interface MockChild {
  childId: string
  nickname: string
  pin: string
  attempts: number
  locked: boolean
  clinicianAlertPending: boolean
}

function mockUuid(): string {
  return 'mock-' + Math.abs(hashString(String(performance.now()) + Math.round(performance.timeOrigin))).toString(36)
}
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}
function readMock(): MockChild | null {
  const raw = localStorage.getItem(MOCK_KEY)
  return raw ? (JSON.parse(raw) as MockChild) : null
}
function writeMock(c: MockChild): void {
  localStorage.setItem(MOCK_KEY, JSON.stringify(c))
}

const MOCK_MAX_ATTEMPTS = 3

async function mockCreateChild(input: CreateChildInput): Promise<{ childId: string }> {
  const child: MockChild = {
    childId: mockUuid(),
    nickname: input.nickname,
    pin: input.pin,
    attempts: 0,
    locked: false,
    clinicianAlertPending: false,
  }
  writeMock(child)
  return { childId: child.childId }
}
async function mockFinalizeOnboarding(): Promise<{ sessionId: string; sessionNumber: number }> {
  return { sessionId: mockUuid(), sessionNumber: 1 }
}
async function mockVerifyPin(_childId: string, pin: string): Promise<VerifyPinResult> {
  const child = readMock()
  if (!child) return { ok: false, remainingAttempts: 0, locked: true }
  if (child.locked) return { ok: false, remainingAttempts: 0, locked: true }
  if (child.pin === pin) {
    child.attempts = 0
    writeMock(child)
    return { ok: true, remainingAttempts: MOCK_MAX_ATTEMPTS, locked: false }
  }
  child.attempts += 1
  const remaining = Math.max(0, MOCK_MAX_ATTEMPTS - child.attempts)
  child.locked = remaining === 0
  writeMock(child)
  return { ok: false, remainingAttempts: remaining, locked: child.locked }
}
async function mockGetReturningContext(): Promise<ReturningContext> {
  const child = readMock()
  return {
    name: child?.nickname ?? 'Friend',
    daysSinceLast: 2,
    streak: 5,
    sessionsCompleted: 8,
    buddiesUnlocked: 0,
    achievements: 12,
    clinicianAlertPending: child?.clinicianAlertPending ?? false,
  }
}
async function mockClearClinicianAlert(): Promise<void> {
  const child = readMock()
  if (child) {
    child.clinicianAlertPending = false
    writeMock(child)
  }
}

/**
 * Dev/test-only: mark the mock child as having a pending clinician alert, so the
 * S11 re-offer screen can be exercised without real session/mood-tracking content
 * (a separate, not-yet-built feature — that's what would set this for real, via an
 * `audit_log` row in Supabase). Never available when a real backend is configured.
 */
async function mockSimulateClinicianAlert(): Promise<void> {
  const child = readMock()
  if (child) {
    child.clinicianAlertPending = true
    writeMock(child)
  }
}

// ─────────────────────────── Public API ───────────────────────────

export const api = {
  createChild: (input: CreateChildInput) =>
    isBackendConfigured ? sbCreateChild(input) : mockCreateChild(input),
  finalizeOnboarding: (childId: string, consents: ConsentFlags) =>
    isBackendConfigured ? sbFinalizeOnboarding(childId, consents) : mockFinalizeOnboarding(),
  verifyPin: (childId: string, pin: string) =>
    isBackendConfigured ? sbVerifyPin(childId, pin) : mockVerifyPin(childId, pin),
  getReturningContext: (childId: string) =>
    isBackendConfigured ? sbGetReturningContext(childId) : mockGetReturningContext(),
  clearClinicianAlert: (childId: string) =>
    isBackendConfigured ? sbClearClinicianAlert(childId) : mockClearClinicianAlert(),
  /** Dev/test-only — see mockSimulateClinicianAlert(). No-op against a real backend. */
  devSimulateClinicianAlert: () =>
    isBackendConfigured ? Promise.resolve() : mockSimulateClinicianAlert(),
}
