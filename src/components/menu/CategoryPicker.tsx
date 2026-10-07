import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { bestForCategory, bestForRegion } from '../../game/progress'
import { childRegions } from '../../game/regions'
import { playSfx } from '../../game/sfx'
import { MapPreview } from './MapPreview'
import { Icon } from '../Icon'
import type { Region } from '../../game/types'
import { BackButton } from '../header/BackToArena'

interface Props {
  region: Region
  onPick: (categoryId: string) => void
  /** valgt et underkort — en hel region som ligger under denne */
  onPickRegion: (regionId: string) => void
  onBack: () => void
}

/**
 * Andre valg: hva du kartlegger. Hvert kort er en plate med regionkartet svakt
 * bak og kategoriens tegn stemplet oppå.
 */
export function CategoryPicker({ region, onPick, onPickRegion, onBack }: Props) {
  const { t } = useTranslation()
  const children = childRegions(region.id)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1760px] flex-col justify-center gap-4 px-4 py-6">
      <BackButton onBack={onBack} />
      <div>
        <p className="eyebrow">{t(region.labelKey)}</p>
        <h2 className="text-h2">{t('cat.subtitle')}</h2>
      </div>

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
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 130, damping: 18 }}
                whileHover={{ y: -3, rotate: -0.4 }}
                whileTap={{ scale: 0.98, rotate: 0.5 }}
                className="plate sheen-host group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden p-4 text-center sm:aspect-[4/3]"
              >
                <div className="absolute inset-3 opacity-40 blur-[2px]">
                  <MapPreview category={c} projection={region.projection} />
                </div>

                {best > 0 && (
                  <span
                    className="stamp absolute right-3 top-3 h-9 w-9 text-[0.625rem] font-bold"
                    style={{ color: 'var(--gold)' }}
                  >
                    <span className="numeric">{best}</span>
                  </span>
                )}

                <div className="relative flex flex-col items-center gap-2">
                  <span
                    className="stamp h-14 w-14 sm:h-16 sm:w-16"
                    style={{ color: c.color }}
                  >
                    <Icon name={c.icon} className="h-7 w-7 sm:h-8 sm:w-8" />
                  </span>
                  <span
                    className="font-display text-3xl font-semibold tracking-[-0.01em] sm:text-4xl"
                    style={{ color: 'var(--text)' }}
                  >
                    {t(c.labelKey)}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-subtle)' }}>
                    {t(`tile.${c.id}`)}
                  </span>
                </div>
              </motion.button>
            </li>
          )
        })}

        {/*
          Underregionene står sist, etter kategoriene, som egne kort. De er
          ikke en øvelse men en hel meny til — USA ligger under Nord-Amerika,
          og delstatene er et valg her inne i stedet for en egen flekk på
          kartet. Kortet viser underregionens eget kart, i dens projeksjon,
          med kompasset som stempel og en pil etter navnet: dette går videre
          inn, det starter ingen runde.
        */}
        {children.map((child, j) => {
          const preview = child.categories[0]
          const best = bestForRegion(child.id)
          return (
            <li key={child.id}>
              <motion.button
                onClick={() => {
                  playSfx('ui')
                  onPickRegion(child.id)
                }}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: (region.categories.length + j) * 0.08,
                  type: 'spring',
                  stiffness: 130,
                  damping: 18,
                }}
                whileHover={{ y: -3, rotate: -0.4 }}
                whileTap={{ scale: 0.98, rotate: 0.5 }}
                className="plate sheen-host group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden p-4 text-center sm:aspect-[4/3]"
              >
                {preview && (
                  <div className="absolute inset-3 opacity-40 blur-[2px]">
                    <MapPreview category={preview} projection={child.projection} />
                  </div>
                )}

                {best > 0 && (
                  <span
                    className="stamp absolute right-3 top-3 h-9 w-9 text-[0.625rem] font-bold"
                    style={{ color: 'var(--gold)' }}
                  >
                    <span className="numeric">{best}</span>
                  </span>
                )}

                <div className="relative flex flex-col items-center gap-2">
                  <span
                    className="stamp h-14 w-14 sm:h-16 sm:w-16"
                    style={{ color: preview?.color ?? 'var(--accent)' }}
                  >
                    <Icon name="compass" className="h-7 w-7 sm:h-8 sm:w-8" />
                  </span>
                  <span
                    className="font-display text-3xl font-semibold tracking-[-0.01em] sm:text-4xl"
                    style={{ color: 'var(--text)' }}
                  >
                    {t(child.labelKey)} →
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-subtle)' }}>
                    {t(`subregion.${child.id}`)}
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
