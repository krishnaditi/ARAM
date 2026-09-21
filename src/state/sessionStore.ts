import { create } from 'zustand'
import type { FlagLevel } from '../data/clusters'

/**
 * State for one cluster-selection session (S10 "Start session" → C01…C06).
 *
 * Deliberately NOT persisted. The basket is a list of things a child has just
 * disclosed; it is the most sensitive data the app holds, and it has no business
 * sitting in localStorage on a shared school device. It lives for the length of
 * the session and is written to PostgreSQL on confirm, nowhere else.
 */

export interface BasketEntry {
  /** Canonical issue id, or `free_<subId>_<n>` for a child's own words. */
  issueId: string
  /** Only set for free-text entries — taxonomy items resolve through i18n. */
  freeText?: string
  /** CANONICAL home of the item. What every count and rate is keyed on. */
  clusterId: string
  subId: string
  /** Where the child actually tapped it. Browse-path analysis only, never counts. */
  entryClusterId: string
  entrySubId: string
  /** True when the item was reached through an xref rather than its home sub. */
  borrowedEntry: boolean
  /** Emotion ids from EMOTIONS. */
  emotions: string[]
  flag: FlagLevel
  free: boolean
  rank: number
}

export interface AuditEntry {
  type: string
  detail: string
  ts: string
}

interface SessionState {
  /** SESSION row id for this sitting, from api.startSession(). */
  sessionId: string | null
  basket: BasketEntry[]
  auditLog: AuditEntry[]

  /** Dev drawer: reveal the amber/red markers that are hidden from the child. */
  staffView: boolean
  /** Dev drawer: skip typing delays. */
  instant: boolean

  setSessionId: (id: string | null) => void
  addToBasket: (entry: Omit<BasketEntry, 'rank'>) => void
  removeFromBasket: (issueId: string) => void
  logEvent: (type: string, detail: string) => void
  toggleStaffView: () => void
  toggleInstant: () => void
  /** Wipes everything. Called when a session ends and when the child logs out. */
  resetSession: () => void
}

export const useSession = create<SessionState>()((set) => ({
  sessionId: null,
  basket: [],
  auditLog: [],
  staffView: false,
  instant: false,

  setSessionId: (sessionId) => set({ sessionId }),
  addToBasket: (entry) =>
    set((s) =>
      s.basket.some((b) => b.issueId === entry.issueId)
        ? s
        : { basket: [...s.basket, { ...entry, rank: s.basket.length + 1 }] },
    ),
  // Ranks are re-numbered so priority_rank stays 1..n with no gaps after a removal.
  removeFromBasket: (issueId) =>
    set((s) => ({
      basket: s.basket
        .filter((b) => b.issueId !== issueId)
        .map((b, i) => ({ ...b, rank: i + 1 })),
    })),
  logEvent: (type, detail) =>
    set((s) => ({ auditLog: [...s.auditLog, { type, detail, ts: new Date().toISOString() }] })),
  toggleStaffView: () => set((s) => ({ staffView: !s.staffView })),
  toggleInstant: () => set((s) => ({ instant: !s.instant })),
  resetSession: () => set({ sessionId: null, basket: [], auditLog: [] }),
}))

export function amberCount(basket: BasketEntry[]): number {
  return basket.filter((b) => b.flag === 'amber').length
}
