import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { speech } from '../speech/webSpeech'
import { langTag } from '../speech/ISpeech'
import { useOnboarding } from '../state/onboardingStore'

interface MicButtonProps {
  onTranscript: (text: string) => void
  /** Only rendered when the child opted into voice AND the device supports STT. */
  enabled?: boolean
}

/** A microphone button that fills a text field via speech-to-text. */
export default function MicButton({ onTranscript, enabled = true }: MicButtonProps) {
  const { t } = useTranslation()
  const language = useOnboarding((s) => s.language)
  const [listening, setListening] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => () => stopRef.current?.(), [])

  if (!enabled || !speech.sttSupported()) return null

  const toggle = () => {
    if (listening) {
      stopRef.current?.()
      setListening(false)
      return
    }
    setListening(true)
    stopRef.current = speech.listen({
      lang: langTag(language),
      onResult: (text) => onTranscript(text),
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    })
  }

  return (
    <button
      type="button"
      className={`mic-btn${listening ? ' listening' : ''}`}
      onClick={toggle}
      aria-label={listening ? t('voice.listening') : t('voice.speak')}
      title={listening ? t('voice.listening') : t('voice.speak')}
    >
      {listening ? '🔴' : '🎙️'}
    </button>
  )
}
