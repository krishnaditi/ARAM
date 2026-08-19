import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import VoiceControls from './VoiceControls'
import { useAutoSpeak } from '../speech/useSpeak'
import { useLogout } from '../lib/useLogout'

interface ScreenProps {
  /** 0–100 progress bar. Omit to hide the bar. */
  progress?: number
  footer?: ReactNode
  children: ReactNode
  /** Hides the header Logout control. Only S01 (nothing to log out of yet) sets this. */
  hideLogout?: boolean
}

/** The device-framed app column: progress bar, scrollable body, sticky footer. */
export default function Screen({ progress, footer, children, hideLogout }: ScreenProps) {
  // Every screen renders <Screen>, so voice is driven from the route map in spokenKeys.ts
  // rather than wired into each screen by hand. Logout works the same way, so every screen
  // gets it without having to wire it in individually.
  useAutoSpeak()
  const { t } = useTranslation()
  const onLogout = useLogout()

  return (
    <div className="app-shell">
      <div className="app-screen">
        <div className="app-topbar">
          <VoiceControls />
          {!hideLogout && (
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
        <div className="app-body">{children}</div>
        {footer && <div className="app-footer">{footer}</div>}
      </div>
    </div>
  )
}
