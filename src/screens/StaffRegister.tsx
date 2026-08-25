import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { getFaceDescriptor, FACE_MATCH_THRESHOLD, descriptorDistance } from '../lib/faceApi'
import { getStaffAccount, registerStaff, staffLabel, verifyStaffFace } from '../lib/staffAuth'
import { useCamera } from '../lib/useCamera'

type StaffRegistrationRole = 'parent' | 'headmaster' | 'counsellor'

export default function StaffRegister() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const roleParam = params.get('role')
  const role: StaffRegistrationRole = roleParam === 'headmaster' || roleParam === 'counsellor' ? roleParam : 'parent'
  const existing = getStaffAccount(role)
  const [name, setName] = useState(existing?.name ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cam = useCamera()
  const setStaffSession = useOnboarding((s) => s.setStaffSession)

  const capture = async () => {
    const canvas = cam.captureCanvas()
    if (!canvas) return
    setBusy(true)
    setMessage(null)
    try {
      const descriptor = await getFaceDescriptor(canvas)
      cam.stop()
      if (!descriptor) {
        setMessage('No face detected. Please face the camera in good light and try again.')
        return
      }
      if (!existing) {
        if (!name.trim()) {
          setMessage('Please enter your name before registering your face.')
          return
        }
        registerStaff(role, name, Array.from(descriptor))
        setStaffSession(role, name.trim())
      } else if (!verifyStaffFace(role, Array.from(descriptor), descriptorDistance, FACE_MATCH_THRESHOLD)) {
        setMessage('We could not match that face. Please try again.')
        return
      } else {
        setStaffSession(role, existing.name)
      }
      nav(ROUTES.staffDashboard)
    } catch {
      cam.stop()
      setMessage('We could not use the camera right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const start = () => {
    setMessage(null)
    void cam.start()
  }

  const showCamera = cam.stage === 'connecting' || cam.stage === 'streaming'

  return (
    <Screen footer={
      <div className="btn-row">
        <button className="btn btn-back" onClick={() => nav(ROUTES.login)}>← {t('common.back')}</button>
        {showCamera && cam.stage === 'streaming' && (
          <button className="btn btn-primary" onClick={() => void capture()} disabled={busy}>
            {busy ? 'Checking…' : 'Capture face →'}
          </button>
        )}
      </div>
    }>
      <div className="bg-gradient">
        <div className="sc" style={{ justifyContent: 'center', gap: '1.4rem' }}>
          <div className="aram-logo-wrap sc-anim-1">
            <div className="aram-logo-circle sc-float">🤳</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a18' }}>
              {existing ? `Welcome back, ${existing.name}` : `${staffLabel(role)} registration`}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#888', marginTop: '0.4rem' }}>
              {existing ? 'Look at the camera to sign in.' : 'Register your name and face to access your dashboard.'}
            </div>
          </div>

          {!existing && (
            <div className="sc-anim-2">
              <div className="field-label">Your name</div>
              <input className="sc-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" />
            </div>
          )}

          {showCamera ? (
            <div className="sc-anim-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div className="face-camera-frame">
                <video ref={cam.videoRef} className="face-camera-video" playsInline muted onLoadedMetadata={() => cam.setStage('streaming')} />
              </div>
              {cam.stage === 'connecting' && <div className="note-card gray">Turning on your camera…</div>}
            </div>
          ) : (
            <button className="main-cta sc-anim-3" onClick={start} disabled={!existing && !name.trim()}>
              <div className="main-cta-icon">📷</div>
              <div className="main-cta-text">
                <div className="main-cta-title">{existing ? 'Sign in with face' : 'Register my face'} →</div>
                <div className="main-cta-sub">Your face data stays on this demo device</div>
              </div>
            </button>
          )}

          {message && <div className="note-card pink sc-anim-4">⚠️ {message}</div>}
        </div>
      </div>
    </Screen>
  )
}
