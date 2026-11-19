import i18n from '../i18n'
import { ASMT_CFG, csRisk, suRisk, usedSubs, type AsmtResult, type AsmtState, type Scored } from './engine'

/**
 * What the AI counsellor is told about the answers so far, in plain English (the model
 * reads English most reliably and is told separately which language to reply in). It is
 * context for a warmer conversation, never something to read back: the backend prompt
 * forbids quoting scores or bands to the child.
 */
export function summariseForCounsellor(s: AsmtState, topics: string[], result: AsmtResult | null): string {
  const en = i18n.getFixedT('en')
  const lines: string[] = []
  const scaled = (v: Scored, prefix: string) =>
    v === 'rns' ? 'rather not say' : typeof v === 'number' ? en(`${prefix}${v}`) : null

  if (s.bodyParts) {
    const parts = s.bodyParts.map((p) => en(`assessment.body.parts.${p}`)).join(', ')
    const int = s.bodyInt === null ? '' : `, strength: ${en(`assessment.body.int${s.bodyInt}`)}`
    lines.push(`Where they feel their worry in the body: ${parts}${int}`)
  }
  if (s.emotion) lines.push(`Feeling right now: ${en(`assessment.emotion.items.${s.emotion}`)}`)
  if (s.sleep !== null) lines.push(`Sleep, last 2 weeks: ${en(`assessment.sleep.o${s.sleep}`)}`)
  if (s.appetite !== null) lines.push(`Appetite, last 2 weeks: ${en(`assessment.appetite.o${s.appetite}`)}`)

  ;(['phq', 'gad'] as const).forEach((w) => {
    s[w].forEach((v, i) => {
      const a = scaled(v, 'assessment.scale.freq')
      if (a) lines.push(`${en(`assessment.scale.${w}${i}`)} (last 2 weeks): ${a}`)
    })
  })

  topics.forEach((topic, i) => {
    const cf = s.cf[i]
    if (!cf || cf.freq === null) return
    const impact = cf.impact === null ? '' : `; affects their day: ${en(`assessment.topic.impact${cf.impact}`)}`
    lines.push(`Topic "${topic}": happens ${en(`assessment.topic.freq${cf.freq}`).toLowerCase()}${impact}`)
  })
  if (s.distress !== null) lines.push(`How heavy everything feels right now: ${s.distress} out of 10`)

  if (s.su.ever) {
    const used = usedSubs(s)
    if (s.su.rns) lines.push('Substances: chose not to answer. Do not press them about it.')
    else if (!used.length) lines.push('Substances: has never tried any.')
    else {
      const risk = ['low', 'moderate', 'high']
      lines.push(
        `Substances tried: ${used.map((id) => `${en(`assessment.su.names.${id}`)} (${risk[suRisk(s, id)]} risk)`).join(', ')}. ` +
          'They were thanked for being honest; do not lecture or warn.',
      )
    }
  }

  if (s.cs.q1 !== null) {
    const r = result ? result.csEscalated : csRisk(s)
    lines.push(
      r === 0
        ? 'Suicide screen: no thoughts of dying or suicide reported.'
        : 'Suicide screen: reported some thoughts about death or not wanting to live; staff have been alerted to check in. ' +
            'Do not ask about the details. Be extra gentle, remind them they are not alone, and mention Tele-MANAS 14416.',
    )
  }
  if (s.sf.hurt === true) lines.push('Safety: said someone is hurting or scaring them; a safeguarding adult has been alerted. Do not ask for details of what happened.')
  else if (s.sf.hurt === 'rns') lines.push('Safety: chose not to say whether anyone is hurting them. Do not press.')

  if (result) lines.push(`Overall wellbeing band (internal, never tell the student): ${ASMT_CFG.bandNames[result.band]}`)
  return lines.join('\n')
}
