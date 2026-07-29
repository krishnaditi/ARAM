import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import PinEntry from '../components/PinEntry'
import BrandLogo from '../components/BrandLogo'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { api } from '../lib/api'

export default function S09Login() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const childId = useOnboarding((s) => s.childId)
  const unlock = useOnboarding((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)

  const onUnlock = async () => {
    if (!childId || pin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.verifyPin(childId, pin)
      if (res.ok) {
        unlock()
        // Branch: re-offer helpline once if a clinician alert is pending from last session.
        const ctx = await api.getReturningContext(childId)
        nav(ctx.clinicianAlertPending ? ROUTES.reoffer : ROUTES.home)
        return
      }
      setPin('')
      if (res.locked) {
        setLocked(true)
      } else {
        setError(t('s09.errWrong', { remaining: res.remainingAttempts }))
      }
    } finally {
      setBusy(false)
    }
  }

  const footer = locked ? undefined : (
    <div className="btn-row">
      <button className="btn btn-primary" onClick={onUnlock} disabled={pin.length !== 4 || busy}>
        {t('s09.unlock')} →
      </button>
    </div>
  )

  return (
    <Screen footer={footer}>
      <div className="bg-gradient">
        <div className="sc" style={{ justifyContent: 'center', gap: '2rem' }}>
          <BrandLogo animation="bounce" taglineKey="welcomeBack" />

          {locked ? (
            <>
              <div
                className="sc-anim-2"
                style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 800, color: '#8b2500' }}
              >
                🔒 {t('s09.lockedTitle')}
              </div>
              <div className="note-card pink sc-anim-3">
                <span className="note-card-icon">🔒</span>
                <span>{t('s09.lockedSub')}</span>
              </div>
            </>
          ) : (
            <>
              <div className="sc-anim-2" style={{ textAlign: 'center', fontSize: '1.3rem', color: '#888' }}>
                {t('s09.enterPin')}
              </div>
              <PinEntry value={pin} onChange={setPin} autoFocus ariaLabel={t('s09.enterPin')} />
              {error && (
                <div className="note-card pink sc-anim-3">
                  <span className="note-card-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              <div className="note-card gray sc-anim-4">
                <span className="note-card-icon">🔒</span>
                <span>{t('s09.note')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Screen>
  )
}
