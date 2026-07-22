import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setName } from '../../game/leaderboard'
import { Icon } from '../Icon'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

/** Modal som ber om navn før et spill starter når navnefeltet er tomt. */
export function NamePrompt({ onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const trimmed = value.trim()

  const submit = () => {
    if (!trimmed) return
    setName(trimmed)
    onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        aria-describedby="name-prompt-desc"
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
        style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="name-prompt-title" className="font-display mb-1 text-lg font-bold">
          {t('namePrompt.title')}
        </h2>
        <p id="name-prompt-desc" className="mb-4 text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('namePrompt.desc')}
        </p>

        <div
          className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors focus-within:border-[var(--accent)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <Icon name="user" className="h-4 w-4" style={{ color: 'var(--text-subtle)' }} />
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 20))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('nav.name')}
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {t('namePrompt.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!trimmed}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--danger)' }}
          >
            {t('namePrompt.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
