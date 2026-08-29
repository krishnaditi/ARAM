import type { StaffRole } from '../state/onboardingStore'
import { isBackendConfigured, post } from './backendClient'

export interface StaffAccount {
  role: Exclude<StaffRole, 'admin'>
  name: string
  faceDescriptor: number[]
}

export interface StaffLoginResult {
  ok: boolean
  user_id?: string
  display_name?: string
  language?: string
  distance?: number
}

const ACCOUNTS_KEY = 'aram.staff.accounts'
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'aram-admin'

function readAccounts(): StaffAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    return raw ? (JSON.parse(raw) as StaffAccount[]) : []
  } catch {
    return []
  }
}

function writeAccounts(accounts: StaffAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function staffLabel(role: StaffRole): string {
  return {
    student: 'Student',
    parent: 'Parent',
    headmaster: 'Headmaster',
    counsellor: 'Psychologist / counsellor',
    admin: 'Admin',
  }[role]
}

export function getStaffAccount(role: Exclude<StaffRole, 'student' | 'admin'>): StaffAccount | null {
  return readAccounts().find((account) => account.role === role) ?? null
}

export function registerStaff(
  role: Exclude<StaffRole, 'student' | 'admin'>,
  name: string,
  faceDescriptor: number[],
): void {
  const accounts = readAccounts().filter((account) => account.role !== role)
  accounts.push({ role, name: name.trim(), faceDescriptor })
  writeAccounts(accounts)
}

export function verifyStaffFace(
  role: Exclude<StaffRole, 'student' | 'admin'>,
  descriptor: number[],
  distance: (a: number[], b: number[]) => number,
  threshold: number,
): boolean {
  const account = getStaffAccount(role)
  return Boolean(account && distance(account.faceDescriptor, descriptor) < threshold)
}

export function verifyAdmin(username: string, password: string): boolean {
  return username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export async function registerStaffAccount(
  role: Exclude<StaffRole, 'student' | 'admin'>,
  name: string,
  language: string,
  faceDescriptor: number[],
): Promise<{ user_id: string; display_name: string }> {
  if (!isBackendConfigured) {
    registerStaff(role, name, faceDescriptor)
    return { user_id: `local-${role}`, display_name: name.trim() }
  }
  return post('/api/staff/register', {
    role,
    display_name: name,
    language,
    face_descriptor: faceDescriptor,
  })
}

export async function verifyStaffFaceAccount(
  role: Exclude<StaffRole, 'student' | 'admin'>,
  faceDescriptor: number[],
): Promise<StaffLoginResult> {
  if (!isBackendConfigured) return { ok: false }
  return post('/api/staff/verify-face', {
    role,
    display_name: 'face login',
    language: 'en',
    face_descriptor: faceDescriptor,
  })
}

export async function loginAdmin(username: string, password: string): Promise<StaffLoginResult> {
  if (!isBackendConfigured) return { ok: verifyAdmin(username, password), display_name: 'Administrator' }
  return post('/api/admin/login', { username, password })
}

export function adminDemoCredentials(): { username: string; password: string } {
  return { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
}
