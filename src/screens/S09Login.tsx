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
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const unlock = useOnboarding((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
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
    if (faceRegistered || !childId) void loadFaceModels()
  }, [faceRegistered, childId])

  // Signing in on a device that never saw this child: the server finds the account from
  // the nickname + PIN (or the face) and hands back the child_id this device then keeps.
  const adoptAndEnter = (account: NonNullable<Awaited<ReturnType<typeof api.loginWithPin>>>) => {
    adoptChild({
      childId: account.childId!,
      nickname: account.nickname ?? '',
      language: (account.language ?? 'en') as Parameters<typeof setLanguage>[0],
      ageGroup: account.ageGroup ?? '',
      faceRegistered: Boolean(account.faceRegistered),
    })
    unlock()
    nav(ROUTES.home)
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

  // Shared by PIN success and face-match success: re-offer the helpline once if a
  // clinician alert is pending from last session, otherwise go straight home.
  const onUnlocked = async () => {
    unlock()
    if (!childId) return nav(ROUTES.home)
    const ctx = await api.getReturningContext(childId)
    nav(ctx.clinicianAlertPending ? ROUTES.reoffer : ROUTES.home)
  }

  const onUnlock = async () => {
    if (!childId || pin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.verifyPin(childId, pin)
      if (res.ok) {
        await onUnlocked()
        return
      }
      setPin('')
      if (res.locked) {
        setLocked(true)
      } else {
        setError(t('s09.errWrong', { remaining: res.remainingAttempts }))
      }
    } finally {
      setBusy(false)
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

  // Turns the captured frame into a descriptor and checks it against the one registered on
  // S05b (see lib/faceApi.ts) — the camera really opens, a real frame is really compared,
  // and only a match under FACE_MATCH_THRESHOLD unlocks the account.
  const captureAndVerifyFace = async () => {
    const canvas = cam.captureCanvas()
    if (!canvas || !childId) return
    setFaceResult('detecting')
    try {
      const descriptor = await getFaceDescriptor(canvas, cam.captureCanvas)
      cam.stop()
      if (!descriptor) {
        setFaceResult('noFace')
        return
      }
      const res = await api.verifyFace(childId, Array.from(descriptor))
      if (res.ok) {
        await onUnlocked()
        return
      }
      setFaceResult('mismatch')
    } catch {
      cam.stop()
      setFaceResult('none')
      cam.setStage('error')
    }
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

  // A device that has never seen this child still needs to reach an existing account, so
  // the same PIN and face the child already uses are checked against the server instead of
  // against the id in this browser's storage.
  if (selectedRole === 'student' && !childId) {
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

  const footer = locked ? (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
        ← {t('common.back')}
      </button>
    </div>
  ) : (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.welcome)}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-primary" onClick={onUnlock} disabled={pin.length !== 4 || busy}>
        {t('s09.unlock')} →
      </button>
    </div>
  )

  return (
    <Screen footer={footer}>
      <div className="bg-gradient">
        <div className="sc" style={{ justifyContent: 'center', gap: '2rem' }}>
          <BrandLogo animation="bounce" taglineKey="welcomeBack" />

          {locked ? (
            <>
              <div
                className="sc-anim-2"
                style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 800, color: '#8b2500' }}
              >
                🔒 {t('s09.lockedTitle')}
              </div>
              <div className="note-card pink sc-anim-3">
                <span className="note-card-icon">🔒</span>
                <span>{t('s09.lockedSub')}</span>
              </div>
            </>
          ) : (
            <>
              <div className="sc-anim-2" style={{ textAlign: 'center', fontSize: '1.3rem', color: '#888' }}>
                {t('s09.enterPin')}
              </div>
              <PinEntry value={pin} onChange={setPin} autoFocus ariaLabel={t('s09.enterPin')} />
              {error && (
                <div className="note-card pink sc-anim-3">
                  <span className="note-card-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {faceRegistered && !faceActive && (
                <button
                  type="button"
                  className="btn btn-outline sc-anim-4"
                  onClick={startFaceLogin}
                  disabled={busy}
                >
                  🤳 {t('s09.faceLogin')}
                </button>
              )}

              {faceActive && (
                <div
                  className="sc-anim-4"
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
                >
                  {(faceResult === 'none' || faceResult === 'detecting') && (cam.stage === 'connecting' || cam.stage === 'streaming') && (
                    <>
                      <div className="face-camera-frame" style={{ width: '10rem', height: '10rem' }}>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          ref={cam.videoRef}
                          className="face-camera-video"
                          playsInline
                          muted
                          onLoadedMetadata={cam.markStreaming}
                        />
                      </div>
                      {cam.stage === 'connecting' ? (
                        <div className="note-card gray">
                          <span className="note-card-icon">⏳</span>
                          <span>{t('s05b.startingCamera')}</span>
                        </div>
                      ) : faceResult === 'none' && (
                        <div className="btn-row" style={{ width: '100%' }}>
                          <button type="button" className="btn btn-back" onClick={cancelFaceLogin}>
                            {t('s09.cancelFace')}
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => void captureAndVerifyFace()}>
                            📸 {t('s05b.captureNow')}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {faceResult === 'detecting' && (
                    <div className="note-card gray">
                      <span className="note-card-icon">⏳</span>
                      <span>{t('s09.detecting')}</span>
                    </div>
                  )}

                  {faceResult === 'mismatch' && (
                    <>
                      <div className="note-card pink">
                        <span className="note-card-icon">⚠️</span>
                        <span>{t('s09.faceMismatch')}</span>
                      </div>
                      <div className="btn-row" style={{ width: '100%' }}>
                        <button type="button" className="btn btn-back" onClick={cancelFaceLogin}>
                          {t('common.back')}
                        </button>
                        <button type="button" className="btn btn-primary" onClick={retryFaceLogin}>
                          {t('s05b.tryAgain')}
                        </button>
                      </div>
                    </>
                  )}

                  {faceResult === 'noFace' && (
                    <>
                      <div className="note-card pink">
                        <span className="note-card-icon">⚠️</span>
                        <span>{t('s05b.noFaceDetected')}</span>
                      </div>
                      <button type="button" className="btn btn-outline" onClick={retryFaceLogin}>
                        {t('s05b.tryAgain')}
                      </button>
                    </>
                  )}

                  {faceResult === 'none' && cam.stage === 'error' && (
                    <>
                      <div className="note-card pink">
                        <span className="note-card-icon">⚠️</span>
                        <span>{t('s09.cameraError')}</span>
                      </div>
                      <button type="button" className="btn btn-outline" onClick={cancelFaceLogin}>
                        {t('common.back')}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="note-card gray sc-anim-4">
                <span className="note-card-icon">🔒</span>
                <span>{t('s09.note')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Screen>
  )
}
