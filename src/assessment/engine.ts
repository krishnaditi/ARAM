/**
 * The ARAM assessment (ARAM_Assessment_Prototype_3_v3), as pure functions.
 *
 * The validated instruments here (PHQ-2, GAD-2, ASSIST-Y, C-SSRS) are asked word for word
 * and scored in code. The AI counsellor never words, skips or scores them: it only talks
 * between blocks. Which question comes next, every flag and every Red Emergency is decided
 * here, so the same answers always give the same result.
 *
 * Unlike the prototype's screens, every question is atomic (PHQ-2 is two questions, not one
 * screen) because each one becomes a chat bubble. Answers only ever move forward, so the
 * next question is simply the first unanswered one in the block.
 */

// ===================== CONFIG (clinical team edits here, not in code) =====================
export const ASMT_CFG = {
  totalMax: 24, // body 0-4 + sleep 0-4 + appetite 0-4 + PHQ-2 0-6 + GAD-2 0-6
  bandPct: [30, 55, 78], // ILLUSTRATIVE cut-points, to be set by the clinical team
  bandNames: ['Green', 'Amber', 'Orange', 'Red Non-Emergency'] as const,
  phq2Cut: 3,
  gad2Cut: 3,
  // PLACEHOLDER: adult WHO ASSIST weights and cut-offs. Replace with ASSIST-Y V1.0
  // weightings for the 10-14 and 15-17 versions before pilot.
  assistPlaceholder: true,
  assist: {
    freq: [0, 2, 3, 4, 6],
    crave: [0, 3, 4, 5, 6],
    prob: [0, 4, 5, 6, 7],
    fail: [0, 5, 6, 7, 8],
    concern: [0, 6, 3],
    cut: [0, 6, 3],
    cutAlcohol: [11, 27],
    cutOther: [4, 27],
  },
}

// ===================== REFERENCE DATA =====================
export const BODY_PARTS = ['head', 'chest', 'stomach', 'hands', 'legs', 'whole', 'mind'] as const
export const INTENSITY_EMOJI = ['😌', '🙂', '😐', '😟', '😱']
export const EMOTIONS = [
  { id: 'happy', em: '😊' },
  { id: 'sad', em: '😢' },
  { id: 'worried', em: '😨' },
  { id: 'angry', em: '😠' },
  { id: 'numb', em: '😶' },
  { id: 'confused', em: '😕' },
  { id: 'guilty', em: '😔' },
  { id: 'scared', em: '😱' },
  { id: 'ok', em: '🙂' },
]

export interface Substance {
  id: string
  em: string
  /** Tobacco skips the "not done things you were supposed to" item, as in the ASSIST. */
  noFail?: boolean
  /** Past-3-month use of these makes the "are you unwell right now" check eligible. */
  acute?: boolean
}
export const SUBSTANCES: Substance[] = [
  { id: 'tobacco', em: '🚬', noFail: true },
  { id: 'alcohol', em: '🍺', acute: true },
  { id: 'cannabis', em: '🌿' },
  { id: 'inhalants', em: '🧴', acute: true },
  { id: 'sedatives', em: '💊', acute: true },
  { id: 'opioids', em: '🧪', acute: true },
  { id: 'other', em: '❔', acute: true },
]
const SUB_BY: Record<string, Substance> = Object.fromEntries(SUBSTANCES.map((s) => [s.id, s]))
export const SU_ITEMS = ['freq', 'crave', 'prob', 'fail', 'concern', 'cut'] as const
export type SuItem = (typeof SU_ITEMS)[number]
export const SOURCES = ['friend', 'senior', 'adult_school', 'home', 'shop', 'rns'] as const

/** The basket item that means "I use substances to cope", which raises suicide-screen risk. */
export const COPING_ISSUE_ID = 'sub6'

// ===================== STATE =====================
export type RNS = 'rns'
export type Scored = number | RNS | null
export type YesNo = boolean | RNS | null
export type FlagLevelA = 'info' | 'flag' | 'urgent' | 'realtime'
export interface AsmtFlag {
  code: string
  level: FlagLevelA
  note: string
}
export type SuData = Record<SuItem, Scored>
export type CsKey = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q6b'

