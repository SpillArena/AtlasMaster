import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { regions } from '../../game/regions'
import { bestForRegion } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { RegionPreview } from './RegionPreview'
import { Icon } from '../Icon'

interface Props {
  onPick: (regionId: string) => void
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/**
 * Første valg: hvilket kartblad. Hver flis er en plate i feltboka — papir med
 * regionens eget omriss tegnet i blekk, et plate-nummer, regionkoden i
 * hjørnekartusjen, og et lite lakksegl når du har en rekord der.
 */
export function RegionPicker({ onPick }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <ul className="grid grid-cols-1 gap-4 pb-6 sm:grid-cols-2">
        {regions.map((region, i) => {
          const best = bestForRegion(region.id)
          return (
            <li key={region.id}>
              <motion.button
                onClick={() => {
                  playSfx('ui')
                  onPick(region.id)
                }}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 130, damping: 18 }}
                whileHover={{ y: -3, rotate: -0.4 }}
                whileTap={{ scale: 0.98, rotate: 0.6 }}
                className="plate sheen-host group relative flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden p-4 text-left"
              >
                {/* omrisset, som blekk på platen */}
                <div className="absolute inset-4 opacity-80">
                  <RegionPreview region={region} />
                </div>

                {/* lys skygging så tittelen leses mot omrisset */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-2/3"
                  style={{
                    background:
                      'linear-gradient(to top, var(--color-surface-elevated) 12%, transparent)',
                  }}
                />

                {/* plate-nummer, oppe til venstre */}
                <span
                  className="stat-label absolute left-4 top-3"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  {t('region.plate', { n: ROMAN[i] ?? i + 1 })}
                </span>

                {/* regionkode i hjørnekartusjen */}
                <span
                  className="numeric absolute right-3 top-3 rounded border px-1.5 py-0.5 text-[0.6875rem] font-bold"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--brass) 45%, transparent)',
                    color: 'var(--brass)',
                    background: 'color-mix(in srgb, var(--brass) 10%, transparent)',
                  }}
                >
                  {region.code}
                </span>

                {best > 0 && (
                  <span
                    className="stamp absolute bottom-3 left-3 h-9 w-9 text-[0.625rem] font-bold"
                    style={{ color: 'var(--gold)' }}
                  >
                    <span className="numeric">{best}</span>
                  </span>
                )}

                <span className="relative mt-auto flex flex-col gap-1">
                  <span
                    className="font-display text-3xl font-semibold leading-none tracking-[-0.01em] sm:text-4xl"
                    style={{ color: 'var(--text)' }}
                  >
                    {t(region.labelKey)}
                  </span>
                  <span
                    className="flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    <Icon name="compass" className="h-3.5 w-3.5" />
                    {t('region.count', { count: region.categories.length })}
                  </span>
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
