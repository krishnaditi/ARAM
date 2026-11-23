import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { useSession } from '../state/sessionStore'
import { useOnboarding } from '../state/onboardingStore'
import { ROUTES } from '../flow'
import {
  askCounsellor,
  type AssessmentContext,
  type ChatResult,
  type ChatTopic,
  type ChatTurn,
} from '../lib/counsellorApi'
import {
  ASMT_CFG,
  applyAnswer,
  finish,
  flagPauseHelp,
  initialState,
  nextStep,
  type Answer,
  type AsmtFlag,
  type AsmtResult,
  type AsmtState,
  type BlockId,
  type Red,
  type StepId,
} from '../assessment/engine'
import { buildQuestion, canPause, escapeHtml } from '../assessment/questions'
import { summariseForCounsellor } from '../assessment/summary'
import AssessmentOptions from '../assessment/AssessmentOptions'
import ScoreCard from '../assessment/ScoreCard'

/**
 * The session plan: a little conversation, a few tap questions, more conversation, and so
 * on, so the assessment never feels like a long form. `turns` is how many messages the
 * student sends in that chat stretch before the next block; the last stretch is open.
 */
type Phase = { chat: number | null; next?: BlockId } | { block: BlockId }
const PLAN: Phase[] = [
  { chat: 2, next: 'feelings' },
  { block: 'feelings' },
  { chat: 2, next: 'mood' },
  { block: 'mood' },
  { chat: 2, next: 'topics' },
  { block: 'topics' },
  { chat: 2, next: 'substances' },
  { block: 'substances' },
  { chat: 1, next: 'safety' },
  { block: 'safety' },
  { chat: null },
]

/** How each block is described to the model when the student comes back from it. */
const BLOCK_ABOUT: Record<BlockId, string> = {
  feelings: 'where they feel it in their body, how they feel inside, their sleep and their appetite',
  mood: 'their mood and worries over the last 2 weeks',
  topics: 'how often their topics happen and how much they affect their day',
  substances: 'things some young people try, like tobacco or alcohol',
  safety: 'staying safe',
}

const HELPLINES = {
  tele: { em: '💜', num: '14416' },
  child: { em: '🧒', num: '1098' },
  emerg: { em: '🚨', num: '112' },
  amb: { em: '🚑', num: '108' },
} as const
type Helpline = keyof typeof HELPLINES
const RED_LINES: Record<Red['mode'], Helpline[]> = {
  suicide: ['tele', 'emerg'],
  safety: ['child', 'emerg', 'tele'],
  medical: ['amb', 'emerg', 'child'],
}

/** Model output is shown in the same bubbles as ARAM's own copy, which render HTML, so it
 *  is escaped first. Only **bold** and line breaks are turned back into markup. */
function toBubbleHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')
}

