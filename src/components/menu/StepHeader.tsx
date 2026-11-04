import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BackButton } from '../header/BackToArena'

interface Props {
  step: number
  title: ReactNode
  onBack: () => void
  backLabel?: string
  /** ekstra tekst ved trinnmerket, f.eks. tastatursnarveiene */
  hint?: string
}

/** Toppen av kategori-, modus- og temposkjermen: tilbake, tittel, trinn. */
export function StepHeader({ step, title, onBack, backLabel, hint }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <BackButton onBack={onBack} label={backLabel} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-h1 m-0"
        >
          {title}
        </motion.h1>
        <span className="hud-label">
          {t('menu.step', { n: step, total: 4 })}
          {/* tastatursnarveier betyr ingenting på en berøringsskjerm */}
          {hint && <span className="hidden [@media(hover:hover)]:inline"> · {hint}</span>}
        </span>
      </div>
    </div>
  )
}
