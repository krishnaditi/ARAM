/** Onboarding + home route map. Screen IDs map to the approved prototype (S01–S11). */
export const ROUTES = {
  welcome: '/welcome', // S01 new-user home
  language: '/language', // S02 language + EMIS
  profile: '/profile', // S03 nickname + DOB + PIN
  parentConsent: '/parent-consent', // S04
  assent: '/assent', // S05 child assent
  camera: '/camera', // S06
  voice: '/voice', // S07
  summary: '/summary', // S08 consent summary
  login: '/login', // S09 PIN login (returning)
  home: '/home', // S10 returning home
  reoffer: '/reoffer', // S11 clinician-alert re-offer
  emergency: '/emergency', // always-available helpline
} as const

/** Linear new-user step order, used to compute progress and next/back. */
export const NEW_USER_STEPS: string[] = [
  ROUTES.welcome,
  ROUTES.language,
  ROUTES.profile,
  ROUTES.parentConsent,
  ROUTES.assent,
  ROUTES.camera,
  ROUTES.voice,
  ROUTES.summary,
]

export function progressFor(path: string): number {
  const i = NEW_USER_STEPS.indexOf(path)
  if (i < 0) return 100
  return Math.round((i / (NEW_USER_STEPS.length - 1)) * 100)
}
