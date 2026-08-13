import type { ReactNode } from 'react'
import VoiceControls from './VoiceControls'
import { useAutoSpeak } from '../speech/useSpeak'

interface ScreenProps {
  /** 0–100 progress bar. Omit to hide the bar. */
  progress?: number
  footer?: ReactNode
  children: ReactNode
}

/** The device-framed app column: progress bar, scrollable body, sticky footer. */
export default function Screen({ progress, footer, children }: ScreenProps) {
  // Every screen renders <Screen>, so voice is driven from the route map in spokenKeys.ts
  // rather than wired into each screen by hand.
  useAutoSpeak()

  return (
    <div className="app-shell">
      <div className="app-screen">
        <VoiceControls />
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
