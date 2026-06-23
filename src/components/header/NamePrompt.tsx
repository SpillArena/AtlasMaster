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
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-bold">{t('namePrompt.title')}</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {t('namePrompt.desc')}
        </p>

        <div className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 focus-within:border-sky-400 dark:border-gray-600 dark:focus-within:border-sky-500">
          <Icon name="user" className="h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 20))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('nav.name')}
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {t('namePrompt.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!trimmed}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#BA0C2F' }}
          >
            {t('namePrompt.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
