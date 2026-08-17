import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useGreeting } from '../lib/useGreeting'

export default function S01Welcome() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const g = useGreeting()
  const name = t('common.friend')

  const footer = (
    <div className="btn-row">
      <button className="btn btn-primary" onClick={() => nav(ROUTES.language)}>
        {t('common.begin')} →
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.welcome)} footer={footer} hideLogout>
      <div className="bg-home">
       <div className="content-col">
        <div
          style={{
            padding: '2.4rem 1.8rem 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div className="aram-logo-wrap sc-anim-1">
            <div className="aram-logo-circle sc-bounce">🤲</div>
            <div className="aram-title">{t('brand.name')}</div>
            <div className="aram-subtitle">{t('brand.tagline')}</div>
          </div>
          <div className="sc-anim-2" style={{ textAlign: 'center' }}>
            <div className="aram-greeting">
              {g.icon} {t('s01.greetingLine', { greeting: g.text, name })} 👋
            </div>
            <div className="aram-tagline" style={{ marginTop: '0.6rem' }}>
              {t('s01.welcome')}
              <br />
              {t('s01.listen')}
            </div>
          </div>
          <div className="brave-card sc-anim-3">🌟 {t('s01.brave')} ✨</div>
        </div>

        <div style={{ padding: '1.4rem 1.8rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="main-cta sc-anim-4 sc-glow" onClick={() => nav(ROUTES.language)}>
            <div className="main-cta-icon">🌈</div>
            <div className="main-cta-text">
              <div className="main-cta-title">{t('s01.ctaTitle')} →</div>
              <div className="main-cta-sub">{t('s01.ctaSub')}</div>
            </div>
          </button>

          <div className="two-col-quad">
            <div className="expect-card sc-anim-5">
              <div className="expect-card-header">
                <div className="expect-icon teal">💬</div>
                <div className="expect-card-title">{t('s01.expectTitle')}</div>
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div className="expect-item" key={i}>
                  <span className="expect-check">✓</span>
                  {t(`s01.expect${i}`)}
                </div>
              ))}
            </div>
            <div className="expect-card sc-anim-5">
              <div className="expect-card-header">
                <div className="expect-icon purple">✨</div>
                <div className="expect-card-title">{t('s01.loveTitle')}</div>
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div className="expect-item" key={i}>
                  <span className="expect-check">✓</span>
                  {t(`s01.love${i}`)}
                </div>
              ))}
            </div>

            <div className="safe-card sc-anim-6">
              <div className="safe-card-title">🛡️ {t('s01.safeTitle')}</div>
              {[1, 2, 3, 4].map((i) => (
                <div className="safe-item" key={i}>
                  ✓ {t(`s01.safe${i}`)}
                </div>
              ))}
            </div>
            <div className="sc-anim-6" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="expect-card" style={{ cursor: 'pointer' }}>
                <div className="expect-card-header">
                  <div className="expect-icon blue">📚</div>
                  <div className="expect-card-title">{t('s01.learnTitle')}</div>
                </div>
                <div style={{ fontSize: '1rem', color: '#888' }}>{t('s01.learnSub')}</div>
              </div>
              <div className="need-help-card">
                <div className="need-help-title">🆘 {t('s01.needHelpTitle')}</div>
                <div className="need-help-sub">{t('s01.needHelpSub')}</div>
                <button className="help-btn" onClick={() => nav(ROUTES.emergency)}>
                  {t('common.getEmergencySupport')}
                </button>
              </div>
            </div>
          </div>

          <div className="remember-card sc-anim-6">
            <div className="remember-icon">💜</div>
            <div>
              <div className="remember-title">{t('s01.rememberTitle')} 💜</div>
              <div className="remember-sub">{t('s01.rememberSub')}</div>
            </div>
          </div>
          <div style={{ height: '0.8rem' }} />
        </div>
        </div>
      </div>
    </Screen>
  )
}
