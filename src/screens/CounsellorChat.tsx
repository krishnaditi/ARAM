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
import { askCounsellor, type ChatResult, type ChatTopic, type ChatTurn } from '../lib/counsellorApi'

const DEV: DevInfo = {
  screenId: 'C07',
  screenPos: 'Counsellor chat',
  branch: [
    { c: 'child sends a message', a: '→ POST /api/chat with topics + history → reply bubble' },
    { c: 'crisis words in the child\'s message', a: '→ helpline card stays on screen' },
  ],
  inputs: [{ k: 'basket[]', v: 'Topics + feelings, sent in English for the model' }],
  outputs: [{ k: 'transcript', v: 'Not stored anywhere. Lives in this screen only.' }],
  triggers: [{ c: '✕', a: '→ session ends, back to home' }],
  note: 'Model and prompt live in backend/counsellor.py. The OpenRouter key never reaches the browser.',
}

/** Model output is shown in the same bubbles as ARAM's own copy, which render HTML, so it
 *  is escaped first. Only **bold** and line breaks are turned back into markup. */
function toBubbleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  return escaped.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')
}

/** C07 — after the topics are confirmed, ARAM talks them through like a school counsellor. */
export default function CounsellorChat() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const chat = useChatScript()
  const basket = useSession((s) => s.basket)
  const logEvent = useSession((s) => s.logEvent)
  const language = useOnboarding((s) => s.language)

  const [history, setHistory] = useState<ChatTurn[]>([])
  const [waiting, setWaiting] = useState(false)
  const [failed, setFailed] = useState<Exclude<ChatResult, { ok: true }>['reason'] | null>(null)
  const [crisis, setCrisis] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

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

  const ask = useCallback(
    async (turns: ChatTurn[]) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setFailed(null)
      setWaiting(true)
      try {
        const result = await askCounsellor(language, topicsRef.current, turns, controller.signal)
        if (controller.signal.aborted) return
        setWaiting(false)
        if (!result.ok) {
          setFailed(result.reason)
          return
        }
        if (result.crisis) {
          setCrisis(true)
          logEvent('chat_crisis_signal', 'helplines shown')
        }
        setHistory([...turns, { role: 'assistant', content: result.reply }])
        await chat.say(toBubbleHtml(result.reply), 0)
      } catch {
        // Aborted because the screen closed; nothing to update.
      }
    },
    [chat, language, logEvent],
  )

  // ARAM opens the conversation itself, from the topics alone.
  useEffect(() => {
    if (basket.length === 0) return
    void ask([])
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (basket.length === 0) return <Navigate to={ROUTES.home} replace />

  const send = (value: string) => {
    const turns: ChatTurn[] = [...history, { role: 'user', content: value }]
    chat.user(value)
    setHistory(turns)
    void ask(turns)
  }

  const errorText =
    failed === 'not_configured'
      ? t('cluster.ui.chatUnavailable')
      : failed === 'busy'
        ? t('cluster.ui.chatBusy')
        : t('cluster.ui.chatError')

  return (
    <SessionFrame
      progress={100}
      dev={DEV}
      warnOnLeave={false}
      composer={waiting || failed ? null : { placeholder: t('cluster.ui.chatPlaceholder'), onSend: send, minLength: 1 }}
      scrollKey={`${chat.nodes.length}-${waiting ? 1 : 0}-${failed ?? ''}-${crisis ? 1 : 0}`}
    >
      <ChatStream nodes={chat.nodes} typing={chat.typing || waiting} />

      {crisis && (
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

      {failed && (
        <div className="rail">
          <div className="note-card gray">
            <span className="note-card-icon">⚠️</span>
            <span>{errorText}</span>
          </div>
          {failed !== 'not_configured' && (
            <button type="button" className="opt opt-other" onClick={() => void ask(history)}>
              <span className="opt-tx">{t('cluster.ui.chatRetry')}</span>
            </button>
          )}
        </div>
      )}
    </SessionFrame>
  )
}
