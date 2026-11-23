import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { useSession } from '../state/sessionStore'
import { useOnboarding } from '../state/onboardingStore'
import { ROUTES } from '../flow'
import { askCounsellor, type ChatResult, type ChatTurn, type Persona } from '../lib/counsellorApi'
import { escapeHtml } from '../assessment/questions'
import PersonaPicker from '../assessment/PersonaPicker'
import { PERSONAS } from '../assessment/personas'

/** Model output is escaped before it goes into a bubble; only **bold** and line breaks survive. */
function toBubbleHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')
}

/**
 * "My Buddies" on the dashboard: the student picks a friend, a parent or a counsellor and
 * chats straight away, with no topics and no assessment. The same safety rules apply as in
 * a session (they live in the shared prompt), and the crisis check still shows helplines.
 */
export default function BuddyChat() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const chat = useChatScript()
  const logEvent = useSession((s) => s.logEvent)
  const language = useOnboarding((s) => s.language)

  const [persona, setPersona] = useState<Persona | null>(null)
  const [picking, setPicking] = useState(false)
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [waiting, setWaiting] = useState(false)
  const [failed, setFailed] = useState<Exclude<ChatResult, { ok: true }>['reason'] | null>(null)
  const [crisis, setCrisis] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    chat.run(async (s) => {
      await s.say(`<b>${t('assessment.persona.buddiesTitle')}</b><br>${t('assessment.persona.buddiesSub')}`, 500)
      setPicking(true)
    })
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ask = useCallback(
    async (p: Persona, turns: ChatTurn[]) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setFailed(null)
      setWaiting(true)
      try {
        const reply = await askCounsellor(
          language,
          [],
          turns,
          controller.signal,
          { summary: '', next_block: null, finished: false, persona: p },
          'direct',
        )
        if (controller.signal.aborted) return
        setWaiting(false)
        if (!reply.ok) {
          setFailed(reply.reason)
          return
        }
        if (reply.crisis) {
          setCrisis(true)
          logEvent('chat_crisis_signal', `buddy=${p} · helplines shown`)
        }
        setHistory([...turns, { role: 'assistant', content: reply.reply }])
        await chat.say(toBubbleHtml(reply.reply), 0)
      } catch {
        // Aborted because the screen closed.
      }
    },
    [chat, language, logEvent],
  )

  const pick = (p: Persona) => {
    setPicking(false)
    setPersona(p)
    logEvent('buddy_chat_started', p)
    chat.user(t('assessment.persona.picked', { name: t(`assessment.persona.${p}.name`) }))
    void ask(p, [])
  }

  const send = (value: string) => {
    if (!persona) return
    const turns: ChatTurn[] = [...history, { role: 'user', content: value }]
    chat.user(value)
    setHistory(turns)
    void ask(persona, turns)
  }

  const dev: DevInfo = {
    screenId: 'BUD',
    screenPos: persona ? `Buddy chat · ${persona}` : 'My Buddies · choosing',
    branch: [
      { c: 'persona picked', a: '→ POST /api/chat with entry=direct, no topics, no assessment' },
      { c: 'crisis words in the student\'s message', a: '→ helpline card stays on screen' },
    ],
    inputs: [{ k: 'persona', v: persona ?? 'not chosen' }],
    outputs: [{ k: 'transcript', v: 'Not stored anywhere. Lives in this screen only.' }],
    triggers: [{ c: '✕', a: '→ back to home' }],
    note: 'Persona prompts live in backend/counsellor.py (PERSONAS). Safety rules are shared by all three.',
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
      dev={dev}
      warnOnLeave={false}
      composer={persona && !waiting && !failed ? { placeholder: t('cluster.ui.chatPlaceholder'), onSend: send, minLength: 1 } : null}
      scrollKey={`${chat.nodes.length}-${picking ? 1 : 0}-${waiting ? 1 : 0}-${failed ?? ''}-${crisis ? 1 : 0}`}
      head={
        persona
          ? { name: t(`assessment.persona.${persona}.name`), img: PERSONAS.find((x) => x.id === persona)!.img }
          : undefined
      }
    >
      <ChatStream nodes={chat.nodes} typing={chat.typing || waiting} />

      {picking && !chat.typing && <PersonaPicker onPick={pick} />}

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

      {failed && persona && (
        <div className="rail">
          <div className="note-card gray">
            <span className="note-card-icon">⚠️</span>
            <span>{errorText}</span>
          </div>
          {failed !== 'not_configured' && (
            <button type="button" className="opt opt-other" onClick={() => void ask(persona, history)}>
              <span className="opt-tx">{t('cluster.ui.chatRetry')}</span>
            </button>
          )}
        </div>
      )}
    </SessionFrame>
  )
}
