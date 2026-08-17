/**
 * Speech abstraction. Screens depend on this interface, never on a concrete engine,
 * so the browser Web Speech implementation can later be swapped for a self-hosted
 * Whisper/Piper service or a cloud API without touching any screen.
 */
export interface SpeechListenOptions {
  lang: string // BCP-47, e.g. 'en-IN' | 'ta-IN'
  onResult: (transcript: string) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export interface ISpeech {
  /** Whether speech-to-text is available in this environment. */
  sttSupported(): boolean
  /** Whether text-to-speech is available in this environment. */
  ttsSupported(): boolean
  /** Begin listening. Returns a stop() function. */
  listen(options: SpeechListenOptions): () => void
  /** Speak the given text. */
  speak(text: string, lang: string): void
  /** Cancel any in-progress speech. */
  cancelSpeech(): void
}

export function langTag(language: 'en' | 'hi' | 'ta' | 'te' | 'ml'): string {
  const tags: Record<'en' | 'hi' | 'ta' | 'te' | 'ml', string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    ml: 'ml-IN',
  }
  return tags[language]
}
