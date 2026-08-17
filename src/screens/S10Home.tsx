import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { api, type ReturningContext } from '../lib/api'
import { isBackendConfigured } from '../lib/supabaseClient'
import { useGreeting } from '../lib/useGreeting'

export default function S10Home() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const g = useGreeting()
  const childId = useOnboarding((s) => s.childId)
  const storedName = useOnboarding((s) => s.nickname)
  const logout = useOnboarding((s) => s.logout)
  const [ctx, setCtx] = useState<ReturningContext | null>(null)

  const onLogout = () => {
    if (window.confirm(t('common.logoutConfirm'))) {
      logout()
      nav(ROUTES.login)
    }
  }

  // Dev/test only: simulate a clinician alert so the S11 re-offer screen can be
  // exercised. Real session content (mood tracking / concerning-conversation
  // detection) is what would set this for real — not built yet — so there is
  // otherwise no way to reach S11. Never shown against a real backend.
  const onSimulateAlert = async () => {
    await api.devSimulateClinicianAlert()
    logout()
    nav(ROUTES.login)
  }

  useEffect(() => {
    let alive = true
    if (childId) {
      void api.getReturningContext(childId).then((c) => {
        if (alive) setCtx(c)
      })
    }
    return () => {
      alive = false
    }
  }, [childId])

  const name = ctx?.name || storedName || t('common.friend')
  const avatarInitial = name.charAt(0).toUpperCase()

  const stats = [
    { icon: '📊', trend: '📈', cls: '', val: ctx?.sessionsCompleted ?? 0, label: t('s10.statSessions') },
    { icon: '🎯', trend: '🔥', cls: 'orange', val: ctx?.streak ?? 0, label: t('s10.statStreak') },
    { icon: '🌟', trend: '✨', cls: 'pink', val: `${ctx?.buddiesUnlocked ?? 0}/5`, label: t('s10.statBuddies') },
    { icon: '🏆', trend: '⭐', cls: 'blue', val: ctx?.achievements ?? 0, label: t('s10.statAchievements') },
  ]

  const quickActions = [
    { icon: '🌬️', iconCls: 'teal', title: t('s10.quickBreathing'), sub: t('s10.quickBreathingSub') },
    { icon: '📈', iconCls: 'blue', title: t('s10.myProgress'), sub: t('s10.myProgressSub') },
    { icon: '✨', iconCls: 'pink', title: t('s10.myBuddies'), sub: t('s10.myBuddiesSub') },
  ]

  return (
    <Screen hideLogout>
      <div className="bg-home">
        <button
          type="button"
          className="back-icon-btn"
          onClick={() => nav(-1)}
          aria-label={t('common.back')}
          title={t('common.back')}
        >
          ←
        </button>
        <div className="content-col">
        <div className="ret-header sc-anim-1">
          <div className="ret-avatar">{avatarInitial}</div>
          <div className="ret-greeting-block">
            <div className="ret-greeting">
              {g.icon} {t('s10.greetingLine', { greeting: g.text, name })} 👋
            </div>
            <div className="ret-sub">{t('s10.welcomeBack', { days: ctx?.daysSinceLast ?? 0 })}</div>
            <div className="ret-sub">{t('s10.proud')} 🌟</div>
          </div>
          <div className="ret-logo-block">
            <div className="ret-logo-circle sc-bounce">🤲</div>
            <div className="ret-logo-title">{t('brand.name')}</div>
            <div className="ret-logo-sub">{t('brand.tagline')}</div>
            <button className="ret-logout-btn" onClick={onLogout}>
              🔒 {t('common.logout')}
            </button>
          </div>
        </div>

        <div className="stats-grid sc-anim-2">
          {stats.map((st) => (
            <div className="stat-card" key={st.label}>
              <div className={`stat-card-icon ${st.cls || 'purple'}`}>{st.icon}</div>
              <div className="stat-card-trend">{st.trend}</div>
              <div className={`stat-card-val${st.cls ? ' ' + st.cls : ''}`}>{st.val}</div>
              <div className="stat-card-label">{st.label}</div>
            </div>
          ))}
        </div>

        <div className="today-section sc-anim-3">
          <div className="today-label">
            <span className="today-label-icon">💬</span> {t('s10.todayLabel')}
          </div>
          <button className="session-btn sc-glow" onClick={() => nav(ROUTES.emergency)}>
            <div className="session-btn-icon">🌈</div>
            <div>
              <div className="session-btn-title">{t('s10.startSession')}</div>
              <div className="session-btn-sub">{t('s10.startSessionSub')}</div>
            </div>
            <div className="session-btn-arrow">→</div>
          </button>
          <div className="quick-grid-3">
            {quickActions.map((qa, i) => (
              <div className={`quick-card${i === quickActions.length - 1 ? ' quick-card-wide' : ''}`} key={qa.title}>
                <div className={`quick-card-icon ${qa.iconCls}`}>{qa.icon}</div>
                <div>
                  <div className="quick-card-title">{qa.title}</div>
                  <div className="quick-card-sub">{qa.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="journey-urgent-row">
          <div className="journey-card sc-anim-4">
            <div className="journey-title">🚀 {t('s10.journeyTitle')}</div>
            <div className="journey-item">
              <div className="journey-dot green">✓</div>
              <div>
                <div className="journey-text-title">{t('s10.journey1Title')}</div>
                <div className="journey-text-sub">{t('s10.journey1Sub')}</div>
              </div>
            </div>
            <div className="journey-item">
              <div className="journey-dot orange">◔</div>
              <div>
                <div className="journey-text-title">{t('s10.journey2Title')}</div>
                <div className="journey-text-sub">{t('s10.journey2Sub')}</div>
              </div>
            </div>
          </div>

          <div className="urgent-card sc-anim-5">
            <div className="urgent-title">🆘 {t('s10.urgentTitle')}</div>
            <div className="urgent-sub">{t('s10.urgentSub')}</div>
            <button className="urgent-btn" onClick={() => nav(ROUTES.emergency)}>
              {t('s10.getHelpNow')}
            </button>
          </div>
        </div>

        <div className="progress-card sc-anim-6">
          <div className="progress-icon">🌈</div>
          <div>
            <div className="progress-title">{t('s10.progressTitle')} 🌱</div>
            <div className="progress-sub">{t('s10.progressSub')}</div>
          </div>
        </div>

        {!isBackendConfigured && (
          <div className="dev-test-card">
            <div className="dev-test-title">🧪 Test tools (mock backend only — hidden once Supabase is connected)</div>
            <div className="dev-test-sub">
              Nothing sets a real clinician alert yet — that comes from session content, which isn't built.
              Use this to test the S11 re-offer screen.
            </div>
            <button className="dev-test-btn" onClick={onSimulateAlert}>
              Simulate clinician alert → logout → log back in
            </button>
          </div>
        )}
        <div style={{ height: '0.8rem' }} />
        </div>
      </div>
    </Screen>
  )
}
