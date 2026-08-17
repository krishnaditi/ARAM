import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import type { Language } from '../i18n'

const LANGUAGE_OPTIONS: { code: Language; labelKey: string }[] = [
  { code: 'en', labelKey: 's02.english' },
  { code: 'hi', labelKey: 's02.hindi' },
  { code: 'ta', labelKey: 's02.tamil' },
  { code: 'te', labelKey: 's02.telugu' },
  { code: 'ml', labelKey: 's02.malayalam' },
]

export default function S02Language() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const language = useOnboarding((s) => s.language)
  const setLanguage = useOnboarding((s) => s.setLanguage)

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-next" onClick={() => nav(ROUTES.schoolType)}>
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
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  className={`lang-pill ${language === opt.code ? 'active' : 'inactive'}`}
                  onClick={() => setLanguage(opt.code)}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  )
}
