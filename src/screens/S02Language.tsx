import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

export default function S02Language() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const language = useOnboarding((s) => s.language)
  const setLanguage = useOnboarding((s) => s.setLanguage)
  const emis = useOnboarding((s) => s.emis)
  const setEmis = useOnboarding((s) => s.setEmis)

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
        ← {t('common.back')}
      </button>
      <button
        className="btn btn-next"
        disabled={emis.trim().length === 0}
        onClick={() => nav(ROUTES.profile)}
      >
        {t('common.continue')} →
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.language)} footer={footer}>
      <div className="bg-gradient">
        <div className="sc-sm">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: '0.4rem' }}>
            <div className="aram-logo-circle sc-float">🤲</div>
            <div className="aram-title">{t('brand.name')}</div>
            <div className="aram-subtitle">{t('brand.tagline')}</div>
          </div>
          <div
            className="sc-anim-2"
            style={{ textAlign: 'center', fontSize: '1.3rem', color: '#666', lineHeight: 1.5 }}
          >
            {t('s02.intro1')}
            <br />
            {t('s02.intro2')}
          </div>

          <div className="sc-anim-3">
            <div className="field-label">{t('s02.chooseLanguage')}</div>
            <div className="lang-row">
              <button
                className={`lang-pill ${language === 'en' ? 'active' : 'inactive'}`}
                onClick={() => setLanguage('en')}
              >
                {t('s02.english')}
              </button>
              <button
                className={`lang-pill ${language === 'ta' ? 'active' : 'inactive'}`}
                onClick={() => setLanguage('ta')}
              >
                {t('s02.tamil')}
              </button>
            </div>
          </div>

          <div className="sc-anim-4">
            <div className="field-label">🏫 {t('s02.schoolCode')}</div>
            <input
              className="sc-input"
              placeholder={t('s02.schoolCodePlaceholder')}
              value={emis}
              inputMode="numeric"
              onChange={(e) => setEmis(e.target.value)}
            />
            <div className="emis-note" style={{ marginTop: '0.6rem' }}>
              🔒 {t('s02.emisNote')}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  )
}
