export type Language = 'no' | 'en'

/**
 * Norwegian or English, for the few strings this folder shows on its own.
 *
 * The games translate with different libraries (or none), and this folder
 * cannot import any of them. An explicit value wins; then the page's own
 * `<html lang>`, which the games keep in step with their language switch; then
 * the browser. Norwegian is the fallback because the site is Norwegian.
 */
export function detectLanguage(requested?: string | null): Language {
    const pick = (value: string | undefined | null): Language | null => {
        if (!value) return null
        const base = value.toLowerCase().split('-')[0]
        if (base === 'no' || base === 'nb' || base === 'nn') return 'no'
        if (base === 'en') return 'en'
        return null
    }
    const explicit = pick(requested)
    if (explicit) return explicit
    if (typeof document !== 'undefined') {
        const fromPage = pick(document.documentElement.lang)
        if (fromPage) return fromPage
    }
    if (typeof navigator !== 'undefined') {
        for (const candidate of navigator.languages ?? [navigator.language]) {
            const found = pick(candidate)
            if (found) return found
        }
    }
    return 'no'
}
