import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { staffLabel } from '../lib/staffAuth'

export default function StaffDashboard() {
  const nav = useNavigate()
  const role = useOnboarding((s) => s.staffRole)
  const name = useOnboarding((s) => s.staffName)
  const label = role ? staffLabel(role) : 'Staff'

  const cards = role === 'parent'
    ? [
        ['👤', 'Child profile', 'View basic profile information'],
        ['📊', 'Wellbeing overview', 'Review recent check-in status'],
        ['🆘', 'Support', 'Find emergency support contacts'],
      ]
    : [
        ['👥', 'Students', 'View students connected to your school'],
        ['📊', 'Reports', 'Review wellbeing activity and alerts'],
        ['⚙️', 'Settings', 'Manage your dashboard preferences'],
      ]

  return (
    <Screen>
      <div className="bg-home">
        <div className="content-col">
          <div className="ret-header sc-anim-1">
            <div className="ret-avatar">{name.charAt(0).toUpperCase()}</div>
            <div className="ret-greeting-block">
              <div className="ret-greeting">Welcome, {name}</div>
              <div className="ret-sub">{label} dashboard</div>
            </div>
            <div className="ret-logo-block">
              <div className="ret-logo-circle sc-bounce">🤲</div>
              <div className="ret-logo-title">ARAM</div>
            </div>
          </div>

          <div className="progress-card sc-anim-2">
            <div className="progress-icon">📋</div>
            <div>
              <div className="progress-title">{label} workspace</div>
              <div className="progress-sub">Your dashboard is ready for the next phase of ARAM.</div>
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

          <div className="note-card teal sc-anim-4">
            <span className="note-card-icon">ℹ️</span>
            <span>Detailed data, reports, and permissions will appear here as those modules are connected.</span>
          </div>

          <button className="urgent-btn sc-anim-5" onClick={() => nav(ROUTES.emergency)}>
            🆘 Emergency support
          </button>
        </div>
      </div>
    </Screen>
  )
}
