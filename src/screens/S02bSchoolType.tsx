import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

export default function S02bSchoolType() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const setIsTNGovtSchool = useOnboarding((s) => s.setIsTNGovtSchool)

  const onYes = () => {
    setIsTNGovtSchool(true)
    nav(ROUTES.emis)
  }
  const onNo = () => {
    setIsTNGovtSchool(false)
    nav(ROUTES.profile)
  }

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.language)}>
        ← {t('common.back')}
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.schoolType)} footer={footer}>
      <div className="bg-gradient">
        <div className="sc-sm">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: '0.4rem' }}>
            <div className="aram-logo-circle sc-float">🏫</div>
          </div>
          <div className="sc-anim-2" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a18' }}>
              {t('s02b.title')}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#aaa', marginTop: '0.4rem' }}>
              {t('s02b.subtitle')}
            </div>
          </div>

          <button className="sc-option sc-anim-3" onClick={onYes}>
            <span className="sc-option-icon">✅</span>
            <div>
              <div className="sc-option-title">{t('s02b.yes')}</div>
              <div className="sc-option-sub">{t('s02b.yesSub')}</div>
            </div>
          </button>

          <button className="sc-option sc-anim-4" onClick={onNo}>
            <span className="sc-option-icon">➡️</span>
            <div>
              <div className="sc-option-title">{t('s02b.no')}</div>
              <div className="sc-option-sub">{t('s02b.noSub')}</div>
            </div>
          </button>
        </div>
      </div>
    </Screen>
  )
}
