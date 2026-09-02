import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { getName, setName } from '../../game/leaderboard'
import { Icon } from '../Icon'
import { Button } from '../ui'

interface Props {
  onConfirm: () => void
  onCancel: () => void
  /** 'start' spør før første runde, 'edit' endrer et navn som allerede finnes */
  variant?: 'start' | 'edit'
}

/** Modal for spillernavnet — vises før start og ved redigering fra headeren. */
export function NamePrompt({ onConfirm, onCancel, variant = 'start' }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState(() => (variant === 'edit' ? getName() : ''))

  const trimmed = value.trim()

  const submit = () => {
    if (!trimmed) return
    setName(trimmed)
    onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        aria-describedby="name-prompt-desc"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="panel w-full max-w-sm rounded-2xl p-6"
        style={{ color: 'var(--text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="name-prompt-title" className="font-display mb-1 text-xl font-extrabold tracking-tight">
          {t(variant === 'edit' ? 'namePrompt.editTitle' : 'namePrompt.title')}
        </h2>
        <p id="name-prompt-desc" className="mb-4 text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('namePrompt.desc')}
        </p>

        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors focus-within:border-[var(--accent)]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <Icon name="user" className="h-4 w-4 shrink-0" style={{ color: 'var(--text-subtle)' }} />
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 20))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('nav.name')}
            autoComplete="off"
            className="w-full bg-transparent text-base outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('namePrompt.cancel')}
          </Button>
          <Button size="sm" onClick={submit} disabled={!trimmed}>
            {t(variant === 'edit' ? 'namePrompt.save' : 'namePrompt.confirm')}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
