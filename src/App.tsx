import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ROUTES } from './flow'
import { useOnboarding } from './state/onboardingStore'

import S01Welcome from './screens/S01Welcome'
import S02Language from './screens/S02Language'
import S02bSchoolType from './screens/S02bSchoolType'
import S02cEmis from './screens/S02cEmis'
import S03Profile from './screens/S03Profile'
import S04ParentConsent from './screens/S04ParentConsent'
import S05Assent from './screens/S05Assent'
import S06Camera from './screens/S06Camera'
import S07Voice from './screens/S07Voice'
import S08Summary from './screens/S08Summary'
import S09Login from './screens/S09Login'
import S10Home from './screens/S10Home'
import S11Reoffer from './screens/S11Reoffer'
import Emergency from './screens/Emergency'

/** New/returning-user split: a device with a CHILD record starts at PIN login,
 * unless this session is already unlocked, in which case go straight home. */
function RootRedirect() {
  const childId = useOnboarding((s) => s.childId)
  const unlocked = useOnboarding((s) => s.unlocked)
  if (!childId) return <Navigate to={ROUTES.welcome} replace />
  return <Navigate to={unlocked ? ROUTES.home : ROUTES.login} replace />
}

/** Guards the consent summary so SESSION creation cannot be reached without both consents. */
function RequireConsent({ children }: { children: ReactNode }) {
  const parentConsent = useOnboarding((s) => s.parentConsent)
  const childAssent = useOnboarding((s) => s.childAssent)
  if (!parentConsent || !childAssent) return <Navigate to={ROUTES.welcome} replace />
  return <>{children}</>
}

/** Guards returning-user screens: needs an account on this device AND the PIN
 * unlocked this session — prevents opening /home directly without the PIN, and is
 * what makes "Logout" (which clears `unlocked`) actually lock the app again. */
function RequireAccount({ children }: { children: ReactNode }) {
  const childId = useOnboarding((s) => s.childId)
  const unlocked = useOnboarding((s) => s.unlocked)
  if (!childId) return <Navigate to={ROUTES.welcome} replace />
  if (!unlocked) return <Navigate to={ROUTES.login} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path={ROUTES.welcome} element={<S01Welcome />} />
        <Route path={ROUTES.language} element={<S02Language />} />
        <Route path={ROUTES.schoolType} element={<S02bSchoolType />} />
        <Route path={ROUTES.emis} element={<S02cEmis />} />
        <Route path={ROUTES.profile} element={<S03Profile />} />
        <Route path={ROUTES.parentConsent} element={<S04ParentConsent />} />
        <Route path={ROUTES.assent} element={<S05Assent />} />
        <Route path={ROUTES.camera} element={<S06Camera />} />
        <Route path={ROUTES.voice} element={<S07Voice />} />
        <Route
          path={ROUTES.summary}
          element={
            <RequireConsent>
              <S08Summary />
            </RequireConsent>
          }
        />
        <Route path={ROUTES.login} element={<S09Login />} />
        <Route
          path={ROUTES.home}
          element={
            <RequireAccount>
              <S10Home />
            </RequireAccount>
          }
        />
        <Route
          path={ROUTES.reoffer}
          element={
            <RequireAccount>
              <S11Reoffer />
            </RequireAccount>
          }
        />
        <Route path={ROUTES.emergency} element={<Emergency />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
