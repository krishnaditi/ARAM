import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { useCamera } from '../lib/useCamera'
import { getFaceDescriptor, loadFaceModels } from '../lib/faceApi'
import { api } from '../lib/api'

type ResultStage = 'none' | 'detecting' | 'captured' | 'noFace' | 'duplicate' | 'review'

/** The staff-authorisation side-flow, which borrows the same camera. */
type OverrideStage = 'off' | 'camera' | 'verifying' | 'granted' | 'failed'

/**
 * Registers a face using the device's real camera. Face detection and the 128-d descriptor
 * are computed on-device (see lib/faceApi.ts); only the descriptor is handed to
 * api.registerFace, never the photo. The photo is kept in memory for the on-screen preview
 * and is never persisted or uploaded, same spirit as DOB/PIN in the onboarding store.
 *
 * One face, one account. This step is REQUIRED — an optional check closes nothing — and
 * the server answers in three bands, because face matching is a statistical guess and
 * treating every guess as certain would refuse real children an account:
 *
 *   ok: false           near-certain match. Stop. Either they already have a space and
 *                       should sign in, or a staff member has to let them through.
 *   ok, review: true    borderline. Nothing is stored, the child carries on with their
 *                       PIN, and staff get an audit row to resolve later. Storing a
 *                       borderline face would make face LOGIN ambiguous, and signing the
 *                       wrong child into someone else's history is the worse failure.
 *   ok, stored: true    no match. Registered normally.
 *
 * Because the step is required, it will sometimes stand between a real child and an
 * account — a camera that will not start, a face the matcher refuses. The staff override
 * is the way past, and it costs a staff face to open, so it cannot be self-declared.
 */
