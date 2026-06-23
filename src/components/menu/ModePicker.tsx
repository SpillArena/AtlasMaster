import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MODES, type Category, type Mode } from '../../game/types'
import { MapPreview } from './MapPreview'
import { Icon, type IconName } from '../Icon'

interface Props {
  category: Category
  onPick: (mode: Mode) => void
  onBack: () => void
}

// statiske gradient-klasser + ikon per modus (holdes hele for Tailwind JIT)
const MODE_META: Record<Mode, { gradient: string; icon: IconName }> = {
  click: { gradient: 'from-rose-500 via-rose-700 to-pink-950', icon: 'target' },
  choice: { gradient: 'from-violet-600 via-purple-800 to-fuchsia-950', icon: 'list' },
  type: { gradient: 'from-amber-500 via-orange-700 to-red-950', icon: 'keyboard' },
}

export function ModePicker({ category, onPick, onBack }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="flex items-center gap-3 py-2">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          ← {t('mode.back')}
        </button>
        <span className="text-gray-500 dark:text-gray-400">
          {t(category.labelKey)} · {t('mode.subtitle')}
        </span>
      </div>

      <div className="grid h-[calc(100dvh-9rem)] grid-cols-1 gap-4 pb-4 sm:grid-cols-3">
        {MODES.map((m, i) => {
          const meta = MODE_META[m]
          return (
            <motion.button
              key={m}
              onClick={() => onPick(m)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 120 }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br ${meta.gradient} shadow-xl ring-4 ring-white/10 transition-shadow hover:shadow-2xl hover:ring-white/30`}
            >
              {/* blurret kart av valgt kategori */}
              <div className="absolute inset-0 scale-110 opacity-80 blur-[3px] transition-all duration-500 group-hover:scale-105 group-hover:blur-[1.5px]">
                <MapPreview category={category} />
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

              <div className="relative flex flex-col items-center gap-3 px-4 text-center text-white">
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
                  <Icon name={meta.icon} className="h-20 w-20" />
                </motion.span>
                <span className="text-3xl font-extrabold tracking-tight drop-shadow-md">
                  {t(`mode.${m}.title`)}
                </span>
                <span className="max-w-xs text-base font-medium text-white/85 drop-shadow">
                  {t(`mode.${m}.desc`)}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
