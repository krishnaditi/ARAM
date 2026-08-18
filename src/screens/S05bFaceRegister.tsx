import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

type Stage = 'idle' | 'connecting' | 'streaming' | 'captured' | 'error'

/**
 * Registers a face using the device's real camera. There is still no face-match backend
 * (same "hardcode for now" approach as the EMIS lookup on S02c) — a captured frame just
 * flips `faceRegistered` on, the way a real capture + template store would after matching.
 * The photo itself is kept in memory only for the on-screen preview and is never persisted
 * or uploaded, same spirit as DOB/PIN in the onboarding store.
 */
export default function S05bFaceRegister() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const setFaceRegistered = useOnboarding((s) => s.setFaceRegistered)
  const [stage, setStage] = useState<Stage>(faceRegistered ? 'captured' : 'idle')
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Attaching the stream to the <video> lives in its own effect, decoupled from the state
  // update that requests it — the element only mounts once render picks up 'connecting'/
  // 'streaming', so assigning srcObject inline right after getUserMedia() resolves would
  // race against that mount and silently attach to a still-null ref.
  useEffect(() => {
    const video = videoRef.current
    if (video && mediaStream) {
      video.srcObject = mediaStream
      void video.play()
    }
  }, [mediaStream])

  // Stops the camera whenever the stream changes away (capture, retake) or this screen
  // unmounts (back, continue, or navigating off entirely) — the light must never stay on.
  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop())
    }
  }, [mediaStream])

  const startCamera = async () => {
    setStage('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      setMediaStream(stream)
    } catch {
      setStage('error')
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Mirror the capture to match the mirrored live preview the child was looking at.
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    }
    setMediaStream(null)
    setStage('captured')
    setFaceRegistered(true)
  }

  const retake = () => {
    setPhoto(null)
    setFaceRegistered(false)
    void startCamera()
  }

  const goNext = () => {
    setMediaStream(null)
    nav(ROUTES.camera)
  }
  const goBack = () => {
    setMediaStream(null)
    nav(ROUTES.assent)
  }

  const canContinue = stage === 'captured' || stage === 'error'
  const showCamera = stage === 'connecting' || stage === 'streaming'

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
          {!showCamera && (
            <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
              {stage === 'captured' && photo ? (
                <img src={photo} alt="" className="face-capture-thumb" />
              ) : (
                <div className="aram-logo-circle sc-float" style={{ fontSize: '2.8rem' }}>
                  {stage === 'captured' ? '✅' : stage === 'error' ? '⚠️' : '🤳'}
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

          {stage === 'idle' && (
            <button className="main-cta sc-anim-4" onClick={() => void startCamera()}>
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
                  ref={videoRef}
                  className="face-camera-video"
                  playsInline
                  muted
                  onLoadedMetadata={() => setStage('streaming')}
                />
              </div>
              {stage === 'connecting' ? (
                <div className="note-card gray">
                  <span className="note-card-icon">⏳</span>
                  <span>{t('s05b.startingCamera')}</span>
                </div>
              ) : (
                <button className="btn btn-primary" style={{ flex: 'none', width: '100%' }} onClick={capture}>
                  📸 {t('s05b.captureNow')}
                </button>
              )}
            </div>
          )}

          {stage === 'captured' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card green">
                <span className="note-card-icon">✅</span>
                <span>{t('s05b.registered')}</span>
              </div>
              <button className="btn btn-outline" onClick={retake}>
                🔄 {t('s05b.retake')}
              </button>
            </div>
          )}

          {stage === 'error' && (
            <div className="sc-anim-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div className="note-card pink">
                <span className="note-card-icon">⚠️</span>
                <span>{t('s05b.cameraError')}</span>
              </div>
              <button className="btn btn-outline" onClick={() => void startCamera()}>
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
