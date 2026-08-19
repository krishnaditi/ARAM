import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useOnboarding } from '../state/onboardingStore'
import { audioTts } from '../speech/audioTts'
import { hasTapLines, linesFor } from '../speech/spokenKeys'

/**
 * The always-reachable mute control, plus a one-time headphones tip.
 *
 * ARAM is used in classrooms, so being able to silence it in one tap — without hunting
 * through a settings menu — is a privacy control, not a convenience. It renders on every
 * screen that has anything to say, including when muted, so there is always a way back.
 */
export default function VoiceControls() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const speechOn = useOnboarding((s) => s.speechOn)
  const setSpeechOn = useOnboarding((s) => s.setSpeechOn)
  const hintSeen = useOnboarding((s) => s.speechHintSeen)
  const markHintSeen = useOnboarding((s) => s.markSpeechHintSeen)

  const speaksHere = linesFor(pathname, 'auto').length > 0 || hasTapLines(pathname)
  const showHint = speaksHere && speechOn && !hintSeen

  useEffect(() => {
    if (!showHint) return
    const id = window.setTimeout(markHintSeen, 6000)
    return () => window.clearTimeout(id)
  }, [showHint, markHintSeen])

  if (!speaksHere) return null

  const toggle = () => {
    // Silence has to be immediate — waiting for the current sentence to finish defeats
    // the point of muting mid-sentence in a room full of people.
    if (speechOn) audioTts.cancel()
    setSpeechOn(!speechOn)
  }

  return (
    <div className="voice-toggle-wrap">
      <button
        type="button"
        className={`voice-toggle${speechOn ? '' : ' off'}`}
        onClick={toggle}
        aria-pressed={speechOn}
        aria-label={speechOn ? t('voice.mute') : t('voice.unmute')}
        title={speechOn ? t('voice.mute') : t('voice.unmute')}
      >
        {speechOn ? '🔊' : '🔇'}
      </button>
      {showHint && <div className="voice-hint">🎧 {t('voice.headphonesHint')}</div>}
    </div>
  )
}
