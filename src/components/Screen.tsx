import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import VoiceControls from './VoiceControls'
import { useAutoSpeak } from '../speech/useSpeak'
import { useLogout } from '../lib/useLogout'
import { useOnboarding } from '../state/onboardingStore'
import DevStateOverlay from './DevStateOverlay'

interface ScreenProps {
  /** 0–100 progress bar. Omit to hide the bar. */
  progress?: number
  footer?: ReactNode
  children: ReactNode
  /** Suppresses the header Logout control on a screen that is signed in but should
   *  still not offer it — S10, which renders its own logout; the login screens, where it
   *  would make no sense even if a staff session happened to be open; and the session
   *  chat, which ends itself with the ✕ in its own header. */
  hideLogout?: boolean
  /** Extra class on the body. The chat screens pass `app-body-fixed`: they own their
   *  own scroll area, and a second scrollbar here would carry the composer off-screen. */
  bodyClass?: string
}

/** The device-framed app column: progress bar, scrollable body, sticky footer. */
export default function Screen({ progress, footer, children, hideLogout, bodyClass }: ScreenProps) {
  // Every screen renders <Screen>, so voice is driven from the route map in spokenKeys.ts
  // rather than wired into each screen by hand. Logout works the same way, so every screen
  // gets it without having to wire it in individually.
  useAutoSpeak()
  const { t } = useTranslation()
  const onLogout = useLogout()
  // There is nothing to log out OF until someone has logged in, so the control is
  // driven by session state rather than by each screen remembering to hide it.
  // Onboarding (S01–S08) and PIN entry therefore never show it.
  const unlocked = useOnboarding((s) => s.unlocked)
  const staffUnlocked = useOnboarding((s) => s.staffUnlocked)
  const signedIn = unlocked || staffUnlocked

  return (
    <div className="app-shell">
      <div className="app-screen">
        <div className="app-topbar">
          <VoiceControls />
          {signedIn && !hideLogout && (
            <button type="button" className="logout-icon-btn" onClick={onLogout} title={t('common.logout')}>
              🔒 {t('common.logout')}
            </button>
          )}
        </div>
        {progress !== undefined && (
          <div className="app-progress">
            <div className="app-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className={`app-body${bodyClass ? ' ' + bodyClass : ''}`}>{children}</div>
        {footer && <div className="app-footer">{footer}</div>}
      </div>
      {/* Renders nothing unless debug is switched on for this device. */}
      <DevStateOverlay />
    </div>
  )
}
