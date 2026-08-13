import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { audioTts } from './audioTts'
import { GREETING_PLACEHOLDER, hasTapLines, linesFor } from './spokenKeys'
import { useOnboarding } from '../state/onboardingStore'
import { getGreeting } from '../lib/greeting'

/** Resolves the time-of-day placeholder to a real clip; other keys pass through. */
function resolveKey(key: string): string {
  return key === GREETING_PLACEHOLDER ? `greeting.${getGreeting().key}` : key
}

/** Speaks a screen's 'auto' lines on entry. Called once from <Screen>, so voice follows the route map. */
export function useAutoSpeak(): void {
  const { pathname } = useLocation()
  const language = useOnboarding((s) => s.language)
  const speechOn = useOnboarding((s) => s.speechOn)

  useEffect(() => {
    if (!speechOn) {
      audioTts.cancel()
      return
    }
    const keys = linesFor(pathname, 'auto').map((l) => resolveKey(l.key))
    if (keys.length === 0) return
    void audioTts.speak(keys, language)
    // Navigating away must stop the whole queue, not just the audible clip.
    return () => audioTts.cancel()
  }, [pathname, language, speechOn])
}

/** Drives the listen button on tap-only screens (Emergency, S11). */
export function useTapSpeak(): { available: boolean; playing: boolean; toggle: () => void } {
  const { pathname } = useLocation()
  const language = useOnboarding((s) => s.language)
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => audioTts.cancel(), [])

  const toggle = useCallback(() => {
    if (playing) {
      audioTts.cancel()
      setPlaying(false)
      return
    }
    const keys = linesFor(pathname, 'tap').map((l) => resolveKey(l.key))
    if (keys.length === 0) return
    setPlaying(true)
    void audioTts.speak(keys, language).then(() => setPlaying(false))
  }, [playing, pathname, language])

  return { available: hasTapLines(pathname), playing, toggle }
}
