import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

interface Props {
  title: string
  body: string
  confirmLabel: string
  /** farger bekreft-knappen som en destruktiv handling */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Ja/nei-dialog for handlinger som kaster arbeid bort. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation()

  return (
    <div
      className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="panel w-full max-w-sm rounded-2xl p-6"
        style={{ color: 'var(--text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display mb-1 text-xl font-extrabold tracking-tight">
          {title}
        </h2>
        <p id="confirm-body" className="text-sm" style={{ color: 'var(--text-subtle)' }}>
          {body}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            autoFocus
            onClick={onCancel}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {t('giveUp.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
            style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
