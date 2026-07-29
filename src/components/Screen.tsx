import type { ReactNode } from 'react'

interface ScreenProps {
  /** 0–100 progress bar. Omit to hide the bar. */
  progress?: number
  footer?: ReactNode
  children: ReactNode
}

/** The device-framed app column: progress bar, scrollable body, sticky footer. */
export default function Screen({ progress, footer, children }: ScreenProps) {
  return (
    <div className="app-shell">
      <div className="app-screen">
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
