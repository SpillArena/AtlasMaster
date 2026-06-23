import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getName, setName } from '../../game/leaderboard'
import { Icon } from './../Icon'

/** Enkelt navnefelt i nav-baren — lagres til localStorage og brukes på ledertavla. */
export function NameInput() {
  const { t } = useTranslation()
  const [value, setValue] = useState(() => getName())

  const onChange = (v: string) => {
    setValue(v)
    setName(v)
  }

  return (
    <div
      className="group flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-200 ease-out focus-within:-translate-y-[1px]"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
      }}
    >
      <Icon
        name="user"
        className="h-4 w-4 shrink-0"
        style={{ color: 'var(--text-subtle)' }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 20))}
        placeholder={t('nav.name')}
        autoComplete="off"
        className="w-24 bg-transparent text-sm outline-none sm:w-32"
        style={{ color: 'var(--text)' }}
      />
    </div>
  )
}
