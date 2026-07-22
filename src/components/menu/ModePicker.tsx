import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MODES, type Category, type Mode } from '../../game/types'
import { MapPreview } from './MapPreview'
import { Icon, type IconName } from '../Icon'

interface Props {
  category: Category
  onPick: (mode: Mode) => void
}

// statiske gradient-klasser + ikon per modus (holdes hele for Tailwind JIT)
// fargene hentes fra samme palett som resten av appen: accent (klikk),
// info/flaggblått (velg), skog/success (skriv) — ikke tilfeldige Tailwind-toner
const MODE_META: Record<Mode, { gradient: string; icon: IconName }> = {
  click: { gradient: 'from-rose-500 via-[#d61a5c] to-[#5c0f2c]', icon: 'target' },
  choice: { gradient: 'from-[#4f6fe0] via-[#2a3f8f] to-[#0d1240]', icon: 'list' },
  type: { gradient: 'from-emerald-600 via-[#0f6b47] to-[#0a2e24]', icon: 'keyboard' },
}

export function ModePicker({ category, onPick }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-4">
      <p className="shrink-0 py-3" style={{ color: 'var(--text-subtle)' }}>
        {t(category.labelKey)} · {t('mode.subtitle')}
      </p>

      <ul className="grid min-h-0 flex-1 grid-cols-1 grid-rows-3 gap-2.5 pb-4 sm:grid-cols-3 sm:grid-rows-1">
        {MODES.map((m, i) => {
          const meta = MODE_META[m]
          return (
            <li key={m} className="min-h-0">
            <motion.button
              onClick={() => onPick(m)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 120 }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[1rem] bg-gradient-to-br ${meta.gradient} shadow-xl ring-4 ring-white/10 transition-shadow hover:shadow-2xl hover:ring-white/30`}
            >
              {/* blurret kart av valgt kategori */}
              <div className="absolute inset-0 scale-110 opacity-80 blur-[3px] transition-all duration-500 group-hover:scale-105 group-hover:blur-[1.5px]">
                <MapPreview category={category} />
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

              <div className="relative flex flex-col items-center gap-1.5 px-2 text-center text-white">
                <motion.span
                  className="drop-shadow-lg"
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.4,
                  }}
                >
                  <Icon name={meta.icon} className="h-16 w-16 sm:h-20 sm:w-20" />
                </motion.span>
                <span className="font-display text-lg font-extrabold tracking-tight drop-shadow-md sm:text-2xl">
                  {t(`mode.${m}.title`)}
                </span>
                <span className="max-w-xs text-xs font-medium text-white/85 drop-shadow sm:text-sm">
                  {t(`mode.${m}.desc`)}
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
