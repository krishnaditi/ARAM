import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SUBSTANCES, type Answer } from './engine'
import type { Option, Question } from './questions'
import BodyFigure from './BodyFigure'

/**
 * The tap options under ARAM's latest question. `onAnswer` gets the answer plus the text
 * echoed back as the child's own bubble, so the transcript reads like a conversation.
 */
export default function AssessmentOptions({
  question,
  onAnswer,
  onPause,
}: {
  question: Question
  onAnswer: (answer: Answer, echo: string) => void
  onPause?: () => void
}) {
  const { t } = useTranslation()
  const [showGloss, setShowGloss] = useState(false)

  const pause = onPause && (
    <button type="button" className="asmt-link" onClick={onPause}>
      🌿 {t('assessment.ui.pause')}
    </button>
  )

  if (question.kind === 'info') {
    return (
      <div className="rail">
        <button type="button" className="opt" onClick={() => onAnswer({ kind: 'ack' }, question.button)}>
          <span className="opt-ic opt-ic-brand">→</span>
          <span className="opt-tx">{question.button}</span>
          <span className="opt-ch">›</span>
        </button>
        {pause}
      </div>
    )
  }

  if (question.kind === 'multi') return <MultiSelect question={question} onAnswer={onAnswer} pause={pause} />
  if (question.kind === 'ever') return <EverUsed onAnswer={onAnswer} pause={pause} />

  const pick = (o: Option) => onAnswer({ kind: 'value', value: o.value }, o.icon ? `${o.icon} ${o.label}` : o.label)

  if (question.layout === 'pills' || question.layout === 'grid11') {
    return (
      <div className="rail">
        <div className={question.layout === 'grid11' ? 'asmt-grid11' : 'pill-wrap asmt-pills'}>
          {question.options.map((o) => (
            <button type="button" key={String(o.value)} className="pill" onClick={() => pick(o)}>
              {o.icon && <span>{o.icon}</span>}
              {o.label}
            </button>
          ))}
        </div>
        {pause}
      </div>
    )
  }

  return (
    <div className="rail">
      {question.gloss && (
        <>
          <button type="button" className="asmt-link" onClick={() => setShowGloss((v) => !v)}>
            💡 {t('assessment.ui.gloss')}
          </button>
          {showGloss && <div className="note-card amber">{question.gloss}</div>}
        </>
      )}
      {question.options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          className={`opt${o.quiet ? ' opt-other' : ''}`}
          onClick={() => pick(o)}
        >
          {o.icon && <span className="opt-ic opt-ic-soft">{o.icon}</span>}
          <span className="opt-body">
            <span className="opt-tx">{o.label}</span>
            {o.sub && <span className="opt-sub">{o.sub}</span>}
          </span>
        </button>
      ))}
      {pause}
    </div>
  )
}

function MultiSelect({
  question,
  onAnswer,
  pause,
}: {
  question: Extract<Question, { kind: 'multi' }>
  onAnswer: (answer: Answer, echo: string) => void
  pause: ReactNode
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (v: string) =>
    setPicked((p) => {
      if (question.exclusive.includes(v)) return p.includes(v) ? [] : [v]
      const rest = p.filter((x) => !question.exclusive.includes(x))
      return rest.includes(v) ? rest.filter((x) => x !== v) : [...rest, v]
    })
  const done = () =>
    onAnswer(
      { kind: 'multi', values: picked },
      question.options.filter((o) => picked.includes(String(o.value))).map((o) => o.label).join(', '),
    )

  const options = question.options.map((o) => {
    const on = picked.includes(String(o.value))
    return (
      <button
        type="button"
        key={String(o.value)}
        className={`opt opt-issue${on ? ' sel' : ''}${o.quiet ? ' opt-other' : ''}`}
        aria-pressed={on}
        onClick={() => toggle(String(o.value))}
      >
        <span className={`opt-cb${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>
        <span className="opt-tx">{o.label}</span>
      </button>
    )
  })

  return (
    <div className="rail">
      {question.figure === 'body' ? (
        <div className="asmt-body-layout">
          <BodyFigure parts={picked} />
          <div className="asmt-body-list">{options}</div>
        </div>
      ) : (
        options
      )}
      <button type="button" className={`bub-go${picked.length ? '' : ' wait'}`} disabled={!picked.length} onClick={done}>
        {t('assessment.ui.done')}
      </button>
      {pause}
    </div>
  )
}

/** SU1: Yes / No for every substance, or one tap for "never tried any" / "rather not say". */
function EverUsed({ onAnswer, pause }: { onAnswer: (answer: Answer, echo: string) => void; pause: ReactNode }) {
  const { t } = useTranslation()
  const [ever, setEver] = useState<Record<string, boolean>>({})
  const allNo = Object.fromEntries(SUBSTANCES.map((s) => [s.id, false]))
  const complete = SUBSTANCES.every((s) => typeof ever[s.id] === 'boolean')
  const done = () => {
    const yes = SUBSTANCES.filter((s) => ever[s.id]).map((s) => t(`assessment.su.names.${s.id}`))
    onAnswer({ kind: 'ever', ever, none: yes.length === 0, rns: false }, yes.length ? yes.join(', ') : t('assessment.su.never'))
  }

  return (
    <div className="rail">
      <button
        type="button"
        className="opt"
        onClick={() => onAnswer({ kind: 'ever', ever: allNo, none: true, rns: false }, t('assessment.su.never'))}
      >
        <span className="opt-tx">{t('assessment.su.never')}</span>
      </button>
      <div className="rail-label asmt-label">{t('assessment.su.orEach')}</div>
      {SUBSTANCES.map((s) => (
        <div className="asmt-sub-row" key={s.id}>
          <span className="asmt-sub-em">{s.em}</span>
          <span className="asmt-sub-txt">
            <span className="opt-tx">{t(`assessment.su.names.${s.id}`)}</span>
            <span className="opt-sub">{t(`assessment.su.local.${s.id}`)}</span>
          </span>
          <button
            type="button"
            className={`asmt-chip${ever[s.id] === false ? ' on-no' : ''}`}
            aria-pressed={ever[s.id] === false}
            onClick={() => setEver((e) => ({ ...e, [s.id]: false }))}
          >
            {t('assessment.ui.no')}
          </button>
          <button
            type="button"
            className={`asmt-chip${ever[s.id] === true ? ' on-yes' : ''}`}
            aria-pressed={ever[s.id] === true}
            onClick={() => setEver((e) => ({ ...e, [s.id]: true }))}
          >
            {t('assessment.ui.yes')}
          </button>
        </div>
      ))}
      <button type="button" className={`bub-go${complete ? '' : ' wait'}`} disabled={!complete} onClick={done}>
        {t('assessment.ui.done')}
      </button>
      <button
        type="button"
        className="opt opt-other"
        onClick={() => onAnswer({ kind: 'ever', ever: allNo, none: false, rns: true }, t('assessment.ui.rns'))}
      >
        <span className="opt-tx">{t('assessment.ui.rns')}</span>
      </button>
      {pause}
    </div>
  )
}
