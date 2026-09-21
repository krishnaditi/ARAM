import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from './Screen'
import SessionDevPanel, { type DevInfo } from './SessionDevPanel'
import { DEV_TOOLS_AVAILABLE } from '../lib/devTools'
import { ROUTES } from '../flow'
import { BASKET_MAX } from '../data/clusters'
import { useSession } from '../state/sessionStore'

interface ComposerProps {
  placeholder: string
  onSend: (value: string) => void
}

interface SessionFrameProps {
  progress: number
  dev: DevInfo
  /** Hidden on the basket and red-emergency screens, exactly as in the prototype. */
  showBasketBar?: boolean
  /** Unlocks the text box. Null (the default) leaves it disabled with a hint. */
  composer?: ComposerProps | null
  /** False once the basket has been written — there is nothing left to lose, so
   *  warning the child that their topics won't be saved would simply be untrue. */
  warnOnLeave?: boolean
  /** Changing this re-runs the scroll. Pass the stream length. */
  scrollKey: unknown
  /** Once the options are on screen, the latest question is pinned to the top
   *  instead of the view sitting at the bottom of the list. */
  alignTop?: boolean
  children: ReactNode
}

/** Shortest input ARAM will accept as "something else, in my own words". */
const MIN_FREE_TEXT = 3

/** The chat shell every C0x screen sits in: ARAM's header, the stream, the basket
 *  bar and the composer. Matches the phone body of the v4 prototype. */
export default function SessionFrame({
  progress,
  dev,
  showBasketBar,
  composer = null,
  warnOnLeave = true,
  scrollKey,
  alignTop,
  children,
}: SessionFrameProps) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const basket = useSession((s) => s.basket)
  const resetSession = useSession((s) => s.resetSession)
  const [devOpen, setDevOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    if (alignTop) {
      const bots = body.querySelectorAll<HTMLElement>('[data-bot]')
      const last = bots[bots.length - 1]
      body.scrollTop = last ? Math.max(0, last.offsetTop - 10) : body.scrollHeight
    } else {
      body.scrollTop = body.scrollHeight
    }
  }, [scrollKey, alignTop])

  // A freshly unlocked composer should be ready to type into without a second tap.
  // Keyed on the boolean, not on `composer` itself — that object is rebuilt on every
  // render, and re-running this each time would wipe the draft as the child typed.
  const composerActive = Boolean(composer)
  useEffect(() => {
    if (composerActive) {
      setDraft('')
      inputRef.current?.focus()
    }
  }, [composerActive])

  const canSend = composerActive && draft.trim().length >= MIN_FREE_TEXT
  const send = () => {
    if (!canSend || !composer) return
    const value = draft.trim()
    setDraft('')
    composer.onSend(value)
  }

  const leave = () => {
    if (warnOnLeave && basket.length && !window.confirm(t('cluster.ui.leaveConfirm'))) return
    resetSession()
    nav(ROUTES.home)
  }

  return (
    <Screen progress={progress} bodyClass="app-body-fixed">
      <div className="chat-screen">
        <div className="chat-head">
          <div className="chat-av">💜</div>
          <div className="chat-head-text">
            <div className="chat-head-name">{t('cluster.ui.headName')}</div>
            <div className="chat-head-status">
              <i />
              {t('cluster.ui.headStatus')}
            </div>
          </div>
          {DEV_TOOLS_AVAILABLE && (
            <button
              type="button"
              className="chat-head-btn"
              onClick={() => setDevOpen((v) => !v)}
              title="Review tools (dev/mock only)"
            >
              🛠
            </button>
          )}
          <button type="button" className="chat-head-btn" onClick={leave} aria-label={t('common.home')}>
            ✕
          </button>
        </div>

        <div className="phone-body" ref={bodyRef}>
          <div className="stream">{children}</div>
        </div>

        {showBasketBar && basket.length > 0 && (
          <button type="button" className="bbar" onClick={() => nav(ROUTES.basket)}>
            <span className="bbar-n">
              {basket.length}/{BASKET_MAX}
            </span>
            <span className="bbar-t">{t('cluster.ui.basketBar')}</span>
            <span className="bbar-go">{t('cluster.ui.basketReview')}</span>
          </button>
        )}

        <div className="composer">
          <input
            ref={inputRef}
            value={draft}
            disabled={!composer}
            placeholder={composer ? composer.placeholder : t('cluster.ui.composerLocked')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <button type="button" className="comp-send" disabled={!canSend} onClick={send} aria-label="Send">
            ➤
          </button>
        </div>

        {devOpen && <SessionDevPanel dev={dev} onClose={() => setDevOpen(false)} />}
      </div>
    </Screen>
  )
}
