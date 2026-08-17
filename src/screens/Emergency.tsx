import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import SpeakButton from '../components/SpeakButton'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

interface Helpline {
  nameKey: string
  subKey: string
  number: string
  icon: string
}

// India-wide helplines. Update per district/state as the deployment requires.
// KIRAN and the 112 emergency-services line are deliberately left out for now.
const HELPLINES: Helpline[] = [
  { nameKey: 'emergency.teleManasName', subKey: 'emergency.teleManasSub', number: '14416', icon: '💚' },
  { nameKey: 'emergency.childlineName', subKey: 'emergency.childlineSub', number: '1098', icon: '🧒' },
]

export default function Emergency() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const canGoHome = useOnboarding((s) => Boolean(s.childId) && s.unlocked)

  const footer = (
    <div className="btn-row">
      <button className="btn btn-outline" onClick={() => nav(-1)}>
        ← {t('emergency.back')}
      </button>
      {canGoHome && (
        <button className="btn btn-primary" onClick={() => nav(ROUTES.home)}>
          🏠 {t('common.home')}
        </button>
      )}
    </div>
  )

  return (
    <Screen footer={footer}>
      <div className="bg-white">
        <div className="sc">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
            <div className="aram-logo-circle sc-float" style={{ fontSize: '2.8rem' }}>
              🆘
            </div>
          </div>
          <div className="sc-anim-2" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a1a18' }}>
              {t('emergency.title')} 💜
            </div>
            <div style={{ fontSize: '1.2rem', color: '#888', marginTop: '0.6rem', lineHeight: 1.6 }}>
              {t('emergency.subtitle')}
            </div>
          </div>

          {/* Never auto-played: this copy says "hurting yourself" out loud, and the child
              may be sitting in a classroom. Reading it aloud is their call. */}
          <SpeakButton />

          {HELPLINES.map((h) => (
            <a
              key={h.number}
              href={`tel:${h.number}`}
              className="sc-option sc-anim-3"
              style={{ textDecoration: 'none' }}
            >
              <span className="sc-option-icon">{h.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="sc-option-title">{t(h.nameKey)}</div>
                <div className="sc-option-sub">{t(h.subKey)}</div>
              </div>
              <div style={{ fontWeight: 800, color: '#e24b4a', fontSize: '1.5rem' }}>{h.number}</div>
            </a>
          ))}

          <div className="note-card green sc-anim-4">
            <span className="note-card-icon">💛</span>
            <span>{t('emergency.reassure')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