/** C07: ARAM talks the chosen topics through, with the assessment woven in between. */
export default function CounsellorChat() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const chat = useChatScript()
  const basket = useSession((s) => s.basket)
  const logEvent = useSession((s) => s.logEvent)
  const staffView = useSession((s) => s.staffView)
  const language = useOnboarding((s) => s.language)

  const [history, setHistoryState] = useState<ChatTurn[]>([])
  const historyRef = useRef<ChatTurn[]>([])
  const setHistory = (turns: ChatTurn[]) => {
    historyRef.current = turns
    setHistoryState(turns)
  }
  const [waiting, setWaiting] = useState(false)
  const [failed, setFailed] = useState<Exclude<ChatResult, { ok: true }>['reason'] | null>(null)
  const [crisis, setCrisis] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const [phaseIdx, setPhaseIdx] = useState(0)
  const [chatTurns, setChatTurns] = useState(0)
  const [asmt, setAsmtState] = useState<AsmtState>(initialState)
  const asmtRef = useRef(asmt)
  const [step, setStep] = useState<StepId | null>(null)
  const [result, setResult] = useState<AsmtResult | null>(null)
  const [red, setRed] = useState<Red | null>(null)
  const [paused, setPaused] = useState(false)
  const [pauseHelp, setPauseHelp] = useState(false)
  /** What to do once the pending reply arrives (start a block), kept for Retry. */
  const afterReplyRef = useRef<(() => void) | null>(null)

  const setAsmt = useCallback(
    (next: AsmtState) => {
      // Every flag that appears is written to the session audit log as it is raised.
      const before = new Set(asmtRef.current.flags.map((f: AsmtFlag) => f.code))
      next.flags
        .filter((f) => !before.has(f.code))
        .forEach((f) => logEvent(`assessment_flag_${f.level}`, `${f.code} · ${f.note}`))
      asmtRef.current = next
      setAsmtState(next)
    },
    [logEvent],
  )

  // The model gets the topics in English whatever the screen language: it reads them more
  // reliably, and it is told separately which language to answer in.
  const topicsRef = useRef<ChatTopic[]>([])
  if (topicsRef.current.length === 0 && basket.length > 0) {
    const en = i18n.getFixedT('en')
    topicsRef.current = basket.map((item) => ({
      title: item.free ? (item.freeText ?? '') : en(`cluster.items.${item.issueId}`),
      area: `${en(`cluster.names.${item.clusterId}`)} / ${en(`cluster.subs.${item.subId}`)}`,
      feelings: item.emotions.map((id) => en(`cluster.emotions.${id}`)).filter(Boolean),
      own_words: item.free,
    }))
  }
  // The same topics in the student's own language, for the "Thinking about" lines.
  const shownTopics = basket.map((item) => (item.free ? (item.freeText ?? '') : t(`cluster.items.${item.issueId}`)))

  const context = useCallback(
    (nextBlock: BlockId | null, res: AsmtResult | null = null): AssessmentContext => ({
      summary: summariseForCounsellor(
        asmtRef.current,
        topicsRef.current.map((x) => x.title),
        res,
      ),
      next_block: nextBlock,
      finished: res !== null,
    }),
    [],
  )

  const ask = useCallback(
    async (turns: ChatTurn[], ctx: AssessmentContext, after: (() => void) | null = null) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      afterReplyRef.current = after
      setFailed(null)
      setWaiting(true)
      try {
        const reply = await askCounsellor(language, topicsRef.current, turns, controller.signal, ctx)
        if (controller.signal.aborted) return
        setWaiting(false)
        if (!reply.ok) {
          setFailed(reply.reason)
          return
        }
        if (reply.crisis) {
          setCrisis(true)
          logEvent('chat_crisis_signal', 'helplines shown')
        }
        setHistory([...turns, { role: 'assistant', content: reply.reply }])
        await chat.say(toBubbleHtml(reply.reply), 0)
        afterReplyRef.current = null
        after?.()
      } catch {
        // Aborted because the screen closed; nothing to update.
      }
    },
    [chat, language, logEvent],
  )
  const lastAsk = useRef<{ turns: ChatTurn[]; ctx: AssessmentContext } | null>(null)
  const askTracked = useCallback(
    (turns: ChatTurn[], ctx: AssessmentContext, after: (() => void) | null = null) => {
      lastAsk.current = { turns, ctx }
      return ask(turns, ctx, after)
    },
    [ask],
  )

  // ---------- assessment blocks ----------
  const enterRed = useCallback(
    async (r: Red) => {
      setStep(null)
      setPaused(false)
      setRed(r)
      logEvent('red_emergency', `assessment · ${r.mode} · ${r.source}`)
      await chat.say(`<b>${t(`assessment.red.${r.mode}T`)}</b><br>${t(`assessment.red.${r.mode}B`)}`, 500, 'bub-amber')
    },
    [chat, logEvent, t],
  )

  const showNext = useCallback(
    async (idx: number, state: AsmtState) => {
      const phase = PLAN[idx]
      if (!('block' in phase)) return
      const st = nextStep(phase.block, state, basket.length)
      if (st) {
        const q = buildQuestion(st, state, t, shownTopics)
        for (const bubble of q.bubbles) await chat.say(bubble, 650)
        setStep(st)
        return
      }
      // Block done. After the last one the band is worked out silently.
      let res: AsmtResult | null = null
      if (phase.block === 'safety') {
        const done = finish(state, basket.map((b) => b.issueId))
        setAsmt(done.state)
        setResult(done.result)
        logEvent(
          'assessment_complete',
          `band=${ASMT_CFG.bandNames[done.result.band]} · total=${done.result.total}/${ASMT_CFG.totalMax}`,
        )
        if (done.red) {
          await enterRed(done.red)
          return
        }
        res = done.result
        await chat.say(t('assessment.ui.finished'), 700)
        // Where the staff-only score card appears (rendered only while Staff view is on).
        chat.slot('score')
      }
      const chatIdx = idx + 1
      setPhaseIdx(chatIdx)
      setChatTurns(0)
      const note = res
        ? '(The student has now answered all the quick questions. Their answers are listed under "What the student has answered so far". Do not greet them again. Thank them warmly in one sentence, then carry on helping them with their topics. From here on you can gently offer small, practical ideas when you understand enough.)'
        : `(The student just answered some quick tap questions about ${BLOCK_ABOUT[phase.block]}. Their answers are listed under "What the student has answered so far". Do not greet them again. In 2 or 3 sentences, thank them for answering, gently name one thing you noticed in those answers (for example their sleep or how they feel), then carry on the conversation about their topics with one easy question.)`
      const turns: ChatTurn[] = [...historyRef.current, { role: 'user', content: note }]
      setHistory(turns)
      void askTracked(turns, context(null, res))
    },
    // shownTopics is rebuilt each render from the basket; the basket length guards it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basket, chat, context, enterRed, logEvent, setAsmt, t],
  )

  const startBlock = useCallback(
    (idx: number) => {
      setPhaseIdx(idx)
      void showNext(idx, asmtRef.current)
    },
    [showNext],
  )

  const answer = (ans: Answer, echo: string) => {
    if (!step) return
    const current = step
    setStep(null)
    chat.user(echo)
    const out = applyAnswer(asmtRef.current, current, ans)
    setAsmt(out.state)
    if (out.red) void enterRed(out.red)
    else void showNext(phaseIdx, out.state)
  }

  // ARAM opens the conversation itself, from the topics alone.
  useEffect(() => {
    if (basket.length === 0) return
    void askTracked([], context(null))
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (basket.length === 0) return <Navigate to={ROUTES.home} replace />

  const phase = PLAN[phaseIdx]
  const inChat = 'chat' in phase && !red

  const send = (value: string) => {
    if (!('chat' in phase)) return
    const turns: ChatTurn[] = [...history, { role: 'user', content: value }]
    chat.user(value)
    setHistory(turns)
    const count = chatTurns + 1
    setChatTurns(count)
    const handOver = phase.chat !== null && count >= phase.chat && phase.next
    void askTracked(
      turns,
      context(handOver ? (phase.next ?? null) : null, result),
      handOver ? () => startBlock(phaseIdx + 1) : null,
    )
  }

  const retry = () => {
    if (lastAsk.current) void ask(lastAsk.current.turns, lastAsk.current.ctx, afterReplyRef.current)
  }
  // If the counsellor can't be reached, the questions (including the safety screen) must
  // still be reachable, so the student can move on to the next block without it.
  const nextBlockIdx = inChat && 'chat' in phase && phase.next ? phaseIdx + 1 : null
  const skipToQuestions = () => {
    abortRef.current?.abort()
    setWaiting(false)
    setFailed(null)
    if (nextBlockIdx !== null) startBlock(nextBlockIdx)
  }

  const errorText =
    failed === 'not_configured'
      ? t('cluster.ui.chatUnavailable')
      : failed === 'busy'
        ? t('cluster.ui.chatBusy')
        : t('cluster.ui.chatError')

  const question = step ? buildQuestion(step, asmt, t, shownTopics) : null
  const helplines = (which: Helpline[]) => (
    <div className="asmt-help-list">
      {which.map((k) => (
        <a className="asmt-help" href={`tel:${HELPLINES[k].num}`} key={k}>
          <span>{HELPLINES[k].em}</span>
          <span className="asmt-help-tx">{t(`assessment.red.${k}`)}</span>
          <span className="asmt-help-num">{HELPLINES[k].num}</span>
        </a>
      ))}
    </div>
  )

  const dev: DevInfo = {
    screenId: red ? 'RED' : step ? step.split(':')[0] : 'C07',
    screenPos: red
      ? `Red Emergency, ${red.mode} pathway`
      : 'block' in phase
        ? `Assessment · ${phase.block}${step ? ` · ${step}` : ''}`
        : `Counsellor chat · stretch ${Math.ceil(phaseIdx / 2) + 1}${'chat' in phase && phase.chat ? ` · ${chatTurns}/${phase.chat} messages` : ' · open'}`,
    branch: [
      { c: 'chat stretch reaches its message count', a: '→ AI hands over → next block of tap questions' },
      { c: 'block finished', a: '→ AI reflects on the answers → next chat stretch' },
      { c: 'SU4 yes/unsure · CS4/CS5/CS6b yes · S1 no · S4 yes/unsure', a: '→ Red Emergency, assessment stops' },
      { c: 'after the safety block', a: `→ band worked out silently → open chat` },
    ],
    inputs: [
      { k: 'basket[]', v: 'Topics + feelings, sent in English for the model' },
      { k: 'answers so far', v: 'Plain-English summary sent with every chat request' },
    ],
    outputs: [
      { k: 'flags', v: asmt.flags.length ? asmt.flags.map((f) => `${f.code} (${f.level})`).join(', ') : 'none yet' },
      {
        k: 'band',
        v: result
          ? `${ASMT_CFG.bandNames[result.band]} · total ${result.total}/${ASMT_CFG.totalMax} (${result.pct}%)${result.why.length ? ' · ' + result.why.join('; ') : ''}`
          : 'after the safety block',
      },
      { k: 'storage', v: 'Session audit log only. No assessment tables exist in the database yet.' },
    ],
    triggers: [{ c: '✕', a: '→ session ends, back to home' }],
    note:
      'Question wording, branching, scoring and Red triggers live in src/assessment/engine.ts and are never left to the model. ' +
      (ASMT_CFG.assistPlaceholder ? 'ASSIST scoring uses PLACEHOLDER adult weights. ' : '') +
      'Non-English question text is a machine first pass and needs validated translations before pilot.',
  }

  const progress = Math.round((phaseIdx / (PLAN.length - 1)) * 100)
  const showOptions = question && !chat.typing && !paused && !red

  return (
    <SessionFrame
      progress={red ? 100 : progress}
      dev={dev}
      warnOnLeave={false}
      composer={inChat && !waiting && !failed ? { placeholder: t('cluster.ui.chatPlaceholder'), onSend: send, minLength: 1 } : null}
      scrollKey={`${chat.nodes.length}-${waiting ? 1 : 0}-${failed ?? ''}-${crisis ? 1 : 0}-${step ?? ''}-${paused ? 1 : 0}-${red ? 1 : 0}`}
      alignTop={Boolean(showOptions)}
    >
      <ChatStream
        nodes={chat.nodes}
        typing={chat.typing || waiting}
        slots={{ score: staffView && result ? <ScoreCard result={result} state={asmt} /> : null }}
      />

      {crisis && !red && (
        <div className="note-card pink" role="alert">
          <span className="note-card-icon">💜</span>
          <span>
            {t('cluster.ui.chatHelp')}{' '}
            <button type="button" className="btn-link" onClick={() => nav(ROUTES.emergency)}>
              {t('cluster.ui.chatHelpGo')}
            </button>
          </span>
        </div>
      )}

      {showOptions && question && (
        <AssessmentOptions
          key={step}
          question={question}
          onAnswer={answer}
          onPause={step && canPause(step) ? () => setPaused(true) : undefined}
        />
      )}

      {paused && !red && (
        <div className="rail">
          <div className="note-card green">
            <span>
              <b>{t('assessment.ui.pauseTitle')}</b>
              <br />
              {t('assessment.ui.pauseBody')}
            </span>
          </div>
          <button type="button" className="opt" onClick={() => setPaused(false)}>
            <span className="opt-tx">{t('assessment.ui.pauseReady')}</span>
          </button>
          <button
            type="button"
            className="opt opt-other"
            onClick={() => {
              setPauseHelp(true)
              setAsmt(flagPauseHelp(asmtRef.current))
            }}
          >
            <span className="opt-tx">{t('assessment.ui.pauseTalk')}</span>
          </button>
          {pauseHelp && helplines(['tele', 'child'])}
        </div>
      )}

      {red && !chat.typing && (
        <div className="rail" role="alert">
          {helplines(RED_LINES[red.mode])}
          <button
            type="button"
            className="opt opt-red sc-glow"
            onClick={() => {
              logEvent('red_handoff', `mode=${red.mode}`)
              nav(ROUTES.emergency)
            }}
          >
            <span className="opt-tx">{t('assessment.red.go')}</span>
          </button>
        </div>
      )}

      {failed && !red && (
        <div className="rail">
          <div className="note-card gray">
            <span className="note-card-icon">⚠️</span>
            <span>{errorText}</span>
          </div>
          {failed !== 'not_configured' && (
            <button type="button" className="opt opt-other" onClick={retry}>
              <span className="opt-tx">{t('cluster.ui.chatRetry')}</span>
            </button>
          )}
          {nextBlockIdx !== null && (
            <button type="button" className="opt" onClick={skipToQuestions}>
              <span className="opt-tx">{t('assessment.ui.continue')}</span>
              <span className="opt-ch">›</span>
            </button>
          )}
        </div>
      )}
    </SessionFrame>
  )
}
