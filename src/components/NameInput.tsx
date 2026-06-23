import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getName, setName } from '../game/leaderboard'
import { Icon } from './Icon'

/** Enkelt navnefelt i nav-baren — lagres til localStorage og brukes på ledertavla. */
export function NameInput() {
  const { t } = useTranslation()
  const [value, setValue] = useState(() => getName())

  const onChange = (v: string) => {
    setValue(v)
    setName(v)
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 focus-within:border-sky-400 dark:border-gray-600 dark:focus-within:border-sky-500">
      <Icon name="user" className="h-4 w-4 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 20))}
        placeholder={t('nav.name')}
        autoComplete="off"
        className="w-24 bg-transparent text-sm outline-none placeholder:text-gray-400 sm:w-32"
      />
    </div>
  )
}
