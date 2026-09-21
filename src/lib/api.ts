import { isBackendConfigured, post, backendRequest } from './backendClient'
import { FACE_BLOCK_THRESHOLD, FACE_MATCH_THRESHOLD, descriptorDistance } from './faceApi'
import type { FlagLevel } from '../data/clusters'

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

export interface RegisterFaceResult {
  /** False only for the block band: a near-certain match, and onboarding must stop. */
  ok: boolean
  /** False when a borderline match meant the face was deliberately NOT stored. */
  stored?: boolean
  /** True for the review band: the child carries on with a PIN, staff are notified. */
  review?: boolean
  /** 'duplicate' — the descriptor already belongs to another active account. */
  reason?: string
  /** Role of the account it matched: 'student', 'counsellor', … Never a name or an id. */
  existingRole?: string
}

export interface FaceOverrideResult {
  ok: boolean
  /** Name of the staff member whose face authorised the skip. */
  staffName?: string
}

export interface DiscardAccountResult {
  ok: boolean
  /** False when there was nothing to remove; 'finalised' when the account is real. */
  removed?: boolean
  reason?: string
}

export interface VerifyFaceResult {
  ok: boolean
  /** Euclidean distance to the registered descriptor (lower = more similar). Exposed for
   * debugging/tuning FACE_MATCH_THRESHOLD, never shown to the child. */
  distance: number
}

export interface ChildLoginResult {
  ok: boolean
  childId?: string
  nickname?: string
  language?: string
  ageGroup?: string
  faceRegistered?: boolean
  /** 'invalid' | 'locked' | 'ambiguous' — only set when ok is false. */
  reason?: string
}

export interface DashboardSummary {
  students: number
  sessions: number
  alerts: number
}

export interface StartedSession {
  sessionId: string
  sessionNumber: number
}

/** One confirmed basket item, ready to become a CLUSTER_FLAG row. */
export interface ClusterFlagItem {
  /** Canonical issue id, or `free_<subId>_<n>`. */
  issueId: string
  clusterId: string
  subId: string
  /** Where the child tapped it — browse-path analysis only, never counts. */
  entrySubId: string
  emotions: string[]
  flag: FlagLevel
  free: boolean
  freeText?: string
  rank: number
}

export interface SafeguardFlagInput {
  sessionId: string | null
  issueId: string
  severity: 'amber' | 'red'
  clusterId: string | null
  subId: string | null
}

export interface ClusterSelectionInput {
  sessionId: string | null
  childId: string | null
  items: ClusterFlagItem[]
}

// ───────────────────────────── PostgreSQL API implementation ─────────────────────────

async function remoteCreateChild(input: CreateChildInput): Promise<{ childId: string }> {
  const row = await post<{ child_id: string }>('/api/students', {
    emis: input.emis,
    language: input.language,
    nickname: input.nickname,
    age_group: input.ageGroup,
    pin: input.pin,
  })
  return { childId: row.child_id }
}

/** Writes both consents + opt-ins and creates SESSION #1 atomically (RPC enforces both consents). */
/** Finds an existing account from credentials alone, for a device that has no child_id. */
async function remoteLoginWithPin(nickname: string, pin: string, emis: string): Promise<ChildLoginResult> {
  return toLoginResult(await post('/api/students/login', { nickname, pin, emis }))
}

async function remoteLoginWithFace(descriptor: number[], emis: string): Promise<ChildLoginResult> {
  return toLoginResult(await post('/api/students/login-face', { descriptor, emis }))
}

function toLoginResult(row: Record<string, unknown>): ChildLoginResult {
  if (!row.ok) return { ok: false, reason: String(row.reason ?? 'invalid') }
  return {
    ok: true,
    childId: String(row.child_id),
    nickname: String(row.nickname ?? ''),
    language: String(row.language ?? 'en'),
    ageGroup: String(row.age_group ?? ''),
    faceRegistered: Boolean(row.face_registered),
  }
}

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

/** Stores the 128-d face descriptor produced client-side by faceApi.ts — only the
 * descriptor crosses the wire, never the photo itself. The RPC refuses a descriptor
 * that already belongs to another active account, in any school and any role, so a
 * `{ok: false, reason: 'duplicate'}` answer here is an ordinary outcome, not a failure. */
