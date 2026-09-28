import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import PinEntry from '../components/PinEntry'
import BrandLogo from '../components/BrandLogo'
import { ROUTES } from '../flow'
import { useOnboarding, type StaffRole } from '../state/onboardingStore'
import { api } from '../lib/api'
import { useCamera } from '../lib/useCamera'
import { getFaceDescriptor, loadFaceModels } from '../lib/faceApi'
import { adminDemoCredentials, loginAdmin, staffLabel } from '../lib/staffAuth'

type FaceResult = 'none' | 'detecting' | 'mismatch' | 'noFace'

export default function S09Login() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const childId = useOnboarding((s) => s.childId)
  const unlock = useOnboarding((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const setStaffSession = useOnboarding((s) => s.setStaffSession)
  const setLanguage = useOnboarding((s) => s.setLanguage)

  const cam = useCamera()
  const [faceActive, setFaceActive] = useState(false)
  const [faceResult, setFaceResult] = useState<FaceResult>('none')
  const adoptChild = useOnboarding((s) => s.adoptChild)
  const emis = useOnboarding((s) => s.emis)
  const [signInName, setSignInName] = useState('')

  // Warms up the recognition model as soon as face login is an option on this screen, so
  // the wait lands during camera setup instead of after the child taps Capture.
  useEffect(() => {
    if (selectedRole === 'student') void loadFaceModels()
  }, [selectedRole])

  // The server finds the account from the nickname + PIN (or the face) and hands back the
  // child_id this device then keeps. Re-offers the helpline once if a clinician alert is
  // pending from last session, otherwise goes straight home.
  const adoptAndEnter = async (account: NonNullable<Awaited<ReturnType<typeof api.loginWithPin>>>) => {
    adoptChild({
      childId: account.childId!,
      nickname: account.nickname ?? '',
      language: (account.language ?? 'en') as Parameters<typeof setLanguage>[0],
      ageGroup: account.ageGroup ?? '',
      faceRegistered: Boolean(account.faceRegistered),
    })
    unlock()
    const ctx = await api.getReturningContext(account.childId!).catch(() => null)
    nav(ctx?.clinicianAlertPending ? ROUTES.reoffer : ROUTES.home)
  }

  const signInWithPin = async () => {
    if (signInName.trim().length === 0 || pin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.loginWithPin(signInName.trim(), pin, emis)
      if (result.ok) return adoptAndEnter(result)
      setPin('')
      setError(
        result.reason === 'locked'
          ? t('s09.lockedSub')
          : result.reason === 'ambiguous'
            ? 'More than one account matches. Ask a teacher to help you sign in.'
            : 'That name and PIN did not match an account.',
      )
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const signInWithFace = async () => {
    const canvas = cam.captureCanvas()
    if (!canvas) return
    setFaceResult('detecting')
    setError(null)
    try {
      const descriptor = await getFaceDescriptor(canvas, cam.captureCanvas)
      cam.stop()
      if (!descriptor) {
        setFaceResult('noFace')
        return
      }
      const result = await api.loginWithFace(Array.from(descriptor), emis)
      if (result.ok) return adoptAndEnter(result)
      setFaceResult('mismatch')
    } catch {
      cam.stop()
      setFaceResult('none')
      cam.setStage('error')
    }
  }

  const startFaceLogin = () => {
    setFaceActive(true)
    setFaceResult('none')
    void cam.start()
  }

  const cancelFaceLogin = () => {
    cam.stop()
    setFaceActive(false)
    setFaceResult('none')
  }

  const retryFaceLogin = () => {
    setFaceResult('none')
    void cam.start()
  }

  const roleOptions: { role: StaffRole; icon: string }[] = [
    { role: 'student', icon: '🎓' },
    { role: 'parent', icon: '👨‍👩‍👧' },
    { role: 'headmaster', icon: '🏫' },
    { role: 'counsellor', icon: '🧠' },
    { role: 'admin', icon: '⚙️' },
  ]

  if (!selectedRole) {
    return (
      <Screen hideLogout>
        <div className="bg-gradient">
          <div className="sc" style={{ justifyContent: 'center', gap: '1.2rem' }}>
            <BrandLogo animation="bounce" taglineKey="welcomeBack" />
            <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 800 }}>Who is logging in?</div>
            <div className="sc-anim-2" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {roleOptions.map((option) => (
                <button key={option.role} className="sc-option" onClick={() => setSelectedRole(option.role)}>
                  <span className="sc-option-icon">{option.icon}</span>
                  <div className="sc-option-title">{staffLabel(option.role)}</div>
                  <span style={{ marginLeft: 'auto', fontSize: '1.4rem' }}>→</span>
                </button>
              ))}
            </div>
            {!childId && <div className="note-card gray">Choose Student to start the student onboarding journey.</div>}
          </div>
        </div>
      </Screen>
    )
  }

  if (selectedRole !== 'student' && selectedRole !== 'admin') {
    return (
      <Screen footer={<div className="btn-row"><button className="btn btn-back" onClick={() => setSelectedRole(null)}>← Back</button></div>}>
        <div className="bg-gradient">
          <div className="sc" style={{ justifyContent: 'center', gap: '1.5rem' }}>
            <BrandLogo animation="bounce" taglineKey="welcomeBack" />
            <div className="note-card teal">{staffLabel(selectedRole)} access uses name and face registration.</div>
            <button className="btn btn-primary" onClick={() => nav(`${ROUTES.staffRegister}?role=${selectedRole}`)}>
              Register or sign in with face →
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  if (selectedRole === 'admin') {
    const demo = adminDemoCredentials()
    const onAdminLogin = async () => {
      setBusy(true)
      setError(null)
      try {
        const result = await loginAdmin(adminUsername, adminPassword)
        if (!result.ok || !result.display_name) {
          setError('Incorrect admin credentials.')
          return
        }
        if (result.language) setLanguage(result.language as Parameters<typeof setLanguage>[0])
        setStaffSession('admin', result.display_name, result.user_id)
        nav(ROUTES.staffDashboard)
      } catch {
        setError('Admin login is unavailable. Check that the API is running.')
      } finally {
        setBusy(false)
      }
    }
    return (
      <Screen footer={<div className="btn-row"><button className="btn btn-back" onClick={() => setSelectedRole(null)}>← Back</button><button className="btn btn-primary" disabled={!adminUsername || !adminPassword || busy} onClick={() => void onAdminLogin()}>Login →</button></div>}>
        <div className="bg-gradient">
          <div className="sc" style={{ justifyContent: 'center', gap: '1.2rem' }}>
            <BrandLogo animation="bounce" taglineKey="welcomeBack" />
            <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 800 }}>Admin login</div>
            <input className="sc-input" value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} placeholder="Username" autoComplete="username" />
            <input className="sc-input" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Password" autoComplete="current-password" />
            {error && <div className="note-card pink">⚠️ {error}</div>}
            <div className="note-card gray">Demo login: {demo.username} / {demo.password}</div>
          </div>
        </div>
      </Screen>
    )
  }

  // Students always type nickname AND PIN, even on a device that already knows an
  // account: a shared school tablet may hold someone else's, and the PIN alone would
  // let anyone who knows it into whichever account the device happens to remember.
  return (
    <Screen
      footer={
        <div className="btn-row">
          <button className="btn btn-back" onClick={() => setSelectedRole(null)}>← {t('common.back')}</button>
          {!faceActive && (
            <button className="btn btn-primary" disabled={signInName.trim().length === 0 || pin.length !== 4 || busy} onClick={() => void signInWithPin()}>
              {t('s09.unlock')} →
            </button>
          )}
        </div>
      }
    >
      <div className="bg-gradient">
        <div className="sc" style={{ justifyContent: 'center', gap: '1.2rem' }}>
          <BrandLogo animation="bounce" taglineKey="welcomeBack" />

          {!faceActive && (
            <>
              <div className="sc-anim-2" style={{ width: '100%' }}>
                <div className="field-label">{t('s03.nickname')}</div>
                <input
                  className="sc-input"
                  value={signInName}
                  onChange={(event) => setSignInName(event.target.value)}
                  placeholder={t('s03.nicknamePlaceholder')}
                />
              </div>
              <div className="sc-anim-3" style={{ width: '100%' }}>
                <div className="field-label">{t('s09.enterPin')}</div>
                <PinEntry value={pin} onChange={setPin} ariaLabel={t('s09.enterPin')} />
              </div>
              <button type="button" className="btn btn-link" onClick={() => nav(ROUTES.forgotPin)}>
                {t('forgotPin.link')}
              </button>
              {error && (
                <div className="note-card pink">
                  <span className="note-card-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              <button type="button" className="btn btn-outline" disabled={busy} onClick={startFaceLogin}>
                🤳 {t('s09.faceLogin')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => nav(ROUTES.language)}>
                I'm new here — create an account
              </button>
            </>
          )}

          {faceActive && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {(faceResult === 'none' || faceResult === 'detecting') && (cam.stage === 'connecting' || cam.stage === 'streaming') && (
                <>
                  <div className="face-camera-frame" style={{ width: '12rem', height: '12rem' }}>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video ref={cam.videoRef} className="face-camera-video" playsInline muted onLoadedMetadata={cam.markStreaming} />
                  </div>
                  {cam.stage === 'connecting' || faceResult === 'detecting' ? (
                    <div className="note-card gray">
                      <span className="note-card-icon">⏳</span>
                      <span>{faceResult === 'detecting' ? t('s09.detecting') : t('s05b.startingCamera')}</span>
                    </div>
                  ) : (
                    <div className="btn-row" style={{ width: '100%' }}>
                      <button type="button" className="btn btn-back" onClick={cancelFaceLogin}>{t('s09.cancelFace')}</button>
                      <button type="button" className="btn btn-primary" onClick={() => void signInWithFace()}>
                        📸 {t('s05b.captureNow')}
                      </button>
                    </div>
                  )}
                </>
              )}

              {(faceResult === 'mismatch' || faceResult === 'noFace' || cam.stage === 'error') && (
                <>
                  <div className="note-card pink">
                    <span className="note-card-icon">⚠️</span>
                    <span>
                      {faceResult === 'noFace'
                        ? t('s05b.noFaceDetected')
                        : cam.stage === 'error'
                          ? t('s09.cameraError')
                          : 'We could not find an account for that face. Try your name and PIN instead.'}
                    </span>
                  </div>
                  <div className="btn-row" style={{ width: '100%' }}>
                    <button type="button" className="btn btn-back" onClick={cancelFaceLogin}>{t('common.back')}</button>
                    <button type="button" className="btn btn-primary" onClick={retryFaceLogin}>{t('s05b.tryAgain')}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
