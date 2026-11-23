import type { TFunction } from 'i18next'
import {
  BODY_PARTS,
  EMOTIONS,
  INTENSITY_EMOJI,
  SOURCES,
  SUBSTANCES,
  csKey,
  suFeedbackKind,
  usedSubs,
  type AsmtState,
  type StepId,
} from './engine'

/**
 * Turns a step into what the child sees: ARAM's bubble(s) and the tap options under them.
 * All copy comes from the `assessment` i18n section. Every string there is ours, so it may
 * carry <b>; anything the child typed (their own-words topic) is escaped before it goes in.
 */

export interface Option {
  value: number | string | boolean
  label: string
  icon?: string
  sub?: string
  /** Drawn as the outlined secondary card (e.g. "I'd rather not say"). */
  quiet?: boolean
}

export type Question =
  | { kind: 'info'; bubbles: string[]; button: string }
  | { kind: 'single'; bubbles: string[]; options: Option[]; gloss?: string; layout?: 'list' | 'pills' | 'grid11' }
  | { kind: 'multi'; bubbles: string[]; options: Option[]; exclusive: string[]; figure?: 'body' }
  | { kind: 'ever'; bubbles: string[] }

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const sub = (text: string) => `<span class="asmt-sub">${text}</span>`
/** The large floating emoji the prototype puts at the top of a screen. */
const hero = (emoji: string) => `<span class="asmt-hero" aria-hidden="true">${emoji}</span>`

/** "Can pause" steps are the ones the prototype offered a break on. */
export function canPause(step: StepId): boolean {
  return /^(PHQ|GAD|SU|CS|S\d)/.test(step)
}

