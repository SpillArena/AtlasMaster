import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import no from './locales/no.json'
import { readPreference, writePreference } from '../lib/cookieConsent'

const STORAGE_KEY = 'lang'

/** Norsk til norske nettlesere; ellers engelsk. Lagret valg vinner. */
function initialLanguage(): string {
  const saved = readPreference(STORAGE_KEY)
  if (saved === 'no' || saved === 'en') return saved
  const browser = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase()
  return browser.startsWith('nb') || browser.startsWith('nn') || browser.startsWith('no')
    ? 'no'
    : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    no: { translation: no },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

/**
 * Holder dokumentet i takt med språkvalget: `lang` styrer orddeling og
 * skjermlesere, og tittel/beskrivelse er det som vises i fanen og i deling.
 */
function syncDocumentMeta(lng: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lng
  document.title = i18n.t('meta.title')
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('meta.description'))
}

syncDocumentMeta(i18n.language)

i18n.on('languageChanged', (lng) => {
  writePreference(STORAGE_KEY, lng)
  syncDocumentMeta(lng)
})

export default i18n
