import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { useCamera } from '../lib/useCamera'
import { getFaceDescriptor, loadFaceModels } from '../lib/faceApi'
import { api } from '../lib/api'

type ResultStage = 'none' | 'detecting' | 'captured' | 'noFace'

/**
 * Registers a face using the device's real camera. There is still no face-match backend
 * (same "hardcode for now" approach as the EMIS lookup on S02c) — face detection and the
 * 128-d descriptor comparison both run on-device (see lib/faceApi.ts); only the descriptor
 * is handed to api.registerFace, never the photo, the way a real capture + template store
 * would after matching. The photo itself is kept in memory only for the on-screen preview
 * and is never persisted or uploaded, same spirit as DOB/PIN in the onboarding store.
 */
export default function S05bFaceRegister() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const childId = useOnboarding((s) => s.childId)
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const setFaceRegistered = useOnboarding((s) => s.setFaceRegistered)
  const cam = useCamera()
  const [result, setResult] = useState<ResultStage>(faceRegistered ? 'captured' : 'none')
  const [photo, setPhoto] = useState<string | null>(null)

  // Warms up the (~7MB) recognition model in the background as soon as this screen opens,
  // so the wait lands during camera setup instead of after the child taps Capture.
  useEffect(() => {
    void loadFaceModels()
  }, [])

  const handleCapture = async () => {
    const canvas = cam.captureCanvas()
    if (!canvas) return
    setResult('detecting')
    const descriptor = await getFaceDescriptor(canvas)
    cam.stop()
    if (!descriptor || !childId) {
      setResult('noFace')
      return
    }
    await api.registerFace(childId, Array.from(descriptor))
    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    setFaceRegistered(true)
    setResult('captured')
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
  const goBack = () => {
    cam.stop()
    nav(ROUTES.assent)
  }

  const canContinue = result === 'captured' || cam.stage === 'error'
  const showCamera = result === 'none' && (cam.stage === 'connecting' || cam.stage === 'streaming')

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={goBack}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-next" disabled={!canContinue} onClick={goNext}>
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
              {result === 'captured' && photo ? (
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
                  onLoadedMetadata={() => cam.setStage('streaming')}
                />
              </div>
              {cam.stage === 'connecting' ? (
                <div className="note-card gray">
                  <span className="note-card-icon">⏳</span>
                  <span>{t('s05b.startingCamera')}</span>
                </div>
              ) : (
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

          {result === 'none' && cam.stage === 'error' && (
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

          <div className="note-card gray sc-anim-5">
            <span className="note-card-icon">ℹ️</span>
            <span>{t('s05b.note')}</span>
          </div>
        </div>
      </div>
    </Screen>
  )
}