export interface AsmtState {
  /** Info steps the child has tapped through (intro, substance lead-in, feedback). */
  seen: string[]
  bodyParts: string[] | null
  bodyInt: number | null
  emotion: string | null
  sleep: number | null
  appetite: number | null
  phq: [Scored, Scored]
  gad: [Scored, Scored]
  su: {
    /** null until SU1 is answered. */
    ever: Record<string, boolean> | null
    none: boolean
    rns: boolean
    d: Record<string, SuData>
    inject: Scored
    acute: 'no' | null
    source: string[] | null
  }
  cf: Record<number, { freq: number | null; impact: number | null }>
  distress: number | null
  cs: Record<CsKey, YesNo>
  sf: {
    safe: YesNo
    hurt: YesNo
    where: 'school' | 'home' | 'else' | RNS | null
    reach: 'no' | null
  }
  flags: AsmtFlag[]
}

export function initialState(): AsmtState {
  return {
    seen: [],
    bodyParts: null,
    bodyInt: null,
    emotion: null,
    sleep: null,
    appetite: null,
    phq: [null, null],
    gad: [null, null],
    su: { ever: null, none: false, rns: false, d: {}, inject: null, acute: null, source: null },
    cf: {},
    distress: null,
    cs: { q1: null, q2: null, q3: null, q4: null, q5: null, q6: null, q6b: null },
    sf: { safe: null, hurt: null, where: null, reach: null },
    flags: [],
  }
}

// ===================== BLOCKS AND STEPS =====================
export type BlockId = 'feelings' | 'mood' | 'topics' | 'substances' | 'safety'
export const BLOCKS: BlockId[] = ['feelings', 'mood', 'topics', 'substances', 'safety']

/** A step id is `KEY` or `KEY:arg`, e.g. `PHQ:1`, `A07:2`, `SU2:alcohol:crave`. */
export type StepId = string

function suData(s: AsmtState, id: string): SuData {
  return s.su.d[id] ?? { freq: null, crave: null, prob: null, fail: null, concern: null, cut: null }
}
const answered = (v: unknown) => v !== null && v !== undefined
const isNum = (v: unknown): v is number => typeof v === 'number'

export function usedSubs(s: AsmtState): string[] {
  const ever = s.su.ever
  return ever ? SUBSTANCES.filter((x) => ever[x.id] === true).map((x) => x.id) : []
}

function suItems(s: AsmtState, id: string): SuItem[] {
  const d = suData(s, id)
  const items: SuItem[] = ['freq']
  if (d.freq === null) return items
  if (isNum(d.freq) && d.freq > 0) {
    items.push('crave', 'prob')
    if (!SUB_BY[id].noFail) items.push('fail')
  }
  items.push('concern', 'cut')
  return items
}

function acuteEligible(s: AsmtState): boolean {
  return usedSubs(s).some((id) => {
    const f = suData(s, id).freq
    return SUB_BY[id].acute && isNum(f) && f > 0
  })
}

/** Every step of a block, given the answers so far (later steps depend on earlier ones). */
export function blockSteps(block: BlockId, s: AsmtState, nTopics: number): StepId[] {
  switch (block) {
    case 'feelings':
      return ['A00', 'A01a', 'A01b', 'A02', 'A03', 'A04']
    case 'mood':
      return ['PHQ:0', 'PHQ:1', 'GAD:0', 'GAD:1']
    case 'topics': {
      const p: StepId[] = []
      for (let i = 0; i < nTopics; i++) p.push(`A07:${i}`, `A08:${i}`)
      p.push('A08b')
      return p
    }
    case 'substances': {
      const p: StepId[] = ['SU0', 'SU1']
      const used = usedSubs(s)
      used.forEach((id) => suItems(s, id).forEach((k) => p.push(`SU2:${id}:${k}`)))
      if (used.length) {
        p.push('SU3')
        if (acuteEligible(s)) p.push('SU4')
        p.push('SU5', 'SU6')
      } else if (s.su.none || s.su.rns) {
        p.push('SU6')
      }
      return p
    }
    case 'safety': {
      const p: StepId[] = ['CS1', 'CS2']
      if (s.cs.q2 !== false) p.push('CS3', 'CS4', 'CS5')
      p.push('CS6')
      if (s.cs.q6 === true || s.cs.q6 === 'rns') p.push('CS6b')
      p.push('S1', 'S2')
      if (s.sf.hurt === true) p.push('S3', 'S4')
      return p
    }
  }
}