export function buildQuestion(step: StepId, s: AsmtState, t: TFunction, topics: string[]): Question {
  const [key, a, b] = step.split(':')
  const rns: Option = { value: 'rns', label: t('assessment.ui.rns'), quiet: true }
  const list = (prefix: string, n: number): Option[] =>
    Array.from({ length: n }, (_, i) => ({ value: i, label: t(`${prefix}${i}`) }))
  const yn = (): Option[] => [
    { value: false, label: t('assessment.ui.no'), icon: '😌' },
    { value: true, label: t('assessment.ui.yes'), icon: '😔' },
    rns,
  ]
  const topic = (i: number) => escapeHtml(topics[i] ?? topics[0] ?? '')

  switch (key) {
    case 'A00':
      return {
        kind: 'info',
        bubbles: [
          `<b>${t('assessment.intro.title')}</b><br>${t('assessment.intro.sub')}`,
          [t('assessment.intro.n1'), t('assessment.intro.n2'), t('assessment.intro.n3')].join('<br><br>'),
        ],
        button: t('assessment.intro.ready'),
      }
    case 'A01a':
      return {
        kind: 'multi',
        bubbles: [
          `${sub(t('assessment.ui.thinking', { topic: topic(0) }))}<br>${t('assessment.body.q')}<br>${sub(t('assessment.ui.multiHint'))}`,
        ],
        options: BODY_PARTS.map((p) => ({ value: p, label: t(`assessment.body.parts.${p}`) })),
        exclusive: ['mind'],
        figure: 'body',
      }
    case 'A01b':
      return {
        kind: 'single',
        layout: 'pills',
        bubbles: [t('assessment.body.intensityQ')],
        options: INTENSITY_EMOJI.map((em, i) => ({ value: i, label: t(`assessment.body.int${i}`), icon: em })),
      }
    case 'A02':
      return {
        kind: 'single',
        layout: 'pills',
        bubbles: [`${hero('💭')}${t('assessment.emotion.q')}<br>${sub(t('assessment.emotion.sub'))}`],
        options: EMOTIONS.map((e) => ({ value: e.id, label: t(`assessment.emotion.items.${e.id}`), icon: e.em })),
      }
    case 'A03':
    case 'A04': {
      const k = key === 'A03' ? 'sleep' : 'appetite'
      return {
        kind: 'single',
        bubbles: [`${hero(key === 'A03' ? '🌙' : '🍽️')}${t(`assessment.${k}.q`)}<br>${sub(t(`assessment.${k}.sub`))}`],
        options: list(`assessment.${k}.o`, 5),
      }
    }
    case 'PHQ':
    case 'GAD': {
      const k = `${key.toLowerCase()}${a}`
      // The lead line is said once per instrument, before its first item.
      const lead = a === '0' ? `${t('assessment.scale.lead')}<br><br>` : ''
      return {
        kind: 'single',
        bubbles: [`${lead}<b>${t(`assessment.scale.${k}`)}</b>`],
        options: [...list('assessment.scale.freq', 4), rns],
        gloss: t(`assessment.scale.${k}g`),
      }
    }
    case 'A07':
      return {
        kind: 'single',
        bubbles: [`${sub(t('assessment.ui.goingBack', { topic: topic(Number(a)) }))}<br>${t('assessment.topic.freqQ')}`],
        options: list('assessment.topic.freq', 4),
      }
    case 'A08':
      return {
        kind: 'single',
        bubbles: [t('assessment.topic.impactQ')],
        options: list('assessment.topic.impact', 3),
      }
    case 'A08b':
      return {
        kind: 'single',
        layout: 'grid11',
        bubbles: [`${t('assessment.topic.distressQ')}<br>${sub(t('assessment.topic.distressSub'))}`],
        options: Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) })),
      }
    case 'SU0':
      return {
        kind: 'info',
        bubbles: [
          `<b>${t('assessment.su.leadTitle')}</b><br>${t('assessment.su.leadSub')}`,
          `${t('assessment.su.leadNote1')}<br><br>${t('assessment.su.leadNote2')}`,
        ],
        button: t('assessment.ui.continue'),
      }
    case 'SU1':
      return { kind: 'ever', bubbles: [t('assessment.su.everQ')] }
    case 'SU2': {
      const isFirst = b === 'freq'
      const about = t('assessment.su.about', {
        name: t(`assessment.su.names.${a}`),
        local: t(`assessment.su.local.${a}`),
      })
      const q = b === 'freq' ? t(`assessment.su.freqQ.${a}`) : t(`assessment.su.${b}`)
      const ever3 = b === 'concern' || b === 'cut'
      return {
        kind: 'single',
        bubbles: [isFirst ? `${sub(about)}<br>${q}` : q],
        options: [...(ever3 ? list('assessment.su.ever', 3) : list('assessment.su.freq', 5)), rns],
      }
    }
    case 'SU3':
      return {
        kind: 'single',
        bubbles: [`${t('assessment.su.injectQ')}<br>${sub(t('assessment.su.injectSub'))}`],
        options: [...list('assessment.su.ever', 3), rns],
      }
    case 'SU4':
      return {
        kind: 'single',
        bubbles: [`${t('assessment.su.acuteQ')}<br>${sub(t('assessment.su.acuteSub'))}`],
        options: [
          { value: 'no', label: t('assessment.su.acuteNo') },
          { value: 'yes', label: t('assessment.su.acuteYes') },
          { value: 'unsure', label: t('assessment.su.acuteUnsure') },
        ],
      }
    case 'SU5':
      return {
        kind: 'multi',
        bubbles: [`${t('assessment.su.sourceQ')}<br>${sub(t('assessment.su.sourceSub'))}`],
        options: SOURCES.map((id) => ({ value: id, label: t(`assessment.su.source.${id}`), quiet: id === 'rns' })),
        exclusive: ['rns'],
      }
    case 'SU6': {
      const k = suFeedbackKind(s)
      const names = usedSubs(s).map((id) => t(`assessment.su.names.${id}`).toLowerCase())
      const bubbles = [`<b>${t(`assessment.su.fb.${k}T`)}</b><br>${t(`assessment.su.fb.${k}B`, { list: names.join(', ') })}`]
      if (k === 'moderate' || k === 'high') bubbles.push(t('assessment.su.fb.shakthi'))
      return { kind: 'info', bubbles, button: t('assessment.ui.continue') }
    }
    case 'CS1':
    case 'CS2':
    case 'CS3':
    case 'CS4':
    case 'CS5':
    case 'CS6':
    case 'CS6b': {
      const q = `<b>${t(`assessment.cs.${csKey(key)}`)}</b><br>${sub(t('assessment.cs.sub'))}`
      return { kind: 'single', bubbles: key === 'CS1' ? [t('assessment.cs.intro'), q] : [q], options: yn() }
    }
    case 'S1':
      return {
        kind: 'single',
        bubbles: [t('assessment.safety.safeQ')],
        options: [
          { value: true, label: t('assessment.safety.safeYes'), icon: '✅' },
          { value: false, label: t('assessment.safety.safeNo'), icon: '🆘', sub: t('assessment.safety.safeNoSub') },
          rns,
        ],
      }
    case 'S2':
      return {
        kind: 'single',
        bubbles: [`${t('assessment.safety.hurtQ')}<br>${sub(t('assessment.safety.hurtSub'))}`],
        options: yn(),
      }
    case 'S3':
      return {
        kind: 'single',
        bubbles: [`${t('assessment.safety.whereQ')}<br>${sub(t('assessment.safety.whereSub'))}`],
        options: [
          { value: 'school', label: t('assessment.safety.whereSchool') },
          { value: 'home', label: t('assessment.safety.whereHome') },
          { value: 'else', label: t('assessment.safety.whereElse') },
          rns,
        ],
      }
    case 'S4':
      return {
        kind: 'single',
        bubbles: [t('assessment.safety.reachQ')],
        options: [
          { value: 'yes', label: t('assessment.safety.reachYes'), icon: '⚠️', sub: t('assessment.safety.reachYesSub') },
          { value: 'unsure', label: t('assessment.safety.reachUnsure'), icon: '❓' },
          { value: 'no', label: t('assessment.safety.reachNo'), icon: '🛡️' },
        ],
      }
  }
  return { kind: 'info', bubbles: [], button: t('assessment.ui.continue') }
}

export { SUBSTANCES }
