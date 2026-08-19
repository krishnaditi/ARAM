import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

export default function S04ParentConsent() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const isTNGovtSchool = useOnboarding((s) => s.isTNGovtSchool)
  const setParentConsent = useOnboarding((s) => s.setParentConsent)

  const onConsent = () => {
    setParentConsent(true)
    nav(ROUTES.assent)
  }

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.profile)}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-green" onClick={onConsent}>
        {isTNGovtSchool ? `${t('s04.proceed')} →` : `✓ ${t('s04.giveConsent')}`}
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.parentConsent)} footer={footer}>
      <div className="bg-white">
        <div className="sc">
          <div className="sc-anim-1" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a1a18' }}>
              {t('s04.title')} 👨‍👩‍👧
            </div>
            <div style={{ fontSize: '1.1rem', color: '#aaa', marginTop: '0.4rem' }}>{t('s04.subtitle')}</div>
          </div>

          <div className="cap-card green sc-anim-2">
            <div className="cap-card-header green">💚 {t('s04.doesTitle')}</div>
            <div className="cap-bullet">{t('s04.does1')}</div>
            <div className="cap-bullet">{t('s04.does2')}</div>
            <div className="cap-bullet">{t('s04.does3')}</div>
          </div>

          <div className="cap-card amber sc-anim-3">
            <div className="cap-card-header amber">🛡️ {t('s04.privacyTitle')}</div>
            <div className="cap-bullet">{t('s04.privacy1')}</div>
            <div className="cap-bullet">{t('s04.privacy2')}</div>
            <div className="cap-bullet">{t('s04.privacy3')}</div>
          </div>

          <div className="note-card purple sc-anim-4">
            <span className="note-card-icon">📝</span>
            <span>{t('s04.consentNote')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