export function isAnswered(step: StepId, s: AsmtState): boolean {
  const [key, a, b] = step.split(':')
  switch (key) {
    case 'A00':
    case 'SU0':
    case 'SU6':
      return s.seen.includes(key)
    case 'A01a':
      return s.bodyParts !== null
    case 'A01b':
      return s.bodyInt !== null
    case 'A02':
      return s.emotion !== null
    case 'A03':
      return s.sleep !== null
    case 'A04':
      return s.appetite !== null
    case 'PHQ':
      return answered(s.phq[Number(a)])
    case 'GAD':
      return answered(s.gad[Number(a)])
    case 'A07':
      return answered(s.cf[Number(a)]?.freq)
    case 'A08':
      return answered(s.cf[Number(a)]?.impact)
    case 'A08b':
      return s.distress !== null
    case 'SU1':
      return s.su.ever !== null
    case 'SU2':
      return answered(suData(s, a)[b as SuItem])
    case 'SU3':
      return answered(s.su.inject)
    case 'SU4':
      return s.su.acute !== null
    case 'SU5':
      return s.su.source !== null
    case 'CS1':
    case 'CS2':
    case 'CS3':
    case 'CS4':
    case 'CS5':
    case 'CS6':
    case 'CS6b':
      return answered(s.cs[csKey(key)])
    case 'S1':
      return answered(s.sf.safe)
    case 'S2':
      return answered(s.sf.hurt)
    case 'S3':
      return answered(s.sf.where)
    case 'S4':
      return answered(s.sf.reach)
  }
  return true
}

export const csKey = (stepKey: string) => stepKey.replace('CS', 'q').toLowerCase() as CsKey

export function nextStep(block: BlockId, s: AsmtState, nTopics: number): StepId | null {
  return blockSteps(block, s, nTopics).find((st) => !isAnswered(st, s)) ?? null
}

// ===================== ANSWERS =====================
export type RedMode = 'suicide' | 'safety' | 'medical'
export interface Red {
  mode: RedMode
  source: string
}

/** One tap's worth of answer. Shape depends on the step (see AssessmentCard). */
export type Answer =
  | { kind: 'ack' }
  | { kind: 'value'; value: number | string | boolean }
  | { kind: 'multi'; values: string[] }
  | { kind: 'ever'; ever: Record<string, boolean>; none: boolean; rns: boolean }

function setFlag(s: AsmtState, code: string, level: FlagLevelA, note: string) {
  s.flags = s.flags.filter((f) => f.code !== code).concat({ code, level, note })
}
function unflag(s: AsmtState, ...codes: string[]) {
  s.flags = s.flags.filter((f) => !codes.includes(f.code))
}

