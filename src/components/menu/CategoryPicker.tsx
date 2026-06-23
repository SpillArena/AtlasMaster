import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { categories } from '../../game/categories'
import { MapPreview } from './MapPreview'
import { Icon } from '../Icon'

interface Props {
  onPick: (categoryId: string) => void
}

// statiske gradient-klasser per kategori (holdes hele for Tailwind JIT)
const GRADIENTS: Record<string, string> = {
  fylker: 'from-emerald-600 via-emerald-800 to-teal-950',
  storbyer: 'from-sky-600 via-blue-900 to-indigo-950',
}

export function CategoryPicker({ onPick }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="grid h-[calc(100dvh-5.5rem)] grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
        {categories.map((c, i) => (
          <motion.button
            key={c.id}
            onClick={() => onPick(c.id)}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, type: 'spring', stiffness: 120 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br ${
              GRADIENTS[c.id] ?? 'from-gray-700 to-gray-900'
            } shadow-xl ring-4 ring-white/10 transition-shadow hover:ring-white/30 hover:shadow-2xl`}
          >
            {/* blurret Norge-kart med uthevinger */}
            <div className="absolute inset-0 scale-110 opacity-90 blur-[3px] transition-all duration-500 group-hover:scale-105 group-hover:blur-[1.5px]">
              <MapPreview category={c} />
            </div>

            {/* kontrast-gradient for tekst */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

            {/* innhold */}
            <div className="relative flex flex-col items-center gap-3 text-white">
              <motion.span
                className="drop-shadow-lg"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
              >
                <Icon name={c.icon} className="h-24 w-24" />
              </motion.span>
              <span className="text-5xl font-extrabold tracking-tight drop-shadow-md">
                {t(c.labelKey)}
              </span>
              <span className="rounded-full bg-white/15 px-4 py-1.5 text-lg font-medium text-white/90 backdrop-blur-sm">
                {t(`tile.${c.id}`)}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
