import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import Toggle from '../components/Toggle'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

export default function S06Camera() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const on = useOnboarding((s) => s.cameraOptIn)
  const setOn = useOnboarding((s) => s.setCameraOptIn)

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.assent)}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-next" onClick={() => nav(ROUTES.voice)}>
        {t('common.continue')} →
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.camera)} footer={footer}>
      <div className="bg-white">
        <div className="sc">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
            <div className="aram-logo-circle sc-float" style={{ fontSize: '2.8rem' }}>
              📷
            </div>
          </div>
          <div className="sc-anim-2" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a18' }}>{t('s06.title')}</div>
            <div style={{ fontSize: '1.1rem', color: '#aaa', marginTop: '0.4rem' }}>{t('s06.subtitle')}</div>
          </div>

          <div className="cap-card green sc-anim-3">
            <div className="cap-card-header green" style={{ fontSize: '1.1rem' }}>
              {t('s06.whyTitle')}
            </div>
            <div className="cap-bullet">{t('s06.why1')}</div>
            <div className="cap-bullet">{t('s06.why2')}</div>
            <div className="cap-bullet">{t('s06.why3')}</div>
          </div>

          <div className="dots-row sc-anim-4">
            <div className="dot done" />
            <div className="dot done" />
            <div className="dot done" />
            <div className="dot active" />
            <div className="dot" />
          </div>

          <div className="toggle-row sc-anim-4">
            <div className="toggle-info">
              <div className="toggle-title">{t('s06.allow')}</div>
              <div className="toggle-sub">{t('s06.allowSub')}</div>
            </div>
            <Toggle on={on} onChange={setOn} label={t('s06.allow')} />
          </div>

          <div className="note-card gray sc-anim-5">
            <span className="note-card-icon">ℹ️</span>
            <span>{t('s06.note')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