/** Applies one answer. Returns the new state and, if the answer is a Red trigger, the Red. */
export function applyAnswer(prev: AsmtState, step: StepId, ans: Answer): { state: AsmtState; red: Red | null } {
  const s: AsmtState = structuredClone(prev)
  const [key, a, b] = step.split(':')
  const v = ans.kind === 'value' ? ans.value : null
  let red: Red | null = null

  switch (key) {
    case 'A00':
    case 'SU0':
    case 'SU6':
      s.seen.push(key)
      break
    case 'A01a': {
      // "Just in my mind" is exclusive, as in the prototype.
      const vals = ans.kind === 'multi' ? ans.values : []
      s.bodyParts = vals.includes('mind') ? ['mind'] : vals
      break
    }
    case 'A01b':
      s.bodyInt = v as number
      break
    case 'A02':
      s.emotion = v as string
      break
    case 'A03':
      s.sleep = v as number
      break
    case 'A04':
      s.appetite = v as number
      break
    case 'PHQ':
    case 'GAD': {
      const which = key === 'PHQ' ? 'phq' : 'gad'
      s[which][Number(a)] = v as Scored
      if (s[which].includes('rns'))
        setFlag(s, `${which}2_nonresponse`, 'info', 'One or both items answered "rather not say". Score is incomplete.')
      else unflag(s, `${which}2_nonresponse`)
      break
    }
    case 'A07':
    case 'A08': {
      const i = Number(a)
      const cur = s.cf[i] ?? { freq: null, impact: null }
      s.cf[i] = key === 'A07' ? { ...cur, freq: v as number } : { ...cur, impact: v as number }
      break
    }
    case 'A08b':
      s.distress = v as number
      break
    case 'SU1':
      if (ans.kind === 'ever') {
        s.su.ever = ans.ever
        s.su.none = ans.none
        s.su.rns = ans.rns
        if (ans.rns)
          setFlag(s, 'substance_nonresponse', 'flag', 'Child chose not to answer the substance screen. Clinician to raise gently at follow-up.')
        else unflag(s, 'substance_nonresponse')
      }
      break
    case 'SU2': {
      const d = { ...suData(s, a), [b]: v as Scored }
      if (b === 'freq' && !(isNum(v) && v > 0)) {
        d.crave = null
        d.prob = null
        d.fail = null
      }
      s.su.d[a] = d
      deriveSubstanceFlags(s)
      break
    }
    case 'SU3':
      s.su.inject = v as Scored
      if (v === 1 || v === 2) setFlag(s, 'injecting', 'urgent', 'Child reports injecting drug use. Same-day clinician contact.')
      else unflag(s, 'injecting')
      break
    case 'SU4':
      // "Not sure" is treated as Yes: a child who has taken something may not judge their state well.
      if (v === 'yes' || v === 'unsure') red = { mode: 'medical', source: `SU4 acute check · ${v}` }
      else s.su.acute = 'no'
      break
    case 'SU5': {
      const vals = ans.kind === 'multi' ? ans.values : []
      s.su.source = vals.includes('rns') ? ['rns'] : vals
      const src = s.su.source
      if (src.includes('adult_school') || src.includes('home'))
        setFlag(
          s,
          'safeguarding_adult_supply',
          'urgent',
          'An adult supplied a substance' +
            (src.includes('adult_school') ? ' at school: exclude school contacts from this alert.' : ' at home.'),
        )
      else unflag(s, 'safeguarding_adult_supply')
      break
    }
    case 'CS1':
    case 'CS2':
    case 'CS3':
    case 'CS4':
    case 'CS5':
    case 'CS6':
    case 'CS6b': {
      const q = csKey(key)
      s.cs[q] = v as YesNo
      if (q === 'q2' && v === false) Object.assign(s.cs, { q3: null, q4: null, q5: null })
      if (q === 'q6' && v === false) s.cs.q6b = null
      if (v === true && (q === 'q4' || q === 'q5' || q === 'q6b')) red = { mode: 'suicide', source: `C-SSRS ${key}=true` }
      deriveCsFlags(s)
      break
    }
    case 'S1':
      if (v === false) {
        red = { mode: 'safety', source: 'S1 · not safe right now' }
        s.sf.safe = false
      } else {
        s.sf.safe = v as YesNo
        if (v === 'rns') setFlag(s, 'safety_nonresponse', 'urgent', 'Did not say whether they are safe right now.')
        else unflag(s, 'safety_nonresponse')
      }
      break
    case 'S2':
      s.sf.hurt = v as YesNo
      if (v !== true) {
        s.sf.where = null
        s.sf.reach = null
        unflag(s, 'safeguarding_disclosure')
      }
      if (v === 'rns')
        setFlag(s, 'safeguarding_followup', 'flag', 'Chose not to say whether anyone is hurting them. Clinician to follow up privately.')
      else unflag(s, 'safeguarding_followup')
      break
    case 'S3':
      s.sf.where = v as AsmtState['sf']['where']
      break
    case 'S4':
      if (v === 'yes' || v === 'unsure') red = { mode: 'safety', source: `S4 · person can reach child (${v})` }
      else {
        s.sf.reach = 'no'
        // A disclosure needs reporting whether or not the person can reach the child now.
        setFlag(
          s,
          'safeguarding_disclosure',
          'urgent',
          'Child disclosed someone is hurting or scaring them' +
            (s.sf.where === 'school' ? ' AT SCHOOL: exclude school contacts' : '') +
            '. POCSO designated person to be informed.',
        )
      }
      break
  }

  if (red) setFlag(s, 'red_emergency', 'realtime', `Mode: ${red.mode}. Source: ${red.source}${excludeSchool(s) ? '. exclude_school_contacts=true' : ''}`)
  return { state: s, red }
}

