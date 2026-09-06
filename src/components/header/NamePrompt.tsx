import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { getName, setName } from '../../game/leaderboard'
import { authenticate, getSession, signOut, type AuthAction } from '../../game/auth'
import { Icon } from '../Icon'
import { Button } from '../ui'

interface Props {
  onConfirm: () => void
  onCancel: () => void
  /** 'start' spør før første runde, 'edit' åpner kontoen fra headeren */
  variant?: 'start' | 'edit'
}

/**
 * Innlogging: brukernavn og PIN.
 *
 * Dette var et navnefelt. Navnet var alt som identifiserte en spiller, og
 * siden tavla holder én rad per brukernavn, kunne hvem som helst sende inn et
 * resultat under et annet navn og ERSTATTE raden til den som faktisk hadde
 * spilt. En topplassering var ikke verdt noe, fordi den ikke var knyttet til
 * noen.
 *
 * PIN-en er fire til seks siffer, og skjemaet sier hvorfor det holder: fem
 * feil på rad stenger kontoen et kvarter. Det er forsøksgrensa, ikke lengden,
 * som gjør en PIN verdt noe — se functions/api/auth/.
 *
 * Å spille uten konto er fortsatt lov. Runden lagres da på enheten som før,
 * den kommer bare ikke på den globale tavla; en spiller som bare vil se hvor
 * mange fylker hen klarer, skal ikke måtte registrere seg først.
 */
export function NamePrompt({ onConfirm, onCancel, variant = 'start' }: Props) {
  const { t } = useTranslation()
  const session = getSession()
  const [mode, setMode] = useState<AuthAction>(session ? 'login' : 'register')
  const [name, setNameValue] = useState(() => session?.username ?? getName())
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const pinOk = /^\d{4,6}$/.test(pin)

  const submit = async () => {
    if (!trimmed || !pinOk || busy) return
    setBusy(true)
    setError(null)
    const result = await authenticate(mode, trimmed, pin)
    setBusy(false)
    if (result.ok) {
      onConfirm()
      return
    }
    setError(result.message)
  }

  /*
   * Uten konto: navnet lagres på enheten, og runden blir liggende der.
   * Innsendingen til den globale tavla krever et signert teikn, så den
   * hoppes over — se submitScore i game/scoreApi.ts.
   */
  const playAsGuest = () => {
    if (!trimmed) return
    setName(trimmed)
    onConfirm()
  }

  if (session && variant === 'edit') {
    return (
      <Shell onCancel={onCancel} title={t('auth.signedInTitle')} desc={t('auth.signedInDesc', { name: session.username })}>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('namePrompt.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              signOut()
              onConfirm()
            }}
          >
            {t('auth.signOut')}
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      onCancel={onCancel}
      title={t(mode === 'register' ? 'auth.registerTitle' : 'auth.loginTitle')}
      desc={t(mode === 'register' ? 'auth.registerDesc' : 'auth.loginDesc')}
    >
      <Field icon="user">
        <input
          autoFocus
          value={name}
          onChange={(e) => setNameValue(e.target.value.slice(0, 20))}
          placeholder={t('nav.name')}
          autoComplete="username"
          className="w-full bg-transparent text-base outline-none"
          style={{ color: 'var(--text)' }}
        />
      </Field>

      <div className="mt-2">
        <Field icon="seal">
          <input
            value={pin}
            /* bare siffer inn — et felt som godtar bokstaver og så avviser dem
               på serveren er et felt som lærer deg regelen for sent */
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder={t('auth.pinPlaceholder')}
            type="password"
            inputMode="numeric"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            className="w-full bg-transparent text-base tracking-[0.4em] outline-none"
            style={{ color: 'var(--text)' }}
          />
        </Field>
      </div>

      <p className="mt-2 text-caption" style={{ color: 'var(--text-subtle)' }}>
        {t('auth.pinHint')}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          {t(`auth.errors.${error}`, { defaultValue: error })}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'register' ? 'login' : 'register')
            setError(null)
          }}
          className="text-sm font-bold underline underline-offset-2"
          style={{ color: 'var(--text-subtle)' }}
        >
          {t(mode === 'register' ? 'auth.haveAccount' : 'auth.needAccount')}
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={playAsGuest} disabled={!trimmed || busy}>
            {t('auth.guest')}
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={!trimmed || !pinOk || busy}>
            {t(mode === 'register' ? 'auth.register' : 'auth.signIn')}
          </Button>
        </div>
      </div>
    </Shell>
  )
}

/** Kartusjen rundt dialogen — felles for begge tilstandene over. */
function Shell({
  onCancel,
  title,
  desc,
  children,
}: {
  onCancel: () => void
  title: string
  desc: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
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
        className="cartouche w-full max-w-sm p-6"
        style={{ color: 'var(--text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow mb-1">{t('namePrompt.eyebrow')}</p>
        <h2
          id="name-prompt-title"
          className="font-display mb-1 text-2xl font-semibold tracking-[-0.005em]"
        >
          {title}
        </h2>
        <p id="name-prompt-desc" className="mb-4 text-sm" style={{ color: 'var(--text-subtle)' }}>
          {desc}
        </p>
        {children}
      </motion.div>
    </div>
  )
}

function Field({ icon, children }: { icon: 'user' | 'seal'; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors focus-within:border-[var(--accent)]"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" style={{ color: 'var(--text-subtle)' }} />
      {children}
    </div>
  )
}
