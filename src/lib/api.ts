import { isBackendConfigured, post, backendRequest } from './backendClient'
import { FACE_MATCH_THRESHOLD, descriptorDistance } from './faceApi'

/**
 * Data-access layer for onboarding.
 *
 * When the PostgreSQL API is configured, sensitive operations go through the FastAPI
 * service and PostgreSQL RPCs — PIN hashing/verification via pgcrypto, consent writes,
 * and session creation. When it is not configured, a local mock stands in for UI review.
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

export interface VerifyFaceResult {
  ok: boolean
  /** Euclidean distance to the registered descriptor (lower = more similar). Exposed for
   * debugging/tuning FACE_MATCH_THRESHOLD, never shown to the child. */
  distance: number
}

export interface DashboardSummary {
  students: number
  sessions: number
  alerts: number
}

// ───────────────────────────── PostgreSQL API implementation ─────────────────────────

async function remoteCreateChild(input: CreateChildInput): Promise<{ childId: string }> {
  return post('/api/students', {
    emis: input.emis,
    language: input.language,
    nickname: input.nickname,
    age_group: input.ageGroup,
    pin: input.pin,
  })
}

/** Writes both consents + opt-ins and creates SESSION #1 atomically (RPC enforces both consents). */
async function remoteFinalizeOnboarding(
  childId: string,
  consents: ConsentFlags,
): Promise<{ sessionId: string; sessionNumber: number }> {
  const row = await post<{ session_id: string; session_number: number }>(`/api/students/${childId}/finalize`, {
    parent_consent: consents.parentConsent,
    child_assent: consents.childAssent,
    camera_opt_in: consents.cameraOptIn,
    voice_opt_in: consents.voiceOptIn,
  })
  return { sessionId: row.session_id, sessionNumber: row.session_number }
}

async function remoteVerifyPin(childId: string, pin: string): Promise<VerifyPinResult> {
  const row = await post<{ ok: boolean; remaining_attempts: number; locked: boolean }>(`/api/students/${childId}/verify-pin`, { pin })
  return { ok: row.ok, remainingAttempts: row.remaining_attempts, locked: row.locked }
}

/** Stores the 128-d face descriptor produced client-side by faceApi.ts. The RPC (not yet
 * written — see MEMORY) would keep it alongside the child row for verify_face to compare
 * against; only the descriptor crosses the wire, never the photo itself. */
async function remoteRegisterFace(childId: string, descriptor: number[]): Promise<void> {
  await post(`/api/students/${childId}/face`, { descriptor })
}

async function remoteVerifyFace(childId: string, descriptor: number[]): Promise<VerifyFaceResult> {
  return post<VerifyFaceResult>(`/api/students/${childId}/verify-face`, { descriptor })
}

async function remoteGetReturningContext(childId: string): Promise<ReturningContext> {
  const r = await backendRequest<Record<string, unknown>>(`/api/students/${childId}/context`)
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

async function remoteClearClinicianAlert(childId: string): Promise<void> {
  await post(`/api/students/${childId}/clear-alert`, {})
}

async function remoteDashboard(userId: string): Promise<DashboardSummary> {
  return backendRequest<DashboardSummary>(`/api/users/${userId}/dashboard`)
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
  faceDescriptor: number[] | null
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
    faceDescriptor: null,
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
async function mockRegisterFace(_childId: string, descriptor: number[]): Promise<void> {
  const child = readMock()
  if (!child) return
  child.faceDescriptor = descriptor
  writeMock(child)
}

async function mockVerifyFace(_childId: string, descriptor: number[]): Promise<VerifyFaceResult> {
  const child = readMock()
  if (!child?.faceDescriptor) return { ok: false, distance: Infinity }
  const distance = descriptorDistance(child.faceDescriptor, descriptor)
  return { ok: distance < FACE_MATCH_THRESHOLD, distance }
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
 * `audit_log` row in PostgreSQL). Never available when a real backend is configured.
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
    isBackendConfigured ? remoteCreateChild(input) : mockCreateChild(input),
  finalizeOnboarding: (childId: string, consents: ConsentFlags) =>
    isBackendConfigured ? remoteFinalizeOnboarding(childId, consents) : mockFinalizeOnboarding(),
  verifyPin: (childId: string, pin: string) =>
    isBackendConfigured ? remoteVerifyPin(childId, pin) : mockVerifyPin(childId, pin),
  registerFace: (childId: string, descriptor: number[]) =>
    isBackendConfigured ? remoteRegisterFace(childId, descriptor) : mockRegisterFace(childId, descriptor),
  verifyFace: (childId: string, descriptor: number[]) =>
    isBackendConfigured ? remoteVerifyFace(childId, descriptor) : mockVerifyFace(childId, descriptor),
  getReturningContext: (childId: string) =>
    isBackendConfigured ? remoteGetReturningContext(childId) : mockGetReturningContext(),
  clearClinicianAlert: (childId: string) =>
    isBackendConfigured ? remoteClearClinicianAlert(childId) : mockClearClinicianAlert(),
  dashboard: (userId: string) =>
    isBackendConfigured ? remoteDashboard(userId) : Promise.resolve({ students: 0, sessions: 0, alerts: 0 }),
  /** Dev/test-only — see mockSimulateClinicianAlert(). No-op against a real backend. */
  devSimulateClinicianAlert: () =>
    isBackendConfigured ? Promise.resolve() : mockSimulateClinicianAlert(),
}
