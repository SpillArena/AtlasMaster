import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { bestForCategory, bestForRegion } from '../../game/progress'
import { childRegions } from '../../game/regions'
import { playSfx } from '../../game/sfx'
import { RegionPreview } from './RegionPreview'
import { StepHeader } from './StepHeader'
import { REGION_COLOR } from './skins'
import { Icon, type IconName } from '../Icon'
import type { Region } from '../../game/types'

interface Props {
  region: Region
  onPick: (categoryId: string) => void
  /** valgt et underkort — en hel region som ligger under denne */
  onPickRegion: (regionId: string) => void
  onBack: () => void
}

interface Tile {
  key: string
  label: string
  desc: string
  icon: IconName
  color: string
  best: number
  onClick: () => void
}

/**
 * Andre valg: hva du øver på. Til venstre regionen selv, fylt i samme farge
 * som på forsidekartet, så man ser hvor man trykket. Til høyre en flis per
 * kategori, og til slutt underregionene (USA ligger inne i Nord-Amerika) —
 * de går videre inn i en ny meny i stedet for å starte en runde.
 */
export function CategoryPicker({ region, onPick, onPickRegion, onBack }: Props) {
  const { t } = useTranslation()
  const children = childRegions(region.id)
  const color = REGION_COLOR[region.id] ?? REGION_COLOR.world

  const tiles: Tile[] = [
    ...region.categories.map((c) => ({
      key: c.id,
      label: t(c.labelKey),
      desc: t(`tile.${c.id}`),
      icon: c.icon,
      color: c.color,
      best: bestForCategory(region.id, c.id),
      onClick: () => onPick(c.id),
    })),
    ...children.map((child) => ({
      key: child.id,
      label: `${t(child.labelKey)} →`,
      desc: t(`subregion.${child.id}`),
      icon: 'compass' as IconName,
      color: REGION_COLOR[child.id] ?? color,
      best: bestForRegion(child.id),
      onClick: () => onPickRegion(child.id),
    })),
  ]

  return (
    <div className="w-full">
      <div className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col gap-5 px-4 py-6">
        <StepHeader step={2} title={t('cat.subtitle')} onBack={onBack} backLabel={t('region.back')} />

        <div className="flex flex-wrap gap-4">
          <motion.section
            aria-label={t(region.labelKey)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            className="relative flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-[28px] border border-[var(--border)] bg-[var(--color-surface-elevated)] px-5 pb-5 pt-11 sm:gap-4 sm:rounded-[32px] sm:px-6 sm:pb-6 sm:pt-12"
          >
            <span className="hud-label absolute left-5 top-5 sm:left-6">
              {t('region.title')} · {region.code}
            </span>
            <div className="h-36 w-full sm:h-56 lg:aspect-[8/5] lg:h-auto">
              <RegionPreview region={region} color={color} />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="m-0 text-[clamp(1.875rem,4vw,3.5rem)] font-bold leading-none tracking-[-0.035em]">
                {t(region.labelKey)}
              </h2>
              <span className="numeric rounded-full bg-[var(--surface-raised)] px-3 py-1.5 text-xs">
                {t('region.count', { count: region.categories.length }).toUpperCase()}
              </span>
            </div>
          </motion.section>

          <ul className="grid min-w-0 flex-[1.2_1_520px] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {tiles.map((tile, i) => (
              <motion.li
                key={tile.key}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, type: 'spring', stiffness: 160, damping: 20 }}
                className="flex"
              >
                <motion.button
                  type="button"
                  onClick={() => {
                    playSfx('ui')
                    tile.onClick()
                  }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex flex-1 items-center gap-4 rounded-[24px] border border-[var(--border)] p-4 text-left transition-colors hover:border-[var(--border-hover)] sm:min-h-[220px] sm:flex-col sm:items-stretch sm:rounded-[28px] sm:p-5"
                  style={{
                    background: `color-mix(in srgb, ${tile.color} 16%, var(--color-surface-elevated))`,
                  }}
                >
                  {/*
                    Én flis, to oppsett. På en telefon er den en rad — ikon,
                    navn, pil — så fire kategorier får plass på én skjerm. Fra
                    `sm` er den et høyt kort med rekorden oppe i hjørnet.
                  */}
                  <span className="flex shrink-0 items-start justify-between gap-3 sm:w-full">
                    <span
                      aria-hidden
                      className="grid h-12 w-12 place-items-center rounded-[16px] text-white sm:h-14 sm:w-14 sm:rounded-[18px]"
                      style={{ background: tile.color }}
                    >
                      <Icon name={tile.icon} className="h-6 w-6 sm:h-7 sm:w-7" />
                    </span>
                    <span className="numeric hidden rounded-full bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs font-bold sm:inline">
                      {t('mode.best').toUpperCase()} {tile.best > 0 ? tile.best : t('region.none')}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:mt-auto sm:w-full sm:flex-none sm:items-end">
                    <span className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
                      <span className="text-xl font-bold leading-none tracking-[-0.02em] sm:text-[1.75rem]">
                        {tile.label}
                      </span>
                      <span className="text-sm leading-snug text-[var(--text-muted)] sm:text-[0.9375rem]">
                        {tile.desc}
                      </span>
                      {tile.best > 0 && (
                        <span className="numeric text-xs font-bold text-[var(--gold)] sm:hidden">
                          {t('mode.best').toUpperCase()} {tile.best}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--text)] text-[var(--bg)] transition-transform group-hover:translate-x-0.5 sm:h-11 sm:w-11"
                    >
                      →
                    </span>
                  </span>
                </motion.button>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