export default function S05bFaceRegister() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const childId = useOnboarding((s) => s.childId)
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const setFaceRegistered = useOnboarding((s) => s.setFaceRegistered)
  const reset = useOnboarding((s) => s.reset)
  const cam = useCamera()
  const [result, setResult] = useState<ResultStage>(faceRegistered ? 'captured' : 'none')
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [override, setOverride] = useState<OverrideStage>('off')
  const [overrideStaff, setOverrideStaff] = useState<string>('')

  // Warms up the (~7MB) recognition model in the background as soon as this screen opens,
  // so the wait lands during camera setup instead of after the child taps Capture.
  useEffect(() => {
    void loadFaceModels()
  }, [])

  const handleCapture = async () => {
    const canvas = cam.captureCanvas()
    if (!canvas || !childId) return
    setResult('detecting')
    try {
      const descriptor = await getFaceDescriptor(canvas, cam.captureCanvas)
      cam.stop()
      if (!descriptor) {
        // Showing the frame that failed tells the child what to fix: dark, blurry, off-frame.
        setPhoto(canvas.toDataURL('image/jpeg', 0.85))
        setResult('noFace')
        return
      }
      const stored = await api.registerFace(childId, Array.from(descriptor))
      setPhoto(canvas.toDataURL('image/jpeg', 0.85))
      if (!stored.ok) {
        setFaceRegistered(false)
        setResult('duplicate')
        return
      }
      if (stored.review) {
        // Borderline: deliberately not stored, but onboarding is not stopped.
        setFaceRegistered(false)
        setResult('review')
        return
      }
      setFaceRegistered(true)
      setResult('captured')
    } catch {
      cam.stop()
      setResult('none')
      cam.setStage('error')
    }
  }

  const retry = () => {
    setPhoto(null)
    setResult('none')
    setFaceRegistered(false)
    void cam.start()
  }

  const goNext = () => {
    cam.stop()
    nav(ROUTES.camera)
  }

  // "That's me." The account created back on S03 is the duplicate, so it goes, and the
  // device is wiped back to a clean slate before being handed to the login screen —
  // otherwise it would still hold a childId pointing at a row that no longer exists.
  const goSignIn = async () => {
    cam.stop()
    setBusy(true)
    try {
      if (childId) await api.discardAccount(childId)
    } finally {
      reset()
      nav(ROUTES.login)
    }
  }

  // The staff override. Deliberately NOT something the child can assert on their own:
  // it takes a headmaster, counsellor or admin face, matched at the strict threshold,
  // and it records who authorised it.
  const startOverride = () => {
    setPhoto(null)
    setResult('none')
    setOverride('camera')
    void cam.start()
  }

  const captureOverride = async () => {
    const canvas = cam.captureCanvas()
    if (!canvas || !childId) return
    setOverride('verifying')
    try {
      const descriptor = await getFaceDescriptor(canvas, cam.captureCanvas)
      if (!descriptor) {
        setOverride('failed')
        return
      }
      const granted = await api.overrideFaceStep(childId, Array.from(descriptor))
      if (!granted.ok) {
        setOverride('failed')
        return
      }
      cam.stop()
      setOverrideStaff(granted.staffName ?? '')
      setOverride('granted')
    } catch {
      setOverride('failed')
    }
  }
  const goBack = () => {
    cam.stop()
    nav(ROUTES.assent)
  }

  // A face can only be stored against a student record; without one this screen was reached
  // out of order (opened directly, or after Logout cleared the device), so say that plainly
  // rather than letting a capture fail and blaming the camera.
  if (!childId) {
    return (
      <Screen
        progress={progressFor(ROUTES.faceRegister)}
        footer={
          <div className="btn-row">
            <button className="btn btn-back" onClick={() => nav(ROUTES.assent)}>
              ← {t('common.back')}
            </button>
          </div>
        }
      >
        <div className="bg-white">
          <div className="sc" style={{ justifyContent: 'center', gap: '1.2rem' }}>
            <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
              <div className="aram-logo-circle sc-float" style={{ fontSize: '2.8rem' }}>🤳</div>
            </div>
            <div className="note-card teal">
              <span className="note-card-icon">ℹ️</span>
              <span>No student profile on this device yet. Finish onboarding first, then you can add your face.</span>
            </div>
            <button className="btn btn-primary" onClick={() => nav(ROUTES.language)}>
              Start onboarding →
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  // A camera error is no longer a free pass — the step is required. The only ways past
  // are a stored face, a borderline result the server chose not to store, or staff.
  const canContinue = result === 'captured' || result === 'review' || override === 'granted'
  const overrideCamera = override === 'camera' || override === 'verifying'
  const showCamera =
    (cam.stage === 'connecting' || cam.stage === 'streaming') &&
    (overrideCamera || (override === 'off' && (result === 'none' || result === 'detecting')))
  /** Offered whenever the child is stuck. Safe to show freely: it needs a staff face. */
  const offerOverride =
    override === 'off' && !canContinue && !showCamera && result !== 'detecting'

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={goBack}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-next" disabled={!canContinue || busy} onClick={goNext}>
        {t('common.continue')} →
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.faceRegister)} footer={footer}>
      <div className="bg-white">
        <div className="sc">
          {!showCamera && result !== 'detecting' && (
            <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
              {photo ? (
                <img src={photo} alt="" className="face-capture-thumb" />
              ) : (
                <div className="aram-logo-circle sc-float" style={{ fontSize: '2.8rem' }}>
                  {result === 'captured' ? '✅' : result === 'noFace' || cam.stage === 'error' ? '⚠️' : '🤳'}
                </div>
              )}
            </div>
          )}

          <div className="sc-anim-2" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a18' }}>{t('s05b.title')}</div>
            <div style={{ fontSize: '1.1rem', color: '#aaa', marginTop: '0.4rem' }}>{t('s05b.subtitle')}</div>
          </div>

          <div className="cap-card green sc-anim-3">
            <div className="cap-card-header green" style={{ fontSize: '1.1rem' }}>
              {t('s05b.whyTitle')}
            </div>
            <div className="cap-bullet">{t('s05b.why1')}</div>
            <div className="cap-bullet">{t('s05b.why2')}</div>
            <div className="cap-bullet">{t('s05b.why3')}</div>
          </div>

          {result === 'none' && cam.stage === 'idle' && (
            <button className="main-cta sc-anim-4" onClick={() => void cam.start()}>
              <div className="main-cta-icon">🤳</div>
              <div className="main-cta-text">
                <div className="main-cta-title">{t('s05b.captureCta')}</div>
                <div className="main-cta-sub">{t('s05b.captureCtaSub')}</div>
              </div>
            </button>
          )}

          {showCamera && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div className="face-camera-frame">
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
              ) : overrideCamera ? (
                <>
                  <div className="note-card gray">
                    <span className="note-card-icon">🧑‍🏫</span>
                    <span>{t('s05b.overridePrompt')}</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 'none', width: '100%' }}
                    disabled={override === 'verifying'}
                    onClick={() => void captureOverride()}
                  >
                    📸 {t('s05b.overrideCapture')}
                  </button>
                </>
              ) : result === 'none' && (
                <button className="btn btn-primary" style={{ flex: 'none', width: '100%' }} onClick={() => void handleCapture()}>
                  📸 {t('s05b.captureNow')}
                </button>
              )}
            </div>
          )}

          {result === 'detecting' && (
            <div className="note-card gray sc-anim-4">
              <span className="note-card-icon">⏳</span>
              <span>{t('s05b.detecting')}</span>
            </div>
          )}

          {result === 'captured' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card green">
                <span className="note-card-icon">✅</span>
                <span>{t('s05b.registered')}</span>
              </div>
              <button className="btn btn-outline" onClick={retry}>
                🔄 {t('s05b.retake')}
              </button>
            </div>
          )}

          {result === 'duplicate' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card pink">
                <span className="note-card-icon">🙂</span>
                <span>{t('s05b.duplicateFound')}</span>
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={() => void goSignIn()}>
                {t('s05b.duplicateSignIn')} →
              </button>
            </div>
          )}

          {result === 'review' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card teal">
                <span className="note-card-icon">ℹ️</span>
                <span>{t('s05b.reviewFlagged')}</span>
              </div>
              <button className="btn btn-outline" onClick={retry}>
                🔄 {t('s05b.retake')}
              </button>
            </div>
          )}

          {override === 'granted' && (
            <div className="note-card green sc-anim-4">
              <span className="note-card-icon">✅</span>
              <span>{t('s05b.overrideGranted', { name: overrideStaff })}</span>
            </div>
          )}

          {override === 'failed' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card pink">
                <span className="note-card-icon">⚠️</span>
                <span>{t('s05b.overrideFailed')}</span>
              </div>
              <button className="btn btn-outline" onClick={startOverride}>
                {t('s05b.tryAgain')}
              </button>
            </div>
          )}

          {result === 'noFace' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card pink">
                <span className="note-card-icon">⚠️</span>
                <span>{t('s05b.noFaceDetected')}</span>
              </div>
              <button className="btn btn-outline" onClick={retry}>
                {t('s05b.tryAgain')}
              </button>
            </div>
          )}

          {override === 'off' && cam.stage === 'error' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card pink">
                <span className="note-card-icon">⚠️</span>
                <span>{t('s05b.cameraError')}</span>
              </div>
              <button className="btn btn-outline" onClick={() => void cam.start()}>
                {t('s05b.tryAgain')}
              </button>
            </div>
          )}

          {offerOverride && (
            <button className="btn btn-outline sc-anim-5" onClick={startOverride}>
              🧑‍🏫 {t('s05b.overrideCta')}
            </button>
          )}

          <div className="note-card gray sc-anim-5">
            <span className="note-card-icon">ℹ️</span>
            <span>{t('s05b.note')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
