import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { bestForCategory } from '../../game/progress'
import { playSfx } from '../../game/sfx'
import { MapPreview } from './MapPreview'
import { Icon } from '../Icon'
import type { Region } from '../../game/types'

interface Props {
  region: Region
  onPick: (categoryId: string) => void
}

export function CategoryPicker({ region, onPick }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center gap-4 px-4 py-6">
      <div>
        <p className="stat-label mb-1">{t(region.labelKey)}</p>
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
          {t('cat.subtitle')}
        </h2>
      </div>

      {/*
        2×2 er standard. Under ~360px klipper skildringsteksten seg sjølv i
        to kolonnar («Find Europe's capital cities» blir kutta til «...
        capital»), så då fell rutenettet ned til éin kolonne — aldri opp til
        fire, sjølv om det er plass til det på store skjermar.
      */}
      <ul className="grid grid-cols-1 gap-4 pb-2 min-[360px]:grid-cols-2">
        {region.categories.map((c, i) => {
          const best = bestForCategory(region.id, c.id)
          return (
            <li key={c.id}>
              <motion.button
                onClick={() => {
                  playSfx('ui')
                  onPick(c.id)
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, type: 'spring', stiffness: 120 }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.975 }}
                className={`sheen-host group relative flex aspect-square w-full flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br ${c.gradient} shadow-xl ring-4 ring-white/10 transition-shadow hover:shadow-2xl hover:ring-white/30 sm:aspect-[4/3]`}
              >
                {/*
                  Blurret regionkart med kategoriens plasseringer uthevet.
                  Sløret ligg fast: å animere `filter: blur()` tvingar
                  nettlesaren til å rendre heile kartet på nytt for kvar frame
                  i overgangen, og hover kjendest treig av det. Berre skalaen
                  rører seg — den går på kompositoren.
                */}
                <div className="absolute inset-0 scale-110 opacity-90 blur-[3px] transition-transform duration-200 group-hover:scale-[1.06]">
                  <MapPreview category={c} projection={region.projection} />
                </div>

                {/* kontrast-gradient for tekst */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25" />

                {/* personlig rekord — grunnen til å spille kategorien igjen */}
                {best > 0 && (
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
                    <Icon name="trophy" className="h-3 w-3" style={{ color: 'var(--gold)' }} />
                    <span className="numeric text-xs font-bold" style={{ color: 'var(--gold)' }}>
                      {best}
                    </span>
                  </div>
                )}

                <div className="relative flex flex-col items-center gap-2 px-3 text-center text-white sm:gap-3">
                  <motion.span
                    className="drop-shadow-lg"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  >
                    <Icon
                      name={c.icon}
                      className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16"
                    />
                  </motion.span>
                  <span className="font-display text-3xl font-extrabold tracking-[-0.03em] drop-shadow-md sm:text-4xl md:text-5xl">
                    {t(c.labelKey)}
                  </span>
                  <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm sm:text-lg">
                    {t(`tile.${c.id}`)}
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
