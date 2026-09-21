import { useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useOnboarding } from '../state/onboardingStore'
import { useSession } from '../state/sessionStore'
import { backendBaseUrl, isBackendConfigured } from '../lib/backendClient'
import { getTimings, subscribeToTimings, SLOW_REQUEST_MS } from '../lib/apiTiming'
import { isDebugOverlayEnabled } from '../lib/devTools'

/**
 * Shows the state that decides what each screen renders, plus the last few API calls.
 *
 * Nearly every "the app behaves differently each time" report in this app comes down to
 * persisted state the child cannot see — most often `childId`, which is what makes the
 * nickname field appear or vanish on S09. Printing it turns a mystery into a glance.
 *
 * Gated by isDebugOverlayEnabled(), so it is present in dev and on the mock, and can be
 * switched on for one device in production via localStorage.
 */
export default function DevStateOverlay() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const timings = useSyncExternalStore(subscribeToTimings, getTimings, getTimings)

  const childId = useOnboarding((s) => s.childId)
  const nickname = useOnboarding((s) => s.nickname)
  const ageGroup = useOnboarding((s) => s.ageGroup)
  const emis = useOnboarding((s) => s.emis)
  const language = useOnboarding((s) => s.language)
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const unlocked = useOnboarding((s) => s.unlocked)
  const staffRole = useOnboarding((s) => s.staffRole)
  const staffUnlocked = useOnboarding((s) => s.staffUnlocked)
  const parentConsent = useOnboarding((s) => s.parentConsent)
  const childAssent = useOnboarding((s) => s.childAssent)
  const sessionId = useSession((s) => s.sessionId)
  const basket = useSession((s) => s.basket)

  if (!isDebugOverlayEnabled()) return null

  if (!open) {
    return (
      <button type="button" className="dbg-fab" onClick={() => setOpen(true)} title="Debug state">
        🐞
      </button>
    )
  }

  // The branch on S09 that decides whether the nickname field is shown at all.
  const loginShows = !childId
    ? 'nickname + PIN + face'
    : faceRegistered
      ? 'PIN + face'
      : 'PIN only'

  const wipe = () => {
    if (!window.confirm('Clear this device’s stored account and reload? Onboarding will start over.')) return
    try {
      localStorage.clear()
    } catch {
      // Nothing to clear, or storage is blocked. Reload anyway.
    }
    window.location.href = '/'
  }

  return (
    <div className="dbg-panel">
      <div className="dbg-head">
        <span>Debug state</span>
        <button type="button" className="dbg-x" onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="dbg-body">
        <Row k="route" v={pathname} />
        <Row k="backend" v={isBackendConfigured ? backendBaseUrl : 'MOCK (no VITE_API_URL)'} />

        <div className="dbg-sec">account</div>
        <Row k="childId" v={childId ?? '— none on this device'} warn={!childId} />
        <Row k="nickname" v={nickname || '—'} />
        <Row k="ageGroup" v={ageGroup ?? '—'} />
        <Row k="emis" v={emis || '—'} />
        <Row k="language" v={language} />
        <Row k="faceRegistered" v={String(faceRegistered)} />
        <Row k="consents" v={`parent=${parentConsent} assent=${childAssent}`} />

        <div className="dbg-sec">session</div>
        <Row k="unlocked" v={String(unlocked)} />
        <Row k="staff" v={staffUnlocked ? `${staffRole} (unlocked)` : 'none'} />
        <Row k="sessionId" v={sessionId ?? '—'} />
        <Row k="basket" v={`${basket.length} item(s)`} />

        <div className="dbg-sec">S09 will show</div>
        <Row k="login form" v={loginShows} />

        <div className="dbg-sec">recent API calls</div>
        {timings.length === 0 ? (
          <div className="dbg-empty">No API calls yet this session.</div>
        ) : (
          [...timings].reverse().map((entry, i) => (
            <div className={`dbg-call${entry.ms >= SLOW_REQUEST_MS ? ' slow' : ''}`} key={i}>
              <span className="dbg-call-ms">{Math.round(entry.ms)}ms</span>
              <span className="dbg-call-path">
                {entry.method} {entry.path}
              </span>
              <span className="dbg-call-meta">
                {entry.status === 0 ? 'FAILED' : entry.status}
                {entry.serverMs !== undefined && ` · srv ${Math.round(entry.serverMs)}ms`}
                {entry.coldStart && ' · COLD START'}
              </span>
            </div>
          ))
        )}

        <button type="button" className="dbg-wipe" onClick={wipe}>
          Clear this device and start over
        </button>
      </div>
    </div>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="dbg-row">
      <span className="dbg-k">{k}</span>
      <span className={`dbg-v${warn ? ' warn' : ''}`}>{v}</span>
    </div>
  )
}
