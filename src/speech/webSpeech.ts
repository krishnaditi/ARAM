import type { ISpeech, SpeechListenOptions } from './ISpeech'

// Minimal typings for the Web Speech API (not in the standard DOM lib).
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

class WebSpeech implements ISpeech {
  sttSupported(): boolean {
    return getRecognitionCtor() !== null
  }

  ttsSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  listen(options: SpeechListenOptions): () => void {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      options.onError?.('unsupported')
      return () => {}
    }
    const rec = new Ctor()
    rec.lang = options.lang
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      if (last && last[0]) options.onResult(last[0].transcript.trim())
    }
    rec.onerror = (e) => options.onError?.(e.error)
    rec.onend = () => options.onEnd?.()
    try {
      rec.start()
    } catch {
      options.onError?.('start-failed')
    }
    return () => {
      try {
        rec.abort()
      } catch {
        /* already stopped */
      }
    }
  }

  speak(text: string, lang: string): void {
    if (!this.ttsSupported()) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.98
    window.speechSynthesis.speak(u)
  }

  cancelSpeech(): void {
    if (this.ttsSupported()) window.speechSynthesis.cancel()
  }
}

export const speech: ISpeech = new WebSpeech()