export function excludeSchool(s: AsmtState): boolean {
  return s.sf.where === 'school' || (s.su.source ?? []).includes('adult_school')
}

/** Marks a pause where the child asked to talk to someone. */
export function flagPauseHelp(prev: AsmtState): AsmtState {
  const s = structuredClone(prev)
  setFlag(s, 'pause_help_requested', 'urgent', 'Child asked to talk to someone during a pause. Offer the helpline consent flow.')
  return s
}

// ===================== SCORING =====================
export function suScore(s: AsmtState, id: string): number {
  const w = ASMT_CFG.assist
  const d = suData(s, id)
  return SU_ITEMS.reduce((t, k) => {
    const x = d[k]
    return isNum(x) ? t + w[k][x] : t
  }, 0)
}
export function suRisk(s: AsmtState, id: string): 0 | 1 | 2 {
  const c = id === 'alcohol' ? ASMT_CFG.assist.cutAlcohol : ASMT_CFG.assist.cutOther
  const sc = suScore(s, id)
  return sc >= c[1] ? 2 : sc >= c[0] ? 1 : 0
}

function deriveSubstanceFlags(s: AsmtState) {
  const maxR = Math.max(0, ...usedSubs(s).map((id) => suRisk(s, id)))
  unflag(s, 'substance_moderate', 'substance_high')
  if (maxR === 1) setFlag(s, 'substance_moderate', 'flag', 'Moderate risk on at least one substance. Minimum band Amber, offer Shakthi substance module.')
  if (maxR === 2) setFlag(s, 'substance_high', 'flag', 'High risk on at least one substance. Minimum band Orange.')
  const inh = suData(s, 'inhalants').freq
  if (s.su.ever?.inhalants === true && isNum(inh) && inh > 0)
    setFlag(s, 'inhalant_use', 'flag', 'Inhalant use in the past 3 months. Acute risk of harm.')
  else unflag(s, 'inhalant_use')
}

/** 0 none, 1 low, 2 moderate, 3 high. "Rather not say" counts as at least the risk it hides. */
export function csRisk(s: AsmtState): number {
  const c = s.cs
  let r = 0
  if (c.q1 === true || c.q2 === true || c.q1 === 'rns' || c.q2 === 'rns') r = 1
  if (c.q3 === true || (c.q6 === true && c.q6b === false)) r = 2
  if ([c.q3, c.q4, c.q5, c.q6b, c.q6].includes('rns')) r = Math.max(r, 2)
  if (c.q4 === true || c.q5 === true || c.q6b === true) r = 3
  return r
}

function deriveCsFlags(s: AsmtState) {
  const r = csRisk(s)
  unflag(s, 'cssrs_low', 'cssrs_moderate', 'cssrs_nonresponse')
  if (r === 1) setFlag(s, 'cssrs_low', 'flag', 'Wish to be dead or passive ideation only. Clinician review; assessment continues.')
  if (r === 2) setFlag(s, 'cssrs_moderate', 'urgent', 'Method, or past behaviour older than 3 months. Same-day clinician alert; band forced to Red Non-Emergency.')
  const rn = (Object.keys(s.cs) as CsKey[]).filter((k) => s.cs[k] === 'rns')
  if (rn.length)
    setFlag(s, 'cssrs_nonresponse', 'urgent', `Chose not to answer: ${rn.join(', ')}. Treated as at least ${r >= 2 ? 'moderate' : 'low'} risk.`)
}

const scaleSum = (a: [Scored, Scored]) => (isNum(a[0]) ? a[0] : 0) + (isNum(a[1]) ? a[1] : 0)

