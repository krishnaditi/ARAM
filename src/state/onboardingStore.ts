import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../i18n'
import { setLanguage as applyLanguage } from '../i18n'

export interface DobParts {
  day: string
  month: string
  year: string
}

/** Derive a coarse age band from a DOB. The full DOB is NEVER persisted or sent. */
export function deriveAgeGroup(dob: DobParts, now: Date = new Date()): string | null {
  const d = Number(dob.day)
  const m = Number(dob.month)
  const y = Number(dob.year)
  if (!d || !m || !y || y < 1990 || y > now.getFullYear()) return null
  let age = now.getFullYear() - y
  const beforeBirthday =
    now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)
  if (beforeBirthday) age -= 1
  if (age < 10) return 'under-10'
  if (age <= 12) return '10-12'
  if (age <= 15) return '13-15'
  if (age <= 18) return '16-18'
  return '18-plus'
}

interface OnboardingState {
  // Persisted (non-sensitive) resume data
  language: Language
  emis: string
  nickname: string
  ageGroup: string | null
  parentConsent: boolean
  childAssent: boolean
  cameraOptIn: boolean
  voiceOptIn: boolean
  childId: string | null

  // Transient secrets — held in memory only, never persisted
  dob: DobParts
  pin: string
  pinConfirm: string

  // Session-only unlock flag. Deliberately NOT persisted: a fresh app open/reload
  // always starts locked, so the PIN gate can't be bypassed by opening /home directly.
  unlocked: boolean

  // Actions
  setLanguage: (lang: Language) => void
  setEmis: (emis: string) => void
  setNickname: (nickname: string) => void
  setDob: (dob: Partial<DobParts>) => void
  setPin: (pin: string) => void
  setPinConfirm: (pin: string) => void
  setParentConsent: (v: boolean) => void
  setChildAssent: (v: boolean) => void
  setCameraOptIn: (v: boolean) => void
  setVoiceOptIn: (v: boolean) => void
  commitChild: (childId: string, ageGroup: string) => void
  clearSecrets: () => void
  unlock: () => void
  logout: () => void
  reset: () => void
}

const emptyDob: DobParts = { day: '', month: '', year: '' }

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      language: 'en',
      emis: '',
      nickname: '',
      ageGroup: null,
      parentConsent: false,
      childAssent: false,
      cameraOptIn: false,
      voiceOptIn: false,
      childId: null,

      dob: { ...emptyDob },
      pin: '',
      pinConfirm: '',
      unlocked: false,

      setLanguage: (language) => {
        applyLanguage(language)
        set({ language })
      },
      setEmis: (emis) => set({ emis }),
      setNickname: (nickname) => set({ nickname }),
      setDob: (dob) => set((s) => ({ dob: { ...s.dob, ...dob } })),
      setPin: (pin) => set({ pin }),
      setPinConfirm: (pinConfirm) => set({ pinConfirm }),
      setParentConsent: (parentConsent) => set({ parentConsent }),
      setChildAssent: (childAssent) => set({ childAssent }),
      setCameraOptIn: (cameraOptIn) => set({ cameraOptIn }),
      setVoiceOptIn: (voiceOptIn) => set({ voiceOptIn }),
      commitChild: (childId, ageGroup) =>
        set({ childId, ageGroup, dob: { ...emptyDob }, pin: '', pinConfirm: '' }),
      clearSecrets: () => set({ dob: { ...emptyDob }, pin: '', pinConfirm: '' }),
      unlock: () => set({ unlocked: true }),
      logout: () => set({ unlocked: false }),
      reset: () =>
        set({
          emis: '',
          nickname: '',
          ageGroup: null,
          parentConsent: false,
          childAssent: false,
          cameraOptIn: false,
          voiceOptIn: false,
          childId: null,
          dob: { ...emptyDob },
          pin: '',
          pinConfirm: '',
          unlocked: false,
        }),
    }),
    {
      name: 'aram.onboarding',
      // Persist only non-sensitive resume data. Secrets (dob, pin) are excluded by design.
      partialize: (s) => ({
        language: s.language,
        emis: s.emis,
        nickname: s.nickname,
        ageGroup: s.ageGroup,
        parentConsent: s.parentConsent,
        childAssent: s.childAssent,
        cameraOptIn: s.cameraOptIn,
        voiceOptIn: s.voiceOptIn,
        childId: s.childId,
      }),
    },
  ),
)
