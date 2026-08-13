import type { Language } from '../i18n'

/** Plays ARAM's voice from pre-rendered clips. MP3 because it is the one format every browser decodes. */

const AUDIO_BASE = '/audio'

function clipUrl(key: string, lang: Language): string {
  return `${AUDIO_BASE}/${lang}/${key}.mp3`
}

class AudioTts {
  private el: HTMLAudioElement | null = null

  /** Bumped on every cancel/speak; queued clips give up when it no longer matches. */
  private run = 0

  private autoplayBlocked = false

  /** True once the browser refused to play without a user gesture. */
  get blocked(): boolean {
    return this.autoplayBlocked
  }

  /** Stop immediately and abandon anything still queued. */
  cancel(): void {
    this.run += 1
    const el = this.el
    this.el = null
    if (el) {
      el.pause()
      // Drop the source too, or the browser may keep streaming in the background.
      el.removeAttribute('src')
      el.load()
    }
  }

  /** Speak the given keys back to back. Resolves when the last one ends. */
  async speak(keys: string[], lang: Language): Promise<void> {
    this.cancel()
    const run = this.run
    // Load each clip while the previous one plays, or every boundary pays a decode delay.
    let next = keys.length > 0 ? this.load(keys[0], lang) : null
    for (let i = 0; i < keys.length; i++) {
      if (run !== this.run || !next) return
      const el = next
      next = i + 1 < keys.length ? this.load(keys[i + 1], lang) : null
      await this.playOne(el, run)
    }
  }

  private load(key: string, lang: Language): HTMLAudioElement {
    const el = new Audio(clipUrl(key, lang))
    el.preload = 'auto'
    el.load()
    return el
  }

  private playOne(el: HTMLAudioElement, run: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (run !== this.run) return resolve()

      this.el = el

      const finish = () => {
        el.removeEventListener('ended', finish)
        el.removeEventListener('error', finish)
        if (this.el === el) this.el = null
        resolve()
      }

      el.addEventListener('ended', finish, { once: true })
      // A missing clip resolves like a finished one: one bad file must not swallow the rest.
      el.addEventListener('error', finish, { once: true })

      el.play().catch((err: unknown) => {
        // Blocked-until-gesture is not an error worth surfacing; the line just needs a tap.
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          this.autoplayBlocked = true
        }
        finish()
      })
    })
  }
}

export const audioTts = new AudioTts()
