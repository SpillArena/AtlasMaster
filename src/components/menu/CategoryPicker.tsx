import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { categories } from '../../game/categories'
import { MapPreview } from './MapPreview'
import { Icon } from '../Icon'

interface Props {
  onPick: (categoryId: string) => void
}

// statiske gradient-klasser per kategori (holdes hele for Tailwind JIT)
// fylker = skog, storbyer = flaggblå natt-by, elver = vann, fjell = granitt — nordisk, ikke tilfeldig
const GRADIENTS: Record<string, string> = {
  fylker: 'from-emerald-600 via-[#0f6b47] to-[#0a2e24]',
  storbyer: 'from-[#3a5fcd] via-[#182a6e] to-[#0a1230]',
  elver: 'from-cyan-600 via-[#0e7490] to-[#0b3a4a]',
  fjell: 'from-stone-500 via-[#57534e] to-[#1c1917]',
}

export function CategoryPicker({ onPick }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-6xl px-4">
      <ul className="grid grid-cols-1 gap-4 pb-6 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c, i) => (
          <li key={c.id}>
            <motion.button
              onClick={() => onPick(c.id)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 120 }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br ${GRADIENTS[c.id] ?? 'from-gray-700 to-gray-900'
                } shadow-xl ring-4 ring-white/10 transition-shadow hover:ring-white/30 hover:shadow-2xl`}
            >
              {/* blurret Norge-kart med uthevinger */}
              <div className="absolute inset-0 scale-110 opacity-90 blur-[3px] transition-all duration-500 group-hover:scale-105 group-hover:blur-[1.5px]">
                <MapPreview category={c} />
              </div>

              {/* kontrast-gradient for tekst */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

              {/* innhold */}
              <div className="relative flex flex-col items-center gap-2 px-3 text-center text-white sm:gap-3">
                <motion.span
                  className="drop-shadow-lg"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                >
                  <Icon name={c.icon} className="h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-16 lg:w-16" />
                </motion.span>
                <span className="font-display text-3xl font-extrabold tracking-tight drop-shadow-md sm:text-4xl md:text-5xl lg:text-3xl">
                  {t(c.labelKey)}
                </span>
                <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm sm:text-lg lg:text-sm">
                  {t(`tile.${c.id}`)}
                </span>
              </div>
            </motion.button>
          </li>
        ))}
      </ul>
    </div>
  )
}
