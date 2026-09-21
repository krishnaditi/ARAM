import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { useSession } from '../state/sessionStore'

/**
 * Shared "Logout" behavior, rendered once from <Screen>. <Screen> only shows the
 * control for a signed-in session (child PIN unlock, or a staff session), so this is
 * only ever reached with something real to lock: onboarding and the login screens
 * have no logout at all.
 */
export function useLogout(): () => void {
  const nav = useNavigate()
  const { t } = useTranslation()
  const unlocked = useOnboarding((s) => s.unlocked)
  const logout = useOnboarding((s) => s.logout)
  const staffUnlocked = useOnboarding((s) => s.staffUnlocked)
  const clearStaffSession = useOnboarding((s) => s.clearStaffSession)
  // Anything left in the cluster basket belongs to the child who is leaving, so it
  // goes with them — but only once they have actually confirmed the logout.
  const resetSession = useSession((s) => s.resetSession)

  return () => {
    if (staffUnlocked) {
      clearStaffSession()
      nav(ROUTES.login)
      return
    }
    if (!unlocked) return
    if (!window.confirm(t('common.logoutConfirm'))) return
    resetSession()
    logout()
    nav(ROUTES.login)
  }
}
