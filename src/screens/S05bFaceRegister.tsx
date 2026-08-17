import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

/**
 * Mock face registration — no real camera/face-match backend yet (same "hardcode for now"
 * approach as the EMIS lookup on S02c). Sets `faceRegistered` so S09 can offer face login
 * alongside the PIN, the way a real capture + template store would.
 */
export default function S05bFaceRegister() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const faceRegistered = useOnboarding((s) => s.faceRegistered)
  const setFaceRegistered = useOnboarding((s) => s.setFaceRegistered)
  const [scanning, setScanning] = useState(false)

  const onCapture = () => {
    setScanning(true)
    window.setTimeout(() => {
      setScanning(false)
      setFaceRegistered(true)
    }, 1200)
  }

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.assent)}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-next" disabled={!faceRegistered} onClick={() => nav(ROUTES.camera)}>
        {t('common.continue')} →
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.faceRegister)} footer={footer}>
      <div className="bg-white">
        <div className="sc">
          <div className="aram-logo-wrap sc-anim-1" style={{ marginBottom: 0 }}>
            <div className={`aram-logo-circle${scanning ? ' sc-bounce' : ' sc-float'}`} style={{ fontSize: '2.8rem' }}>
              {faceRegistered ? '✅' : '🤳'}
            </div>
          </div>
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

          {faceRegistered ? (
            <div className="note-card green sc-anim-4">
              <span className="note-card-icon">✅</span>
              <span>{t('s05b.registered')}</span>
            </div>
          ) : (
            <button className="main-cta sc-anim-4" onClick={onCapture} disabled={scanning}>
              <div className="main-cta-icon">{scanning ? '⏳' : '🤳'}</div>
              <div className="main-cta-text">
                <div className="main-cta-title">
                  {scanning ? t('s05b.scanning') : t('s05b.captureCta')}
                </div>
                <div className="main-cta-sub">{t('s05b.captureCtaSub')}</div>
              </div>
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
