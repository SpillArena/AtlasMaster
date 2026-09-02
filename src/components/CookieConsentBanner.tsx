import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { useCookieConsent } from '../contexts/useCookieConsent'

/** Hva som lagres, gruppert slik en spiller tenker om det. */
const STORED_GROUPS = ['settings', 'player', 'scores'] as const

export default function CookieConsentBanner() {
  const { t } = useTranslation()
  const { bannerVisible, accept, decline } = useCookieConsent()
  const [showDetails, setShowDetails] = useState(false)

  return (
    <AnimatePresence>
      {bannerVisible && (
        <motion.div
          role="dialog"
          aria-label={t('cookieConsent.section')}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-0 z-[500] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <div className="cartouche w-full max-w-screen-md p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h2
                  className="font-display text-lg font-semibold tracking-[-0.005em]"
                  style={{ color: 'var(--text)' }}
                >
                  {t('cookieConsent.section')}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-subtle)' }}>
                  {t('cookieConsent.message')}
                </p>
                <button
                  type="button"
                  onClick={() => setShowDetails((value) => !value)}
                  aria-expanded={showDetails}
                  className="mt-2 text-xs font-semibold underline underline-offset-2"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  {showDetails ? t('cookieConsent.hideDetails') : t('cookieConsent.showDetails')}
                </button>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={decline}
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors duration-200 hover:text-[var(--text)] sm:flex-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}
                >
                  {t('cookieConsent.decline')}
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="flex-1 rounded-xl px-5 py-2.5 text-sm font-bold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:flex-none"
                  style={{ background: 'var(--accent)', color: 'var(--color-surface)' }}
                >
                  {t('cookieConsent.accept')}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showDetails && (
                <motion.dl
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {STORED_GROUPS.map((group) => (
                      <div key={group}>
                        <dt className="stat-label mb-1">{t(`cookieConsent.stored.${group}.title`)}</dt>
                        <dd className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {t(`cookieConsent.stored.${group}.desc`)}
                        </dd>
                      </div>
                    ))}
                  </div>
                </motion.dl>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
