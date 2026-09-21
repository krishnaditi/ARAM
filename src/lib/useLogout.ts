import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { useSession } from '../state/sessionStore'

/**
 * Shared "Logout" behavior, rendered once from <Screen> so every screen gets it for free.
 * A fully unlocked account locks and returns to PIN entry (matches the old S10-only
 * logout). An account still mid-onboarding (no PIN unlock yet) has nothing to lock, so
 * this abandons the in-progress draft and starts over from S01 instead.
 */
export function useLogout(): () => void {
  const nav = useNavigate()
  const { t } = useTranslation()
  const unlocked = useOnboarding((s) => s.unlocked)
  const logout = useOnboarding((s) => s.logout)
  const reset = useOnboarding((s) => s.reset)
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
    if (unlocked) {
      if (!window.confirm(t('common.logoutConfirm'))) return
      resetSession()
      logout()
      nav(ROUTES.login)
    } else {
      if (!window.confirm(t('common.startOverConfirm'))) return
      resetSession()
      reset()
      nav(ROUTES.welcome)
    }
  }
}
