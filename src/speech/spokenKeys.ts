import { ROUTES } from '../flow'

/** Which i18n strings ARAM speaks aloud, as pre-rendered clips in public/audio/{lang}/{key}.mp3. */

/** 'tap' is mandatory for crisis copy: ARAM is used in classrooms, so the child chooses. */
export type SpeakTrigger = 'auto' | 'tap'

/** A = consent/safety critical, B = arrival + PIN, C = the rest of onboarding. */
export type Tier = 'A' | 'B' | 'C'

export const ENABLED_TIERS: Tier[] = ['A', 'B', 'C']

export interface SpokenLine {
  /** i18n key, and the audio filename stem. */
  key: string
  trigger: SpeakTrigger
  tier: Tier
}

/** Expanded at runtime to the current time of day, so ARAM can greet without saying a name. */
export const GREETING_PLACEHOLDER = 'greeting.__timeOfDay__'
export const GREETING_KEYS = [
  'greeting.morning',
  'greeting.afternoon',
  'greeting.evening',
  'greeting.night',
]

const ALL_LINES: Record<string, SpokenLine[]> = {
  // Read to a parent who may not read either script: consent that wasn't understood isn't consent.
  [ROUTES.parentConsent]: [
    { key: 's04.title', trigger: 'auto', tier: 'A' },
    { key: 's04.does1', trigger: 'auto', tier: 'A' },
    { key: 's04.does2', trigger: 'auto', tier: 'A' },
    { key: 's04.does3', trigger: 'auto', tier: 'A' },
    { key: 's04.privacy1', trigger: 'auto', tier: 'A' },
    { key: 's04.privacy2', trigger: 'auto', tier: 'A' },
    { key: 's04.privacy3', trigger: 'auto', tier: 'A' },
    { key: 's04.consentNote', trigger: 'auto', tier: 'A' },
  ],

  // The child is agreeing here — if they can't read it, the assent isn't real.
  [ROUTES.assent]: [
    { key: 's05.titleSpoken', trigger: 'auto', tier: 'A' },
    { key: 's05.warm', trigger: 'auto', tier: 'A' },
    { key: 's05.question', trigger: 'auto', tier: 'A' },
  ],

  // Tap-only: this copy names self-harm, and being overheard hurts most the children it helps most.
  [ROUTES.reoffer]: [
    { key: 's11.title', trigger: 'tap', tier: 'A' },
    { key: 's11.warm', trigger: 'tap', tier: 'A' },
  ],
  [ROUTES.emergency]: [
    { key: 'emergency.title', trigger: 'tap', tier: 'A' },
    { key: 'emergency.subtitle', trigger: 'tap', tier: 'A' },
    { key: 'emergency.reassure', trigger: 'tap', tier: 'A' },
  ],

  [ROUTES.home]: [
    { key: GREETING_PLACEHOLDER, trigger: 'auto', tier: 'B' },
    { key: 's10.proud', trigger: 'auto', tier: 'B' },
    { key: 's10.todayLabel', trigger: 'auto', tier: 'B' },
  ],
  [ROUTES.welcome]: [
    { key: GREETING_PLACEHOLDER, trigger: 'auto', tier: 'B' },
    { key: 's01.welcome', trigger: 'auto', tier: 'B' },
    { key: 's01.listen', trigger: 'auto', tier: 'B' },
    { key: 's01.brave', trigger: 'auto', tier: 'B' },
  ],
  [ROUTES.login]: [
    { key: 's09.enterPin', trigger: 'auto', tier: 'B' },
    // Tap-only: a lockout names a failure, so don't announce it to the room.
    { key: 's09.lockedSub', trigger: 'tap', tier: 'B' },
  ],

  // Form screens speak what to fill in: on a form the label IS the instruction, and a child
  // who cannot read the screen has no idea what belongs in the boxes. Said as sentences
  // (*Spoken variants) rather than reading bare labels, which sounds robotic.
  // Switching language here re-speaks the screen in the new language — useAutoSpeak
  // depends on it, so choosing Tamil immediately confirms itself in Tamil.
  // Privacy footnotes (emisNote, dobNote, pinNote) are deliberately not spoken: they stay
  // on screen to read, and reciting them makes the walk-through too long to sit through.
  [ROUTES.language]: [
    { key: 's02.intro1', trigger: 'auto', tier: 'C' },
    { key: 's02.intro2', trigger: 'auto', tier: 'C' },
    { key: 's02.chooseLanguage', trigger: 'auto', tier: 'C' },
    { key: 's02.schoolCodeSpoken', trigger: 'auto', tier: 'C' },
  ],
  [ROUTES.profile]: [
    { key: 's03.title', trigger: 'auto', tier: 'C' },
    { key: 's03.subtitle', trigger: 'auto', tier: 'C' },
    { key: 's03.fieldsSpoken', trigger: 'auto', tier: 'C' },
  ],
  [ROUTES.camera]: [
    { key: 's06.title', trigger: 'auto', tier: 'C' },
    { key: 's06.subtitle', trigger: 'auto', tier: 'C' },
    { key: 's06.note', trigger: 'tap', tier: 'C' },
  ],
  [ROUTES.voice]: [
    { key: 's07.title', trigger: 'auto', tier: 'C' },
    { key: 's07.subtitle', trigger: 'auto', tier: 'C' },
    { key: 's07.note', trigger: 'tap', tier: 'C' },
  ],
  [ROUTES.summary]: [
    { key: 's08.titleSpoken', trigger: 'auto', tier: 'C' },
    { key: 's08.readyNote', trigger: 'auto', tier: 'C' },
  ],
}

/** Never spoken: saying a nickname or PIN aloud in a classroom undoes the whole privacy model. */
export const NEVER_SPOKEN = [
  's01.greetingLine', // {{name}}
  's05.title', // {{name}} — spoken as s05.titleSpoken
  's08.title', // {{name}} — spoken as s08.titleSpoken
  's10.greetingLine', // {{name}}
  's10.welcomeBack', // {{days}}
  's09.errWrong', // {{remaining}}
]

function isEnabled(line: SpokenLine): boolean {
  return ENABLED_TIERS.includes(line.tier)
}

/** Lines for a route with the given trigger, filtered to the shipping tiers. */
export function linesFor(route: string, trigger: SpeakTrigger): SpokenLine[] {
  return (ALL_LINES[route] ?? []).filter((l) => isEnabled(l) && l.trigger === trigger)
}

/** Whether a route has tap-to-play copy, i.e. whether to render a listen button. */
export function hasTapLines(route: string): boolean {
  return linesFor(route, 'tap').length > 0
}

/** Every key needing a clip. Drives scripts/render_tts.py, so it follows ENABLED_TIERS. */
export function allSpokenKeys(): string[] {
  const keys = new Set<string>()
  for (const lines of Object.values(ALL_LINES)) {
    for (const line of lines.filter(isEnabled)) {
      if (line.key === GREETING_PLACEHOLDER) GREETING_KEYS.forEach((k) => keys.add(k))
      else keys.add(line.key)
    }
  }
  return [...keys].sort()
}
