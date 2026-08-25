import type { StaffRole } from '../state/onboardingStore'

export interface StaffAccount {
  role: Exclude<StaffRole, 'admin'>
  name: string
  faceDescriptor: number[]
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

export function adminDemoCredentials(): { username: string; password: string } {
  return { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
}