export interface AsmtResult {
  total: number
  pct: number
  /** Index into ASMT_CFG.bandNames. Never shown to the child. */
  band: number
  baseBand: number
  why: string[]
  phq2: number
  gad2: number
  csRisk: number
  csEscalated: number
  suMax: number
  incomplete: boolean
}

/** A13: the composite score and band, plus the flags it derives. May raise a Red. */
export function finish(prev: AsmtState, basketIssueIds: string[]): { state: AsmtState; result: AsmtResult; red: Red | null } {
  const s = structuredClone(prev)
  const bs = s.bodyInt ?? 0
  const ph = scaleSum(s.phq)
  const gd = scaleSum(s.gad)
  const total = bs + (s.sleep ?? 0) + (s.appetite ?? 0) + ph + gd
  const pct = Math.round((total / ASMT_CFG.totalMax) * 100)
  let base = 0
  ASMT_CFG.bandPct.forEach((c, i) => {
    if (pct >= c) base = i + 1
  })
  let band = base
  const why: string[] = []
  const min = (b: number, reason: string) => {
    if (band < b) {
      band = b
      why.push(reason)
    }
  }
  const phqPos = ph >= ASMT_CFG.phq2Cut
  const gadPos = gd >= ASMT_CFG.gad2Cut
  if (phqPos || gadPos) min(1, `${phqPos ? 'PHQ-2' : 'GAD-2'} at or above cut-off → minimum Amber`)
  if (phqPos && gadPos) min(2, 'Both PHQ-2 and GAD-2 positive → minimum Orange')
  const used = usedSubs(s)
  const suMax = Math.max(0, ...used.map((id) => suRisk(s, id)))
  if (suMax === 1) min(1, 'Substance moderate risk → minimum Amber')
  if (suMax === 2) min(2, 'Substance high risk → minimum Orange')
  const cs = csRisk(s)
  const coping = used.length > 0 && basketIssueIds.includes(COPING_ISSUE_ID)
  const csEsc = coping && cs >= 1 ? Math.min(3, cs + 1) : cs
  if (csEsc >= 2) min(3, `C-SSRS moderate${csEsc !== cs ? ' (escalated: substance use to cope)' : ''} → Red Non-Emergency`)

  unflag(s, 'phq2_positive', 'gad2_positive', 'risk_escalated_coping', 'score_incomplete')
  if (phqPos) setFlag(s, 'phq2_positive', 'flag', `PHQ-2 = ${ph}`)
  if (gadPos) setFlag(s, 'gad2_positive', 'flag', `GAD-2 = ${gd}`)
  if (csEsc !== cs) setFlag(s, 'risk_escalated_coping', 'urgent', 'Suicide screen risk raised one level because the child uses substances to cope.')
  const incomplete =
    [s.bodyInt, s.sleep, s.appetite].some((x) => x === null) || [...s.phq, ...s.gad].some((x) => !isNum(x))
  if (incomplete) setFlag(s, 'score_incomplete', 'info', 'Some scored items missing or "rather not say"; treated as 0. Clinician to interpret with care.')

  let red: Red | null = null
  if (csEsc === 3) {
    red = { mode: 'suicide', source: 'A13 escalation · C-SSRS moderate + substance use to cope' }
    setFlag(s, 'red_emergency', 'realtime', `Mode: suicide. Source: ${red.source}`)
  }
  return {
    state: s,
    result: { total, pct, band, baseBand: base, why, phq2: ph, gad2: gd, csRisk: cs, csEscalated: csEsc, suMax, incomplete },
    red,
  }
}

/** SU6: which brief-feedback message the child hears. */
export function suFeedbackKind(s: AsmtState): 'none' | 'rns' | 'past' | 'low' | 'moderate' | 'high' {
  const used = usedSubs(s)
  if (s.su.rns) return 'rns'
  if (!used.length) return 'none'
  const max = Math.max(...used.map((id) => suRisk(s, id)))
  if (max >= 2) return 'high'
  if (max === 1) return 'moderate'
  return used.some((id) => {
    const f = suData(s, id).freq
    return isNum(f) && f > 0
  })
    ? 'low'
    : 'past'
}

export { suData }
