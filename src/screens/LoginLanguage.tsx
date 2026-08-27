import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import type { Language } from '../i18n'

const LANGUAGE_OPTIONS: { code: Language; labelKey: string }[] = [
  { code: 'en', labelKey: 's02.english' },
  { code: 'hi', labelKey: 's02.hindi' },
  { code: 'ta', labelKey: 's02.tamil' },
  { code: 'te', labelKey: 's02.telugu' },
  { code: 'ml', labelKey: 's02.malayalam' },
]

export default function LoginLanguage() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const language = useOnboarding((s) => s.language)
  const setLanguage = useOnboarding((s) => s.setLanguage)

  return (
    <Screen hideLogout footer={
      <div className="btn-row">
        <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
          ← {t('common.back')}
        </button>
        <button className="btn btn-next" onClick={() => nav(ROUTES.login)}>
          {t('common.continue')} →
        </button>
      </div>
    }>
      <div className="bg-gradient">
        <div className="sc-sm">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: '0.4rem' }}>
            <div className="aram-logo-circle sc-float">🤲</div>
            <div className="aram-title">{t('brand.name')}</div>
            <div className="aram-subtitle">{t('brand.tagline')}</div>
          </div>
          <div className="sc-anim-2" style={{ textAlign: 'center', fontSize: '1.4rem', color: '#666', lineHeight: 1.5 }}>
            {t('loginLanguage.title')}
          </div>
          <div className="sc-anim-3">
            <div className="field-label">{t('s02.chooseLanguage')}</div>
            <div className="lang-row">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  className={`lang-pill ${language === option.code ? 'active' : 'inactive'}`}
                  onClick={() => setLanguage(option.code)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  )
}
