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

/**
 * Første valg: hvor i verden. Hver flis tegner regionens eget omriss i sin
 * egen projeksjon, så forskjellen mellom et land og et kontinent er synlig
 * før du har trykket på noe.
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
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, type: 'spring', stiffness: 120 }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.975 }}
                className={`sheen-host group relative flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br ${region.gradient} shadow-xl ring-4 ring-white/10 transition-shadow hover:shadow-2xl hover:ring-white/30`}
              >
                {/* regionens omriss, dempet og litt overskalert */}
                <div className="absolute inset-0 scale-105 opacity-90 transition-transform duration-200 group-hover:scale-100">
                  <RegionPreview region={region} />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />

                {best > 0 && (
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
                    <Icon name="trophy" className="h-3 w-3" style={{ color: 'var(--gold)' }} />
                    <span className="numeric text-xs font-bold" style={{ color: 'var(--gold)' }}>
                      {best}
                    </span>
                  </div>
                )}

                <div className="relative flex flex-col items-center gap-2 px-3 text-center text-white">
                  <span
                    className="rounded-lg px-2 py-0.5 font-display text-xs font-extrabold tracking-[0.2em] backdrop-blur-sm"
                    style={{ background: 'color-mix(in srgb, var(--accent) 75%, transparent)' }}
                  >
                    {region.code}
                  </span>
                  <span className="font-display text-3xl font-extrabold tracking-[-0.03em] drop-shadow-md sm:text-4xl">
                    {t(region.labelKey)}
                  </span>
                  <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
                    {t('region.count', { count: region.categories.length })}
                  </span>
                </div>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
