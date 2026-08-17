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
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const unlock = useOnboarding((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scanningFace, setScanningFace] = useState(false)

  // Shared by PIN success and mock face-login success: re-offer the helpline once if a
  // clinician alert is pending from last session, otherwise go straight home.
  const onUnlocked = async () => {
    unlock()
    if (!childId) return nav(ROUTES.home)
    const ctx = await api.getReturningContext(childId)
    nav(ctx.clinicianAlertPending ? ROUTES.reoffer : ROUTES.home)
  }

  const onUnlock = async () => {
    if (!childId || pin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.verifyPin(childId, pin)
      if (res.ok) {
        await onUnlocked()
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

  // Mocked: there is no real face-match backend yet, so a "scan" always succeeds. The PIN
  // registered on S03 and the face registered on S05b are meant to be interchangeable ways
  // in, so this reuses the exact same unlock path as a correct PIN.
  const onFaceLogin = () => {
    setScanningFace(true)
    window.setTimeout(() => {
      setScanningFace(false)
      void onUnlocked()
    }, 1200)
  }

  const footer = locked ? (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
        ← {t('common.back')}
      </button>
    </div>
  ) : (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
        ← {t('common.back')}
      </button>
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
              {faceRegistered && (
                // .btn-outline's flex:1 assumes a .btn-row (flex row) parent — wrap it in one
                // here too, or the button stretches to fill the .sc flex COLUMN's height instead.
                <div className="btn-row sc-anim-4">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={onFaceLogin}
                    disabled={scanningFace || busy}
                  >
                    {scanningFace ? `⏳ ${t('s09.faceScanning')}` : `🤳 ${t('s09.faceLogin')}`}
                  </button>
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
