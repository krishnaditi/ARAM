import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { api } from '../lib/api'

export default function S08Summary() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const s = useOnboarding()
  const name = s.nickname || t('common.friend')
  const [busy, setBusy] = useState(false)

  const rows: { key: string; val: string }[] = [
    { key: t('s08.parentConsent'), val: `✓ ${t('s08.given')}` },
    { key: t('s08.yourAgreement'), val: `✓ ${t('s08.given')}` },
    { key: t('s08.cameraAccess'), val: s.cameraOptIn ? `✓ ${t('s08.allowed')}` : t('s08.declined') },
    { key: t('s08.voiceAccess'), val: s.voiceOptIn ? `✓ ${t('s08.allowed')}` : t('s08.declined') },
    { key: t('s08.school'), val: `✓ ${t('s08.linked')}` },
  ]

  const onBegin = async () => {
    if (!s.childId) return nav(ROUTES.welcome)
    setBusy(true)
    try {
      await api.finalizeOnboarding(s.childId, {
        parentConsent: s.parentConsent,
        childAssent: s.childAssent,
        cameraOptIn: s.cameraOptIn,
        voiceOptIn: s.voiceOptIn,
      })
      s.clearSecrets()
      s.unlock()
      nav(ROUTES.home)
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.voice)} disabled={busy}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-primary" onClick={onBegin} disabled={busy}>
        {t('s08.beginCta')} 🌱
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.summary)} footer={footer}>
      <div className="bg-gradient">
        <div className="sc" style={{ justifyContent: 'center', gap: '1.4rem' }}>
          <div className="aram-logo-wrap sc-anim-1">
            <div className="aram-logo-circle sc-float" style={{ fontSize: '2.8rem' }}>
              ✅
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a18' }}>
              {t('s08.title', { name })}
            </div>
          </div>

          <div className="summary-card sc-anim-2">
            {rows.map((r) => {
              const isYes = r.val.startsWith('✓')
              return (
                <div className="summary-row" key={r.key}>
                  <span className="summary-key">{r.key}</span>
                  <span className={`summary-val${isYes ? ' yes' : ''}`}>{r.val}</span>
                </div>
              )
            })}
          </div>

          <div className="note-card teal sc-anim-3">
            <span className="note-card-icon">💡</span>
            <span>{t('s08.settingsNote')}</span>
          </div>
          <div className="note-card green sc-anim-4">
            <span className="note-card-icon">🌱</span>
            <span>{t('s08.readyNote')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
