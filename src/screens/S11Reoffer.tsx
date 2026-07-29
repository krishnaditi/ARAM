import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { api } from '../lib/api'

export default function S11Reoffer() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const childId = useOnboarding((s) => s.childId)
  const [choice, setChoice] = useState<'yes' | 'later'>('later')
  const [busy, setBusy] = useState(false)

  const onContinue = async () => {
    setBusy(true)
    try {
      // Alert is cleared after this login regardless of choice — re-offer happens once.
      if (childId) await api.clearClinicianAlert(childId)
      nav(choice === 'yes' ? ROUTES.emergency : ROUTES.home)
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <div className="btn-row">
      <button className="btn btn-primary" onClick={onContinue} disabled={busy}>
        {t('common.continue')} →
      </button>
    </div>
  )

  return (
    <Screen footer={footer}>
      <div className="bg-soft">
        <div className="sc">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
            <div className="aram-logo-circle sc-float" style={{ fontSize: '2.6rem' }}>
              🌸
            </div>
          </div>
          <div
            className="sc-anim-2"
            style={{
              textAlign: 'center',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#1a1a18',
              lineHeight: 1.3,
            }}
          >
            {t('s11.title')} 💜
          </div>
          <div className="warm-card sc-anim-3">{t('s11.warm')}</div>

          <button
            className={`sc-option sc-anim-4${choice === 'yes' ? ' selected' : ''}`}
            onClick={() => setChoice('yes')}
          >
            <span className="sc-option-icon">💗</span>
            <div>
              <div className="sc-option-title">{t('s11.yesTitle')}</div>
              <div className="sc-option-sub">{t('s11.yesSub')}</div>
            </div>
          </button>

          <button
            className={`sc-option sc-anim-5${choice === 'later' ? ' selected' : ''}`}
            onClick={() => setChoice('later')}
          >
            <span className="sc-option-icon">🌱</span>
            <div>
              <div className="sc-option-title">{t('s11.laterTitle')}</div>
              <div className="sc-option-sub">{t('s11.laterSub')}</div>
            </div>
          </button>

          <div className="note-card gray sc-anim-6">
            <span className="note-card-icon">💛</span>
            <span>{t('s11.note')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
