import { useTranslation } from 'react-i18next'
import { useTapSpeak } from '../speech/useSpeak'

/**
 * Plays the current screen's tap-only copy.
 *
 * Used on Emergency and the S11 clinician re-offer — the screens whose words name distress
 * and self-harm. Those are read aloud only when the child asks for it, because the children
 * they help most are the ones for whom being overheard does the most harm.
 */
export default function SpeakButton() {
  const { t } = useTranslation()
  const { available, playing, toggle } = useTapSpeak()

  if (!available) return null

  const label = playing ? t('voice.stopPlaying') : t('voice.playAloud')

  return (
    <button
      type="button"
      className={`speak-btn${playing ? ' playing' : ''}`}
      onClick={toggle}
      aria-label={label}
    >
      <span aria-hidden="true">{playing ? '⏹' : '🔊'}</span>
      <span>{label}</span>
    </button>
  )
}
