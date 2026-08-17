import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ta from './ta.json'

export type Language = 'en' | 'hi' | 'ta' | 'te' | 'ml'

// Only English and Tamil have translated copy today. Hindi/Telugu/Malayalam are selectable
// on S02 so the language step reflects the real student population, but i18next's
// fallbackLng below renders them in English until those translation files are added —
// never a crash, never blank text.

const STORAGE_KEY = 'aram.lang'

// Some devices (managed school Chromebooks/tablets, strict browser privacy modes)
// block or throw on localStorage access entirely. Reading/writing the saved
// language preference must never let that break the actual language switch.
function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage blocked — the language still changes for this session, it just
    // won't be remembered on the next visit. Never let this stop the switch below.
  }
}

const ALL_LANGUAGES: Language[] = ['en', 'hi', 'ta', 'te', 'ml']

function initialLanguage(): Language {
  const stored = readStoredLanguage()
  return (ALL_LANGUAGES as string[]).includes(stored ?? '') ? (stored as Language) : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: Language): void {
  // The actual, visible switch happens first and unconditionally — a storage
  // failure (see writeStoredLanguage) must never prevent the UI from translating.
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  writeStoredLanguage(lang)
}

document.documentElement.lang = i18n.language

export default i18n