async function remoteRegisterFace(childId: string, descriptor: number[]): Promise<RegisterFaceResult> {
  const r = await post<Record<string, unknown>>(`/api/students/${childId}/face`, { descriptor })
  return {
    ok: Boolean(r.ok),
    stored: Boolean(r.stored),
    review: Boolean(r.review),
    reason: r.reason ? String(r.reason) : undefined,
    existingRole: r.existing_role ? String(r.existing_role) : undefined,
  }
}

/** Staff authorisation to pass the mandatory face step. `descriptor` is the STAFF
 *  member's face, not the child's. */
async function remoteOverrideFaceStep(childId: string, descriptor: number[]): Promise<FaceOverrideResult> {
  const r = await post<Record<string, unknown>>(`/api/students/${childId}/face-override`, { descriptor })
  return { ok: Boolean(r.ok), staffName: r.staff_name ? String(r.staff_name) : undefined }
}

/** Removes an onboarding record that never completed. The RPC refuses to touch an
 *  account with consent on record or any session history. */
async function remoteDiscardAccount(childId: string): Promise<DiscardAccountResult> {
  const r = await post<Record<string, unknown>>(`/api/students/${childId}/discard`, {})
  return {
    ok: Boolean(r.ok),
    removed: Boolean(r.removed),
    reason: r.reason ? String(r.reason) : undefined,
  }
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

/** Opens a SESSION row for this sitting. Called when the child enters C01. */
async function remoteStartSession(childId: string): Promise<StartedSession> {
  const row = await post<{ session_id: string; session_number: number }>(
    `/api/students/${childId}/sessions`,
    {},
  )
  return { sessionId: row.session_id, sessionNumber: row.session_number }
}

/** Amber and red disclosures are written the moment they are made, never batched. */
async function remoteRaiseSafeguardFlag(input: SafeguardFlagInput): Promise<void> {
  if (!input.sessionId) return
  await post(`/api/sessions/${input.sessionId}/safeguard-flag`, {
    issue_id: input.issueId,
    severity: input.severity,
    cluster_id: input.clusterId,
    sub_id: input.subId,
  })
}

/** All CLUSTER_FLAG rows for the confirmed basket, written in one transaction. */
async function remoteSaveClusterSelection(input: ClusterSelectionInput): Promise<void> {
  if (!input.sessionId) return
  await post(`/api/sessions/${input.sessionId}/cluster-flags`, {
    items: input.items.map((i) => ({
      issue_id: i.issueId,
      cluster_id: i.clusterId,
      sub_id: i.subId,
      entry_sub_id: i.entrySubId,
      feeling_tags: i.emotions,
      flag: i.flag === false ? null : i.flag,
      free_text: i.free ? (i.freeText ?? '') : null,
      priority_rank: i.rank,
    })),
  })
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
/**
 * The mock only ever holds one child, so it keeps a separate little registry of the
 * faces it has seen — otherwise there is no way to exercise the duplicate-account
 * path without a real database. Dev/UI-review only; it lives in the same localStorage
 * the mock child already uses, and never runs when the PostgreSQL API is configured.
 */
const MOCK_FACES_KEY = 'aram.mock.faces'
interface MockFace {
  childId: string
  descriptor: number[]
}
function readMockFaces(): MockFace[] {
  const raw = localStorage.getItem(MOCK_FACES_KEY)
  return raw ? (JSON.parse(raw) as MockFace[]) : []
}

async function mockRegisterFace(childId: string, descriptor: number[]): Promise<RegisterFaceResult> {
  const faces = readMockFaces()
  // Same two bands as the RPC. The mock holds one device's faces, so there is no
  // school to scope by — every stored face is in scope.
  const nearest = faces
    .filter((f) => f.childId !== childId)
    .map((f) => descriptorDistance(f.descriptor, descriptor))
    .sort((x, y) => x - y)[0]
  if (nearest !== undefined && nearest < FACE_BLOCK_THRESHOLD) {
    return { ok: false, stored: false, review: false, reason: 'duplicate', existingRole: 'student' }
  }
  if (nearest !== undefined && nearest < FACE_MATCH_THRESHOLD) {
    return { ok: true, stored: false, review: true }
  }

  const child = readMock()
  if (child) {
    child.faceDescriptor = descriptor
    writeMock(child)
  }
  localStorage.setItem(
    MOCK_FACES_KEY,
    JSON.stringify([...faces.filter((f) => f.childId !== childId), { childId, descriptor }]),
  )
  return { ok: true, stored: true, review: false }
}

/** No staff faces on the mock, so the override always succeeds — it exists so the
 *  screen's override path can be walked during UI review. */
async function mockOverrideFaceStep(): Promise<FaceOverrideResult> {
  return { ok: true, staffName: 'Staff (mock)' }
}

async function mockDiscardAccount(childId: string): Promise<DiscardAccountResult> {
  localStorage.setItem(
    MOCK_FACES_KEY,
    JSON.stringify(readMockFaces().filter((f) => f.childId !== childId)),
  )
  const child = readMock()
  if (child?.childId === childId) localStorage.removeItem(MOCK_KEY)
  return { ok: true, removed: true }
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
let mockSessionNumber = 0
async function mockStartSession(): Promise<StartedSession> {
  mockSessionNumber += 1
  return { sessionId: mockUuid(), sessionNumber: mockSessionNumber }
}

/**
 * Cluster-selection writes are deliberately dropped by the mock. Everything here is
 * a child's disclosure; persisting it to localStorage on a shared review device would
 * be worse than losing it. The dev drawer's audit log is where to watch the flow.
 */
async function mockDropSafeguardWrite(): Promise<void> {}

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
  loginWithPin: (nickname: string, pin: string, emis = ''): Promise<ChildLoginResult> =>
    isBackendConfigured ? remoteLoginWithPin(nickname, pin, emis) : Promise.resolve({ ok: false, reason: 'invalid' }),
  loginWithFace: (descriptor: number[], emis = ''): Promise<ChildLoginResult> =>
    isBackendConfigured ? remoteLoginWithFace(descriptor, emis) : Promise.resolve({ ok: false, reason: 'invalid' }),
  finalizeOnboarding: (childId: string, consents: ConsentFlags) =>
    isBackendConfigured ? remoteFinalizeOnboarding(childId, consents) : mockFinalizeOnboarding(),
  verifyPin: (childId: string, pin: string) =>
    isBackendConfigured ? remoteVerifyPin(childId, pin) : mockVerifyPin(childId, pin),
  registerFace: (childId: string, descriptor: number[]): Promise<RegisterFaceResult> =>
    isBackendConfigured ? remoteRegisterFace(childId, descriptor) : mockRegisterFace(childId, descriptor),
  overrideFaceStep: (childId: string, staffDescriptor: number[]): Promise<FaceOverrideResult> =>
    isBackendConfigured ? remoteOverrideFaceStep(childId, staffDescriptor) : mockOverrideFaceStep(),
  discardAccount: (childId: string): Promise<DiscardAccountResult> =>
    isBackendConfigured ? remoteDiscardAccount(childId) : mockDiscardAccount(childId),
  verifyFace: (childId: string, descriptor: number[]) =>
    isBackendConfigured ? remoteVerifyFace(childId, descriptor) : mockVerifyFace(childId, descriptor),
  getReturningContext: (childId: string) =>
    isBackendConfigured ? remoteGetReturningContext(childId) : mockGetReturningContext(),
  clearClinicianAlert: (childId: string) =>
    isBackendConfigured ? remoteClearClinicianAlert(childId) : mockClearClinicianAlert(),
  dashboard: (userId: string) =>
    isBackendConfigured ? remoteDashboard(userId) : Promise.resolve({ students: 0, sessions: 0, alerts: 0 }),
  startSession: (childId: string) =>
    isBackendConfigured ? remoteStartSession(childId) : mockStartSession(),
  raiseSafeguardFlag: (input: SafeguardFlagInput) =>
    isBackendConfigured ? remoteRaiseSafeguardFlag(input) : mockDropSafeguardWrite(),
  saveClusterSelection: (input: ClusterSelectionInput) =>
    isBackendConfigured ? remoteSaveClusterSelection(input) : mockDropSafeguardWrite(),
  /** Dev/test-only — see mockSimulateClinicianAlert(). No-op against a real backend. */
  devSimulateClinicianAlert: () =>
    isBackendConfigured ? Promise.resolve() : mockSimulateClinicianAlert(),
}
