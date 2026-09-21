/** Onboarding + home route map. Screen IDs map to the approved prototype (S01–S11). */
export const ROUTES = {
  welcome: '/welcome', // S01 new-user home
  language: '/language', // S02 language select
  schoolType: '/school-type', // S02b TN government school? yes/no
  emis: '/emis', // S02c EMIS code + auto-filled school details (TN govt schools only)
  profile: '/profile', // S03 nickname + DOB + PIN
  parentConsent: '/parent-consent', // S04
  assent: '/assent', // S05 child assent
  faceRegister: '/face-register', // S05b face registration (usable at login alongside the PIN)
  camera: '/camera', // S06
  voice: '/voice', // S07
  summary: '/summary', // S08 consent summary
  login: '/login', // S09 PIN login (returning)
  loginLanguage: '/login-language',
  home: '/home', // S10 returning home
  reoffer: '/reoffer', // S11 clinician-alert re-offer
  emergency: '/emergency', // always-available helpline
  staffRegister: '/staff-register',
  staffDashboard: '/staff-dashboard',

  // Cluster selection (C01–C06), entered from "Start session" on S10. The cluster
  // and sub-cluster ids live in the URL so Back works and a screen can be linked to.
  cluster: '/session/cluster', // C01 which part of life
  subcluster: '/session/cluster/:clusterId', // C02 which part of that
  issues: '/session/cluster/:clusterId/:subId', // C03 what is happening
  basket: '/session/basket', // C05 review + C06 confirm
  redEmergency: '/session/red/:issueId', // RED immediate-risk path
} as const

export const subclusterPath = (clusterId: string) => `/session/cluster/${clusterId}`
export const issuesPath = (clusterId: string, subId: string) =>
  `/session/cluster/${clusterId}/${subId}`
export const redEmergencyPath = (issueId: string) => `/session/red/${encodeURIComponent(issueId)}`

/** Linear new-user step order, used to compute progress and next/back. The EMIS step is
 * skipped for non-TN-government schools, so progress simply jumps two steps at once there. */
export const NEW_USER_STEPS: string[] = [
  ROUTES.welcome,
  ROUTES.language,
  ROUTES.schoolType,
  ROUTES.emis,
  ROUTES.profile,
  ROUTES.parentConsent,
  ROUTES.assent,
  ROUTES.faceRegister,
  ROUTES.camera,
  ROUTES.voice,
  ROUTES.summary,
]

export function progressFor(path: string): number {
  const i = NEW_USER_STEPS.indexOf(path)
  if (i < 0) return 100
  return Math.round((i / (NEW_USER_STEPS.length - 1)) * 100)
}
