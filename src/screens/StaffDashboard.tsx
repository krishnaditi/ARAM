import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { api, type DashboardSummary } from '../lib/api'

export default function StaffDashboard() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const role = useOnboarding((s) => s.staffRole)
  const name = useOnboarding((s) => s.staffName)
  const userId = useOnboarding((s) => s.staffUserId)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const roleKey = role === 'parent' || role === 'headmaster' || role === 'counsellor' || role === 'admin' ? role : 'admin'
  const label = t(`staff.roles.${roleKey}`)

  useEffect(() => {
    if (userId) void api.dashboard(userId).then(setSummary)
  }, [userId])

  const cards = role === 'parent'
    ? [
        ['👤', t('staff.childProfile'), t('staff.childProfileSub')],
        ['📊', t('staff.wellbeing'), t('staff.wellbeingSub')],
        ['🆘', t('staff.support'), t('staff.supportSub')],
      ]
    : [
        ['👥', t('staff.students'), t('staff.studentsSub')],
        ['📊', t('staff.reports'), t('staff.reportsSub')],
        ['⚙️', t('staff.settings'), t('staff.settingsSub')],
      ]

  return (
    <Screen>
      <div className="bg-home">
        <div className="content-col">
          <div className="ret-header sc-anim-1">
            <div className="ret-avatar">{name.charAt(0).toUpperCase()}</div>
            <div className="ret-greeting-block">
              <div className="ret-greeting">{t('staff.welcome', { name })}</div>
              <div className="ret-sub">{t('staff.dashboard', { role: label })}</div>
            </div>
            <div className="ret-logo-block">
              <div className="ret-logo-circle sc-bounce">🤲</div>
              <div className="ret-logo-title">ARAM</div>
            </div>
          </div>

          <div className="progress-card sc-anim-2">
            <div className="progress-icon">📋</div>
            <div>
              <div className="progress-title">{t('staff.workspace', { role: label })}</div>
              <div className="progress-sub">{t('staff.ready')}</div>
            </div>
          </div>

          <div className="stats-grid sc-anim-3">
            {cards.map(([icon, title, subtitle]) => (
              <div className="quick-card" key={title} style={{ minHeight: '9rem' }}>
                <div className="quick-card-icon blue">{icon}</div>
                <div>
                  <div className="quick-card-title">{title}</div>
                  <div className="quick-card-sub">{subtitle}</div>
                </div>
              </div>
            ))}
          </div>

          {summary && (
            <div className="note-card green sc-anim-4">
              {summary.students} students · {summary.sessions} sessions · {summary.alerts} alerts
            </div>
          )}

          <div className="note-card teal sc-anim-4">
            <span className="note-card-icon">ℹ️</span>
            <span>{t('staff.details')}</span>
          </div>

          <button className="urgent-btn sc-anim-5" onClick={() => nav(ROUTES.emergency)}>
            🆘 {t('staff.emergency')}
          </button>
        </div>
      </div>
    </Screen>
  )
}
